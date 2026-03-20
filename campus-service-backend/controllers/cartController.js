const { pool } = require('../config/db');

// 统一响应格式
const successResponse = (res, data = null, message = '操作成功') => {
  return res.json({
    success: true,
    message,
    data
  });
};

const errorResponse = (res, code, message) => {
  return res.status(code).json({
    success: false,
    message
  });
};

// 获取购物车列表
exports.getCartList = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, pageSize = 50 } = req.query;
    const offset = (page - 1) * pageSize;
    
    // 查询购物车商品总数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM cart c
      JOIN product p ON c.product_id = p.id
      WHERE c.user_id = ? AND p.status = 1`,
      [userId]
    );
    const total = countResult[0].total;
    
    // 查询购物车商品
    const [cartItems] = await pool.query(
      `SELECT 
        c.id as cart_id, 
        c.product_id, 
        c.merchant_id, 
        c.quantity, 
        c.spec, 
        c.selected,
        p.name as goodsName, 
        p.image as goodsImage, 
        p.price, 
        p.stock, 
        p.status as product_status,
        m.name as merchantName, 
        m.logo as merchantLogo, 
        m.status as merchant_status
      FROM 
        cart c
      JOIN 
        product p ON c.product_id = p.id
      JOIN 
        merchant m ON c.merchant_id = m.id
      WHERE 
        c.user_id = ? AND p.status = 1
      ORDER BY 
        c.updated_at DESC
      LIMIT ? OFFSET ?`,
      [userId, parseInt(pageSize), offset]
    );
    
    // 查询失效商品
    const [invalidItems] = await pool.query(
      `SELECT 
        c.id as cart_id, 
        c.product_id, 
        p.name as goodsName, 
        p.image as goodsImage,
        CASE 
          WHEN p.status = 0 THEN '已下架' 
          WHEN p.stock = 0 THEN '库存不足' 
          ELSE '商品不可用' 
        END as reason
      FROM 
        cart c
      JOIN 
        product p ON c.product_id = p.id
      WHERE 
        c.user_id = ? AND (p.status = 0 OR p.stock = 0)
      ORDER BY 
        c.updated_at DESC`,
      [userId]
    );
    
    // 按商家分组
    const merchantsMap = {};
    
    cartItems.forEach(item => {
      if (!merchantsMap[item.merchant_id]) {
        merchantsMap[item.merchant_id] = {
          merchantId: item.merchant_id,
          merchantName: item.merchantName,
          merchantLogo: item.merchantLogo,
          merchantStatus: item.merchant_status,
          checked: false,
          goods: []
        };
      }
      
      merchantsMap[item.merchant_id].goods.push({
        cartId: item.cart_id,
        goodsId: item.product_id,
        goodsName: item.goodsName,
        goodsImage: item.goodsImage,
        spec: item.spec,
        price: item.price,
        quantity: item.quantity,
        stock: item.stock,
        selected: item.selected === 1,
        merchantId: item.merchant_id
      });
    });
    
    const merchants = Object.values(merchantsMap);
    
    // 检查每个商家的商品是否全部选中
    merchants.forEach(merchant => {
      const allSelected = merchant.goods.every(goods => goods.selected);
      merchant.checked = allSelected;
    });
    
    // 统计购物车商品总数和选中商品总数
    const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const selectedCount = cartItems.reduce((sum, item) => {
      return item.selected ? sum + item.quantity : sum;
    }, 0);
    
    successResponse(res, {
      merchants,
      invalidGoods: invalidItems,
      totalCount,
      selectedCount,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取购物车列表失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 添加商品到购物车
exports.addToCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id, merchant_id, quantity = 1, spec, selected = true } = req.body;
    
    // 验证参数
    if (!product_id || !merchant_id) {
      return errorResponse(res, 400, '缺少必要参数');
    }
    
    if (quantity < 1 || quantity > 99) {
      return errorResponse(res, 400, '商品数量应在1-99之间');
    }
    
    // 检查商品是否存在且上架
    const [products] = await pool.query(
      'SELECT id, stock, status FROM product WHERE id = ?',
      [product_id]
    );
    
    if (products.length === 0) {
      return errorResponse(res, 404, '商品不存在');
    }
    
    const product = products[0];
    
    if (product.status === 0) {
      return errorResponse(res, 400, '商品已下架');
    }
    
    if (quantity > product.stock) {
      return errorResponse(res, 400, '商品库存不足');
    }
    
    // 检查商家是否营业
    const [merchants] = await pool.query(
      'SELECT status FROM merchant WHERE id = ?',
      [merchant_id]
    );
    
    if (merchants.length === 0) {
      return errorResponse(res, 404, '商家不存在');
    }
    
    if (merchants[0].status === 0) {
      return errorResponse(res, 400, '商家休息中，暂不支持下单');
    }
    
    // 使用INSERT ... ON DUPLICATE KEY UPDATE实现"存在则更新，不存在则新增"
    await pool.query(
      `INSERT INTO cart (user_id, product_id, merchant_id, quantity, spec, selected) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       quantity = quantity + ?, 
       selected = ?, 
       updated_at = NOW()`,
      [userId, product_id, merchant_id, quantity, spec, selected ? 1 : 0, quantity, selected ? 1 : 0]
    );
    
    successResponse(res, null, '添加成功');
  } catch (error) {
    console.error('添加商品到购物车失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 更新购物车商品
exports.updateCartItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cartId = req.params.id;
    const { quantity, selected, spec } = req.body;
    
    // 验证参数
    if (!cartId) {
      return errorResponse(res, 400, '缺少必要参数');
    }
    
    // 检查购物车商品是否存在
    const [cartItems] = await pool.query(
      'SELECT product_id FROM cart WHERE id = ? AND user_id = ?',
      [cartId, userId]
    );
    
    if (cartItems.length === 0) {
      return errorResponse(res, 404, '购物车商品不存在');
    }
    
    const productId = cartItems[0].product_id;
    
    // 如果更新数量，检查库存
    if (quantity !== undefined) {
      if (quantity < 1 || quantity > 99) {
        return errorResponse(res, 400, '商品数量应在1-99之间');
      }
      
      const [products] = await pool.query(
        'SELECT stock FROM product WHERE id = ?',
        [productId]
      );
      
      if (products.length === 0) {
        return errorResponse(res, 404, '商品不存在');
      }
      
      if (quantity > products[0].stock) {
        return errorResponse(res, 400, '商品库存不足');
      }
    }
    
    // 构建更新语句
    let updateFields = [];
    let updateParams = [];
    
    if (quantity !== undefined) {
      updateFields.push('quantity = ?');
      updateParams.push(quantity);
    }
    
    if (selected !== undefined) {
      updateFields.push('selected = ?');
      updateParams.push(selected ? 1 : 0);
    }
    
    if (spec !== undefined) {
      updateFields.push('spec = ?');
      updateParams.push(spec);
    }
    
    if (updateFields.length === 0) {
      return errorResponse(res, 400, '没有需要更新的字段');
    }
    
    updateFields.push('updated_at = NOW()');
    updateParams.push(cartId, userId);
    
    const [result] = await pool.query(
      `UPDATE cart SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
      updateParams
    );
    
    if (result.affectedRows === 0) {
      return errorResponse(res, 404, '购物车商品不存在');
    }
    
    successResponse(res, null, '更新成功');
  } catch (error) {
    console.error('更新购物车商品失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 删除购物车商品
exports.deleteCartItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cartId = req.params.id;
    
    // 验证参数
    if (!cartId) {
      return errorResponse(res, 400, '缺少必要参数');
    }
    
    // 删除商品
    const [result] = await pool.query(
      'DELETE FROM cart WHERE id = ? AND user_id = ?',
      [cartId, userId]
    );
    
    if (result.affectedRows === 0) {
      return errorResponse(res, 404, '购物车商品不存在');
    }
    
    successResponse(res, null, '删除成功');
  } catch (error) {
    console.error('删除购物车商品失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 删除选中的购物车商品
exports.deleteSelectedItems = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 删除选中的商品
    const [result] = await pool.query(
      'DELETE FROM cart WHERE user_id = ? AND selected = 1',
      [userId]
    );
    
    successResponse(res, null, `删除了 ${result.affectedRows} 件商品`);
  } catch (error) {
    console.error('删除选中商品失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 清空购物车
exports.clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    await pool.query('DELETE FROM cart WHERE user_id = ?', [userId]);
    
    successResponse(res, null, '清空成功');
  } catch (error) {
    console.error('清空购物车失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 删除失效商品
exports.deleteInvalidItems = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 删除已下架或库存为0的商品
    const [result] = await pool.query(
      `DELETE c FROM cart c
      JOIN product p ON c.product_id = p.id
      WHERE c.user_id = ? AND (p.status = 0 OR p.stock = 0)`,
      [userId]
    );
    
    successResponse(res, null, `清理了 ${result.affectedRows} 件失效商品`);
  } catch (error) {
    console.error('清理失效商品失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 获取选中的购物车商品（用于结算）
exports.getSelectedItems = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 查询选中的商品
    const [selectedItems] = await pool.query(
      `SELECT 
        c.id as cart_id, 
        c.product_id, 
        c.merchant_id, 
        c.quantity, 
        c.spec, 
        p.name as goodsName, 
        p.image as goodsImage, 
        p.price, 
        p.stock, 
        m.name as merchantName, 
        m.logo as merchantLogo
      FROM 
        cart c
      JOIN 
        product p ON c.product_id = p.id
      JOIN 
        merchant m ON c.merchant_id = m.id
      WHERE 
        c.user_id = ? AND c.selected = 1 AND p.status = 1 AND p.stock > 0
      ORDER BY 
        c.merchant_id, c.updated_at DESC`,
      [userId]
    );
    
    // 按商家分组
    const merchantsMap = {};
    let totalAmount = 0;
    let totalQuantity = 0;
    
    selectedItems.forEach(item => {
      if (!merchantsMap[item.merchant_id]) {
        merchantsMap[item.merchant_id] = {
          merchantId: item.merchant_id,
          merchantName: item.merchantName,
          merchantLogo: item.merchantLogo,
          items: [],
          merchantTotal: 0
        };
      }
      
      const itemSubtotal = item.price * item.quantity;
      merchantsMap[item.merchant_id].items.push({
        cartId: item.cart_id,
        goodsId: item.product_id,
        goodsName: item.goodsName,
        goodsImage: item.goodsImage,
        spec: item.spec,
        price: item.price,
        quantity: item.quantity,
        subtotal: itemSubtotal
      });
      
      merchantsMap[item.merchant_id].merchantTotal += itemSubtotal;
      totalAmount += itemSubtotal;
      totalQuantity += item.quantity;
    });
    
    const merchants = Object.values(merchantsMap);
    
    // 检查是否有选中商品
    if (merchants.length === 0) {
      return errorResponse(res, 400, '请选择要结算的商品');
    }
    
    // 检查是否跨商家
    if (merchants.length > 1) {
      return errorResponse(res, 400, '暂不支持跨商家结算，请分开下单');
    }
    
    successResponse(res, {
      merchants,
      totalAmount,
      totalQuantity
    });
  } catch (error) {
    console.error('获取选中商品失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};