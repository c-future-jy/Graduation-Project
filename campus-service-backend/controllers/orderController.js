const { pool } = require('../config/db');

// 生成订单号
const generateOrderNo = () => {
  const timestamp = Date.now().toString();
  const randomStr = Math.random().toString(36).substr(2, 9).toUpperCase();
  return 'ORD' + timestamp + randomStr;
};

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

// 获取订单列表
exports.getOrderList = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    // 构建查询语句
    let query = `
      SELECT 
        o.*, 
        m.name as merchantName, 
        m.logo as merchantLogo
      FROM 
        \`order\` o
      JOIN 
        merchant m ON o.merchant_id = m.id
      WHERE 
        o.user_id = ?
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM `order` WHERE user_id = ?';
    let params = [userId];
    
    // 状态筛选
    if (status) {
      query += ' AND o.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }
    
    // 分页和排序
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // 执行查询
    const [orders] = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, params.slice(0, -2));
    
    // 统计各状态订单数量
    const [statusCounts] = await pool.query(
      'SELECT status, COUNT(*) as count FROM `order` WHERE user_id = ? GROUP BY status',
      [userId]
    );
    
    const statusCountMap = {};
    statusCounts.forEach(item => {
      statusCountMap[item.status] = item.count;
    });
    
    successResponse(res, {
      orders,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      },
      statusCounts: statusCountMap
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 获取订单详情
exports.getOrderById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    
    // 查询订单信息
    const [orders] = await pool.query(
      `
        SELECT 
          o.*, 
          m.name as merchantName, 
          m.logo as merchantLogo
        FROM 
          \`order\` o
        JOIN 
          merchant m ON o.merchant_id = m.id
        WHERE 
          o.id = ? AND o.user_id = ?
      `,
      [orderId, userId]
    );
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }
    
    // 查询订单详情
    const [items] = await pool.query('SELECT * FROM order_item WHERE order_id = ?', [orderId]);
    
    successResponse(res, {
      order: orders[0],
      items
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 创建订单
exports.createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { merchant_id, items, address_id, remark, payment_method = 'wechat' } = req.body;
    
    // 验证参数
    if (!merchant_id || !items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, '缺少必要参数');
    }
    
    // 验证地址
    let receiverName, receiverPhone, receiverAddress;
    if (address_id) {
      const [addresses] = await pool.query(
        'SELECT receiver_name, phone, province, city, district, detail FROM address WHERE id = ? AND user_id = ?',
        [address_id, userId]
      );
      
      if (addresses.length === 0) {
        return errorResponse(res, 400, '地址不存在');
      }
      
      const address = addresses[0];
      receiverName = address.receiver_name;
      receiverPhone = address.phone;
      receiverAddress = `${address.province}${address.city}${address.district}${address.detail}`;
    } else {
      return errorResponse(res, 400, '请选择收货地址');
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 生成订单号
      const orderNo = generateOrderNo();
      
      // 计算总金额
      let totalAmount = 0;
      
      // 校验库存并扣减
      for (const item of items) {
        if (!item.product_id || !item.quantity || item.quantity <= 0) {
          await pool.query('ROLLBACK');
          return errorResponse(res, 400, '商品信息不完整');
        }
        
        // 检查库存
        const [products] = await pool.query(
          'SELECT stock, name, image, price FROM product WHERE id = ? AND status = 1',
          [item.product_id]
        );
        
        if (products.length === 0) {
          await pool.query('ROLLBACK');
          return errorResponse(res, 400, '商品不存在或已下架');
        }
        
        const product = products[0];
        
        if (item.quantity > product.stock) {
          await pool.query('ROLLBACK');
          return errorResponse(res, 400, `商品 ${product.name} 库存不足`);
        }
        
        // 扣减库存
        await pool.query(
          'UPDATE product SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [item.quantity, item.product_id, item.quantity]
        );
        
        // 计算金额
        totalAmount += product.price * item.quantity;
      }
      
      // 创建订单
      const [orderResult] = await pool.query(
        `
          INSERT INTO \`order\` (
            order_no, 
            user_id, 
            merchant_id, 
            total_amount, 
            receiver_name, 
            receiver_phone, 
            receiver_address, 
            remark, 
            payment_method, 
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [orderNo, userId, merchant_id, totalAmount, receiverName, receiverPhone, receiverAddress, remark, payment_method, 0]
      );
      
      // 创建订单详情
      for (const item of items) {
        const [products] = await pool.query(
          'SELECT name, image, price FROM product WHERE id = ?',
          [item.product_id]
        );
        
        const product = products[0];
        const subtotal = product.price * item.quantity;
        
        await pool.query(
          `
            INSERT INTO order_item (
              order_id, 
              product_id, 
              product_name, 
              product_image, 
              price, 
              quantity, 
              subtotal
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [orderResult.insertId, item.product_id, product.name, product.image, product.price, item.quantity, subtotal]
        );
      }
      
      // 清理购物车中已购买的商品
      await pool.query('DELETE FROM cart WHERE user_id = ? AND selected = 1', [userId]);
      
      // 提交事务
      await pool.query('COMMIT');
      
      successResponse(res, {
        orderId: orderResult.insertId,
        orderNo
      }, '订单创建成功');
    } catch (transactionError) {
      // 回滚事务
      await pool.query('ROLLBACK');
      console.error('创建订单失败:', transactionError);
      errorResponse(res, 500, '订单创建失败');
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 取消订单
exports.cancelOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    
    // 检查订单是否存在
    const [orders] = await pool.query(
      'SELECT status FROM `order` WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }
    
    const order = orders[0];
    
    // 检查订单状态
    if (order.status !== 0 && order.status !== 1) {
      return errorResponse(res, 400, '该订单状态不允许取消');
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 更新订单状态
      await pool.query(
        'UPDATE `order` SET status = 4, updated_at = NOW() WHERE id = ? AND user_id = ?',
        [orderId, userId]
      );
      
      // 恢复商品库存
      const [items] = await pool.query('SELECT product_id, quantity FROM order_item WHERE order_id = ?', [orderId]);
      
      for (const item of items) {
        await pool.query(
          'UPDATE product SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
      
      // 提交事务
      await pool.query('COMMIT');
      
      successResponse(res, null, '订单已取消');
    } catch (transactionError) {
      // 回滚事务
      await pool.query('ROLLBACK');
      console.error('取消订单失败:', transactionError);
      errorResponse(res, 500, '取消订单失败');
    }
  } catch (error) {
    console.error('取消订单失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 更新订单状态
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const orderId = req.params.id;
    const { status } = req.body;
    
    // 验证参数
    if (status === undefined) {
      return errorResponse(res, 400, '缺少状态参数');
    }
    
    // 检查订单是否存在
    const [orders] = await pool.query('SELECT id, status, merchant_id, user_id FROM `order` WHERE id = ?', [orderId]);
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }
    
    const order = orders[0];
    
    // 权限验证
    if (userRole !== 3) {
      if (userRole === 1 && order.user_id !== userId) {
        return errorResponse(res, 403, '无权操作该订单');
      }
      if (userRole === 2 && order.merchant_id !== req.user.merchant_id) {
        return errorResponse(res, 403, '无权操作该订单');
      }
    }
    
    // 状态流转验证
    const validTransitions = {
      0: [1, 4], // 待支付 → 待发货/已取消
      1: [2, 4], // 待发货 → 已发货/已取消
      2: [3],     // 已发货 → 已完成
      3: [],      // 已完成 → 无
      4: []       // 已取消 → 无
    };
    
    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      return errorResponse(res, 400, '无效的状态变更');
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 构建更新语句
      let updateFields = ['status = ?', 'updated_at = NOW()'];
      let updateParams = [status, orderId];
      
      // 根据状态更新时间戳
      if (status === 1) {
        updateFields.push('payment_time = NOW()');
      } else if (status === 2) {
        updateFields.push('delivery_time = NOW()');
      } else if (status === 3) {
        updateFields.push('complete_time = NOW()');
      }
      
      // 执行更新
      await pool.query(
        `UPDATE \`order\` SET ${updateFields.join(', ')} WHERE id = ?`,
        updateParams
      );
      
      // 提交事务
      await pool.query('COMMIT');
      
      successResponse(res, null, '订单状态更新成功');
    } catch (transactionError) {
      // 回滚事务
      await pool.query('ROLLBACK');
      console.error('更新订单状态失败:', transactionError);
      errorResponse(res, 500, '更新订单状态失败');
    }
  } catch (error) {
    console.error('更新订单状态失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 删除订单
exports.deleteOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    
    // 检查订单是否存在
    const [orders] = await pool.query(
      'SELECT status FROM `order` WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }
    
    const order = orders[0];
    
    // 检查订单状态
    if (order.status === 0 || order.status === 1 || order.status === 2) {
      return errorResponse(res, 400, '进行中的订单不可删除');
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 删除订单详情
      await pool.query('DELETE FROM order_item WHERE order_id = ?', [orderId]);
      
      // 删除订单
      await pool.query('DELETE FROM `order` WHERE id = ? AND user_id = ?', [orderId, userId]);
      
      // 提交事务
      await pool.query('COMMIT');
      
      successResponse(res, null, '订单删除成功');
    } catch (transactionError) {
      // 回滚事务
      await pool.query('ROLLBACK');
      console.error('删除订单失败:', transactionError);
      errorResponse(res, 500, '删除订单失败');
    }
  } catch (error) {
    console.error('删除订单失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 商家获取订单列表
exports.getMerchantOrders = async (req, res, next) => {
  try {
    const merchantId = req.user.merchant_id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    // 验证商家身份
    if (!merchantId) {
      return errorResponse(res, 403, '商家身份验证失败');
    }
    
    // 构建查询语句
    let query = 'SELECT * FROM `order` WHERE merchant_id = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM `order` WHERE merchant_id = ?';
    let params = [merchantId];
    
    // 状态筛选
    if (status) {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }
    
    // 分页和排序
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // 执行查询
    const [orders] = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, params.slice(0, -2));
    
    successResponse(res, {
      orders,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('获取商家订单列表失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 管理员获取订单列表
exports.getAdminOrders = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, order_no, user_id, merchant_id, status, startTime, endTime } = req.query;
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT 
        o.*,
        u.nickname as user_name,
        m.name as merchant_name,
        (SELECT GROUP_CONCAT(DISTINCT product_image) FROM order_item WHERE order_id = o.id LIMIT 3) as product_images
      FROM 
        \`order\` o
      LEFT JOIN 
        user u ON o.user_id = u.id
      LEFT JOIN 
        merchant m ON o.merchant_id = m.id
    `;
    let countQuery = `
      SELECT 
        COUNT(*) as total
      FROM 
        \`order\` o
      LEFT JOIN 
        user u ON o.user_id = u.id
      LEFT JOIN 
        merchant m ON o.merchant_id = m.id
    `;
    let queryParams = [];
    let whereClause = [];
    
    // 构建筛选条件
    if (order_no) {
      whereClause.push('o.order_no LIKE ?');
      queryParams.push(`%${order_no}%`);
    }
    
    if (user_id) {
      whereClause.push('o.user_id = ?');
      queryParams.push(user_id);
    }
    
    if (merchant_id) {
      whereClause.push('o.merchant_id = ?');
      queryParams.push(merchant_id);
    }
    
    if (status !== undefined) {
      whereClause.push('o.status = ?');
      queryParams.push(status);
    }
    
    if (startTime) {
      whereClause.push('o.created_at >= ?');
      queryParams.push(startTime);
    }
    
    if (endTime) {
      whereClause.push('o.created_at <= ?');
      queryParams.push(endTime);
    }
    
    // 添加WHERE子句
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
      countQuery += ' WHERE ' + whereClause.join(' AND ');
    }
    
    // 添加排序和分页
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), parseInt(offset));
    
    const [orders] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(pageSize));
    
    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取管理员订单列表失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 获取订单详情（管理员）
 * GET /api/admin/orders/:id
 */
exports.getAdminOrderDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 获取订单基本信息
    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u.nickname as user_name,
        u.phone as user_phone,
        m.name as merchant_name,
        m.phone as merchant_phone
      FROM 
        \`order\` o
      LEFT JOIN 
        user u ON o.user_id = u.id
      LEFT JOIN 
        merchant m ON o.merchant_id = m.id
      WHERE 
        o.id = ?
    `, [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    const order = orders[0];
    
    // 获取订单商品明细
    const [items] = await pool.query(`
      SELECT 
        *
      FROM 
        order_item
      WHERE 
        order_id = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        order,
        items
      }
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 更新订单状态（管理员）
 * PUT /api/admin/orders/:id/status
 */
exports.updateAdminOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;
    
    if (status === undefined) {
      return res.status(400).json({ success: false, message: '缺少状态参数' });
    }
    
    // 检查订单是否存在
    const [orders] = await pool.query('SELECT id, status, merchant_id, user_id FROM `order` WHERE id = ?', [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    const order = orders[0];
    
    // 状态流转验证
    const validTransitions = {
      0: [1, 4], // 待支付 → 待发货/已取消
      1: [2, 4], // 待发货 → 已发货/已取消
      2: [3],     // 已发货 → 已完成
      3: [],      // 已完成 → 无
      4: []       // 已取消 → 无
    };
    
    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      return res.status(400).json({ success: false, message: '无效的状态变更' });
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 构建更新语句
      let updateFields = ['status = ?', 'updated_at = NOW()'];
      let updateParams = [status, id];
      
      // 根据状态更新时间戳
      if (status === 1) {
        updateFields.push('payment_time = NOW()');
      } else if (status === 2) {
        updateFields.push('delivery_time = NOW()');
      } else if (status === 3) {
        updateFields.push('complete_time = NOW()');
      }
      
      // 执行更新
      await pool.query(
        `UPDATE \`order\` SET ${updateFields.join(', ')} WHERE id = ?`,
        updateParams
      );
      
      // 记录操作日志
      await pool.query(
        'INSERT INTO admin_operation_log (admin_id, operation, target_order_id, created_at) VALUES (?, ?, ?, NOW())',
        [adminId, `更新订单状态为 ${status}`, id]
      );
      
      // 状态更新后通知用户和商家
      // 通知用户
      await pool.query(
        'INSERT INTO notification (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())',
        [order.user_id, '订单状态更新', `您的订单状态已更新为 ${getStatusText(status)}`]
      );
      
      // 通知商家
      await pool.query(
        'INSERT INTO notification (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())',
        [order.merchant_id, '订单状态更新', `您的订单状态已更新为 ${getStatusText(status)}`]
      );
      
      // 提交事务
      await pool.query('COMMIT');
      
      res.json({ success: true, message: '订单状态更新成功' });
    } catch (transactionError) {
      // 回滚事务
      await pool.query('ROLLBACK');
      console.error('更新订单状态失败:', transactionError);
      res.status(500).json({ success: false, message: '更新订单状态失败' });
    }
  } catch (error) {
    console.error('更新订单状态失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 强制取消订单
 * POST /api/admin/orders/:id/force-cancel
 */
exports.forceCancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;
    const adminId = req.user.id;
    
    // 检查订单是否存在
    const [orders] = await pool.query('SELECT id, status, merchant_id, user_id FROM `order` WHERE id = ?', [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    const order = orders[0];
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 更新订单状态
      await pool.query(
        'UPDATE `order` SET status = 4, cancel_reason = ?, cancel_admin_id = ?, updated_at = NOW() WHERE id = ?',
        [cancel_reason, adminId, id]
      );
      
      // 恢复商品库存
      const [items] = await pool.query('SELECT product_id, quantity FROM order_item WHERE order_id = ?', [id]);
      
      for (const item of items) {
        await pool.query(
          'UPDATE product SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
      
      // 记录操作日志
      await pool.query(
        'INSERT INTO admin_operation_log (admin_id, operation, target_order_id, created_at) VALUES (?, ?, ?, NOW())',
        [adminId, '强制取消订单', id]
      );
      
      // 通知用户
      await pool.query(
        'INSERT INTO notification (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())',
        [order.user_id, '订单被取消', `您的订单已被管理员强制取消，原因：${cancel_reason || '无'}`]
      );
      
      // 通知商家
      await pool.query(
        'INSERT INTO notification (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())',
        [order.merchant_id, '订单被取消', `您的订单已被管理员强制取消，原因：${cancel_reason || '无'}`]
      );
      
      // 提交事务
      await pool.query('COMMIT');
      
      res.json({ success: true, message: '订单已强制取消' });
    } catch (transactionError) {
      // 回滚事务
      await pool.query('ROLLBACK');
      console.error('强制取消订单失败:', transactionError);
      res.status(500).json({ success: false, message: '强制取消订单失败' });
    }
  } catch (error) {
    console.error('强制取消订单失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    0: '待支付',
    1: '待发货',
    2: '已发货',
    3: '已完成',
    4: '已取消'
  };
  return statusMap[status] || '未知状态';
};

// 获取订单数量统计
exports.getOrderCounts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 查询各状态订单数量
    const [statusCounts] = await pool.query(
      'SELECT status, COUNT(*) as count FROM `order` WHERE user_id = ? GROUP BY status',
      [userId]
    );
    
    const statusCountMap = {};
    statusCounts.forEach(item => {
      statusCountMap[item.status] = item.count;
    });
    
    successResponse(res, {
      pendingPay: statusCountMap[0] || 0,           // 待支付
      pendingDeliver: statusCountMap[1] || 0,       // 待发货
      delivered: statusCountMap[2] || 0,            // 已发货
      completed: statusCountMap[3] || 0,            // 已完成
      cancelled: statusCountMap[4] || 0             // 已取消
    });
  } catch (error) {
    console.error('获取订单数量失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};