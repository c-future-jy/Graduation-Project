const { pool } = require('../config/db');

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return (rows[0] && rows[0].cnt > 0) || false;
}

async function assertMerchantOwnsProductOrThrow(productId, user) {
  const [rows] = await pool.query('SELECT id, merchant_id FROM product WHERE id = ?', [productId]);
  if (!rows || rows.length === 0) {
    const err = new Error('商品不存在');
    err.status = 404;
    throw err;
  }

  // 管理员可操作任意商品
  if (user && user.role === 3) return rows[0];

  // 商家只能操作自己的商品
  if (user && user.role === 2) {
    const tokenMerchantId = user.merchant_id !== undefined && user.merchant_id !== null ? parseInt(user.merchant_id, 10) : null;
    if (!tokenMerchantId) {
      const err = new Error('缺少商家身份信息');
      err.status = 403;
      throw err;
    }
    const ownerId = rows[0].merchant_id !== undefined && rows[0].merchant_id !== null ? parseInt(rows[0].merchant_id, 10) : null;
    if (ownerId !== tokenMerchantId) {
      const err = new Error('权限不足，只能操作自己的商品');
      err.status = 403;
      throw err;
    }
    return rows[0];
  }

  const err = new Error('权限不足');
  err.status = 403;
  throw err;
}

// 获取商品列表
exports.getProductList = async (req, res, next) => {
  try {
    const { merchant_id, category_id } = req.query;
    const keyword = String(req.query.keyword ?? req.query.q ?? '').trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM product WHERE status = 1';
    let params = [];
    
    if (merchant_id) {
      query += ' AND merchant_id = ?';
      params.push(merchant_id);
    }
    if (category_id) {
      query += ' AND category_id = ?';
      params.push(category_id);
    }

    // 关键词搜索（商品名/描述）
    if (keyword) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const [products] = await pool.query(query, params);
    res.json({ success: true, data: { products } });
  } catch (error) {
    next(error);
  }
};

// 商家端：获取自己的商品列表（含上下架）
// GET /api/products/my
exports.getMyProductList = async (req, res, next) => {
  try {
    const merchantId = req.user && req.user.merchant_id ? parseInt(req.user.merchant_id, 10) : null;
    if (!merchantId) {
      return res.status(403).json({
        success: false,
        message: '缺少商家身份信息'
      });
    }

    const categoryId = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
    const keyword = String(req.query.keyword ?? req.query.q ?? '').trim();
    const statusRaw = req.query.status;
    const status = statusRaw === undefined || statusRaw === null || statusRaw === '' ? null : parseInt(statusRaw, 10);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;

    const where = ['p.merchant_id = ?'];
    const params = [merchantId];

    if (categoryId) {
      where.push('p.category_id = ?');
      params.push(categoryId);
    }

    if (Number.isFinite(status)) {
      where.push('p.status = ?');
      params.push(status);
    }

    if (keyword) {
      where.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const listSql = `
      SELECT
        p.*, 
        c.name AS category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.id
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM product p
      ${whereSql}
    `;

    const [products] = await pool.query(listSql, [...params, limit, offset]);
    const [countRows] = await pool.query(countSql, params);
    const total = countRows && countRows[0] ? parseInt(countRows[0].total, 10) : 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// 获取商品详情
exports.getProductById = async (req, res, next) => {
  try {
    const [products] = await pool.query('SELECT * FROM product WHERE id = ?', [req.params.id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }
    res.json({ success: true, data: { product: products[0] } });
  } catch (error) {
    next(error);
  }
};

// 创建商品
exports.createProduct = async (req, res, next) => {
  try {
    const { merchant_id, category_id, name, description, price, stock, image } = req.body;
    const merchantIdFromToken = req.user && req.user.merchant_id ? parseInt(req.user.merchant_id, 10) : null;
    const finalMerchantId = req.user && req.user.role === 2 ? merchantIdFromToken : merchant_id;

    if (!finalMerchantId) {
      return res.status(400).json({
        success: false,
        message: '缺少 merchant_id'
      });
    }

    const [result] = await pool.query(
      'INSERT INTO product (merchant_id, category_id, name, description, price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [finalMerchantId, category_id, name, description, price, stock, image]
    );
    res.status(201).json({ success: true, data: { productId: result.insertId } });
  } catch (error) {
    next(error);
  }
};

// 更新商品
exports.updateProduct = async (req, res, next) => {
  try {
    await assertMerchantOwnsProductOrThrow(req.params.id, req.user);
    const { name, description, price, stock, image, status } = req.body;
    await pool.query(
      'UPDATE product SET name = ?, description = ?, price = ?, stock = ?, image = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [name, description, price, stock, image, status, req.params.id]
    );
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    next(error);
  }
};

// 删除商品
exports.deleteProduct = async (req, res, next) => {
  try {
    await assertMerchantOwnsProductOrThrow(req.params.id, req.user);
    await pool.query('DELETE FROM product WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商品列表（管理员）
 * GET /api/admin/products
 */
exports.getAdminProductList = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, merchant_id, category_id, status, keyword, stock_warning } = req.query;
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT 
        p.*,
        m.name as merchant_name,
        c.name as category_name,
        COALESCE(SUM(oi.quantity), 0) as sales_count
      FROM 
        product p
      LEFT JOIN 
        merchant m ON p.merchant_id = m.id
      LEFT JOIN 
        category c ON p.category_id = c.id
      LEFT JOIN 
        order_item oi ON p.id = oi.product_id
      LEFT JOIN 
        \`order\` o ON oi.order_id = o.id AND o.status IN (2, 3)
    `;
    let countQuery = `
      SELECT 
        COUNT(*) as total
      FROM 
        product p
      LEFT JOIN 
        merchant m ON p.merchant_id = m.id
      LEFT JOIN 
        category c ON p.category_id = c.id
    `;
    let queryParams = [];
    let whereClause = [];
    
    // 构建筛选条件
    if (merchant_id) {
      whereClause.push('p.merchant_id = ?');
      queryParams.push(merchant_id);
    }
    
    if (category_id) {
      whereClause.push('p.category_id = ?');
      queryParams.push(category_id);
    }
    
    if (status !== undefined) {
      whereClause.push('p.status = ?');
      queryParams.push(status);
    }
    
    if (keyword) {
      whereClause.push('(p.name LIKE ? OR p.description LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    if (stock_warning) {
      whereClause.push('p.stock < 10 AND p.status = 1');
    }
    
    // 添加WHERE子句
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
      countQuery += ' WHERE ' + whereClause.join(' AND ');
    }
    
    // 添加分组、排序和分页
    query += ' GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), parseInt(offset));
    
    const [products] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(pageSize));
    
    res.json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商品详情（管理员）
 * GET /api/admin/products/:id
 */
exports.getAdminProductDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 获取商品基本信息
    const [products] = await pool.query(`
      SELECT 
        p.*,
        m.name as merchant_name,
        c.name as category_name
      FROM 
        product p
      LEFT JOIN 
        merchant m ON p.merchant_id = m.id
      LEFT JOIN 
        category c ON p.category_id = c.id
      WHERE 
        p.id = ?
    `, [id]);
    
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }
    
    const product = products[0];
    
    // 获取商品评价统计
    const [feedbackStats] = await pool.query(`
      SELECT 
        AVG(rating) as avg_rating,
        COUNT(*) as feedback_count
      FROM 
        feedback
      WHERE 
        product_id = ?
    `, [id]);
    
    // 获取商品销量统计
    const [salesStats] = await pool.query(`
      SELECT 
        COALESCE(SUM(quantity), 0) as total_sales
      FROM 
        order_item
      WHERE 
        product_id = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        product,
        feedbackStats: feedbackStats[0],
        salesStats: salesStats[0]
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新商品状态
 * PUT /api/admin/products/:id/status
 */
exports.updateProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, offline_reason } = req.body;
    const adminId = req.user.id;
    
    if (status === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少状态参数'
      });
    }
    
    // 更新商品状态
    await pool.query(
      'UPDATE product SET status = ?, offline_reason = ?, offline_admin_id = ?, updated_at = NOW() WHERE id = ?',
      [status, offline_reason, status === 0 ? adminId : null, id]
    );
    
    // 记录操作日志
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, target_product_id, created_at) VALUES (?, ?, ?, NOW())',
      [adminId, status ? '上架商品' : '下架商品', id]
    );
    
    // 下架后通知商家
    if (status === 0) {
      // 获取商家信息
      const [products] = await pool.query('SELECT merchant_id FROM product WHERE id = ?', [id]);
      if (products.length > 0) {
        await pool.query(
          'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
          [products[0].merchant_id, '商品下架通知', `您的商品已被管理员下架，原因：${offline_reason || '无'}`, 4]
        );
      }
      
      // 标记购物车中的商品为失效
      await pool.query(
        'UPDATE cart SET status = 0 WHERE product_id = ?',
        [id]
      );
    }
    
    res.json({
      success: true,
      message: status ? '商品已上架' : '商品已下架'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 商品批量操作接口
 * POST /api/admin/products/batch-update
 */
exports.batchUpdateProducts = async (req, res, next) => {
  try {
    const { product_ids, status, offline_reason } = req.body;
    const adminId = req.user.id;
    
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少商品ID列表'
      });
    }
    
    if (status === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少状态参数'
      });
    }
    
    let successCount = 0;
    let failedCount = 0;
    const failedReasons = [];
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      for (const productId of product_ids) {
        try {
          // 更新商品状态
          await pool.query(
            'UPDATE product SET status = ?, offline_reason = ?, offline_admin_id = ?, updated_at = NOW() WHERE id = ?',
            [status, offline_reason, status === 0 ? adminId : null, productId]
          );
          
          // 记录操作日志
          await pool.query(
            'INSERT INTO admin_operation_log (admin_id, operation, target_product_id, created_at) VALUES (?, ?, ?, NOW())',
            [adminId, status ? '上架商品' : '下架商品', productId]
          );
          
          // 下架后通知商家
          if (status === 0) {
            // 获取商家信息
            const [products] = await pool.query('SELECT merchant_id FROM product WHERE id = ?', [productId]);
            if (products.length > 0) {
              await pool.query(
                'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
                [products[0].merchant_id, '商品下架通知', `您的商品已被管理员下架，原因：${offline_reason || '无'}`, 4]
              );
            }
            
            // 标记购物车中的商品为失效
            await pool.query(
              'UPDATE cart SET status = 0 WHERE product_id = ?',
              [productId]
            );
          }
          
          successCount++;
        } catch (error) {
          failedCount++;
          failedReasons.push({ product_id: productId, reason: error.message });
        }
      }
      
      // 提交事务
      await pool.query('COMMIT');
    } catch (error) {
      // 回滚事务
      await pool.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: '批量操作失败'
      });
    }
    
    res.json({
      success: true,
      data: {
        successCount,
        failedCount,
        failedReasons
      },
      message: `成功操作 ${successCount} 个商品，失败 ${failedCount} 个商品`
    });
  } catch (error) {
    next(error);
  }
};