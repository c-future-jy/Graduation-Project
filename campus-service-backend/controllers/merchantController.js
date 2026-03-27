const { pool } = require('../config/db');

// 获取商家列表
exports.getMerchantList = async (req, res, next) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM merchant WHERE status = 1';
    let params = [];
    
    // 根据分类筛选
    if (category && category !== 'recommend') {
      // 分类映射关系
      const categoryMap = {
        breakfast: 1,  // 早餐
        lunch: 2,      // 午餐
        noodles: 3,    // 面食
        rice: 4,       // 米饭
        salad: 5,      // 沙拉
        snack: 6,      // 小吃
        drink: 7,      // 饮品
        market: 8      // 超市
      };
      
      const categoryId = categoryMap[category];
      if (categoryId) {
        query += ' AND category_id = ?';
        params.push(categoryId);
      }
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [merchants] = await pool.query(query, params);
    res.json({ success: true, data: { merchants } });
  } catch (error) {
    next(error);
  }
};

// 获取商家详情
exports.getMerchantById = async (req, res, next) => {
  try {
    const [merchants] = await pool.query('SELECT * FROM merchant WHERE id = ?', [req.params.id]);
    if (merchants.length === 0) {
      return res.status(404).json({ success: false, message: '商家不存在' });
    }
    res.json({ success: true, data: { merchant: merchants[0] } });
  } catch (error) {
    next(error);
  }
};

// 创建商家
exports.createMerchant = async (req, res, next) => {
  try {
    const { name, logo, description, address, phone } = req.body;
    const [result] = await pool.query(
      'INSERT INTO merchant (owner_user_id, name, logo, description, address, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name, logo, description, address, phone]
    );
    res.status(201).json({ success: true, data: { merchantId: result.insertId } });
  } catch (error) {
    next(error);
  }
};

// 更新商家
exports.updateMerchant = async (req, res, next) => {
  try {
    const { name, logo, description, address, phone, status } = req.body;
    await pool.query(
      'UPDATE merchant SET name = ?, logo = ?, description = ?, address = ?, phone = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [name, logo, description, address, phone, status, req.params.id]
    );
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    next(error);
  }
};

// 删除商家
exports.deleteMerchant = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM merchant WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    next(error);
  }
};

// 申请成为商家
exports.applyMerchant = async (req, res, next) => {
  try {
    const { nickname, phone } = req.body;
    const user_id = req.user.id;
    const adminId = 1; // 假设管理员ID为1
    
    // 验证参数
    if (!nickname) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    // 检查用户是否已经是商家
    const [existingUsers] = await pool.query('SELECT role FROM user WHERE id = ?', [user_id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    if (existingUsers[0].role === 2) {
      return res.status(400).json({ success: false, message: '您已经是商家' });
    }
    
    // 检查是否已有未处理的商家记录
    const [existingMerchants] = await pool.query('SELECT id FROM merchant WHERE owner_user_id = ?', [user_id]);
    
    if (existingMerchants.length > 0) {
      return res.status(400).json({ success: false, message: '您已经提交了申请，正在审核中' });
    }
    
    // 创建商家记录（待审核状态）
    const [result] = await pool.query(
      'INSERT INTO merchant (owner_user_id, name, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [user_id, nickname, 0]
    );
    
    // 记录操作日志
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, target_user_id, created_at) VALUES (?, ?, ?, NOW())',
      [adminId, '用户申请成为商家', user_id]
    );
    
    res.json({ success: true, message: '申请提交成功，等待管理员审核' });
  } catch (error) {
    console.error('申请成为商家失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};



/**
 * 获取商家列表（管理员）
 * GET /api/admin/merchants
 */
exports.getAdminMerchantList = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, status, audit_status, keyword, category_id } = req.query;
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT 
        m.*,
        u.nickname as owner_name,
        COUNT(p.id) as product_count,
        COUNT(o.id) as order_count
      FROM 
        merchant m
      LEFT JOIN 
        user u ON m.owner_user_id = u.id
      LEFT JOIN 
        product p ON m.id = p.merchant_id
      LEFT JOIN 
        \`order\` o ON m.id = o.merchant_id
    `;
    let countQuery = `
      SELECT 
        COUNT(*) as total
      FROM 
        merchant m
      LEFT JOIN 
        user u ON m.owner_user_id = u.id
    `;
    let queryParams = [];
    let whereClause = [];
    
    // 构建筛选条件
    if (status !== undefined) {
      whereClause.push('m.status = ?');
      queryParams.push(status);
    }
    
    if (audit_status !== undefined) {
      whereClause.push('m.audit_status = ?');
      queryParams.push(audit_status);
    }
    
    if (keyword) {
      whereClause.push('(m.name LIKE ? OR m.description LIKE ? OR u.nickname LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    if (category_id) {
      whereClause.push('m.category_id = ?');
      queryParams.push(category_id);
    }
    
    // 添加WHERE子句
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
      countQuery += ' WHERE ' + whereClause.join(' AND ');
    }
    
    // 添加分组、排序和分页
    query += ' GROUP BY m.id ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), parseInt(offset));
    
    const [merchants] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(pageSize));
    
    res.json({
      success: true,
      data: {
        merchants,
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
 * 获取商家详情（管理员）
 * GET /api/admin/merchants/:id
 */
exports.getAdminMerchantDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 获取商家基本信息
    const [merchants] = await pool.query(`
      SELECT 
        m.*,
        u.nickname as owner_name
      FROM 
        merchant m
      LEFT JOIN 
        user u ON m.owner_user_id = u.id
      WHERE 
        m.id = ?
    `, [id]);
    
    if (merchants.length === 0) {
      return res.status(404).json({
        success: false,
        message: '商家不存在'
      });
    }
    
    const merchant = merchants[0];
    
    // 获取商家商品列表
    const [products] = await pool.query(`
      SELECT 
        id, name, price, stock, status, created_at
      FROM 
        product
      WHERE 
        merchant_id = ?
      ORDER BY 
        created_at DESC
    `, [id]);
    
    // 获取商家评价统计
    const [feedbackStats] = await pool.query(`
      SELECT 
        AVG(rating) as avg_rating,
        COUNT(*) as feedback_count
      FROM 
        feedback
      WHERE 
        merchant_id = ?
    `, [id]);
    
    // 获取商家营业额统计
    const [revenueStats] = await pool.query(`
      SELECT 
        SUM(total_amount) as total_revenue
      FROM 
        \`order\`
      WHERE 
        merchant_id = ? AND status IN (2, 3)
    `, [id]);
    
    res.json({
      success: true,
      data: {
        merchant,
        products,
        feedbackStats: feedbackStats[0],
        revenueStats: revenueStats[0]
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 商家审核接口
 * PUT /api/admin/merchants/:id/audit
 */
exports.auditMerchant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { audit_status, audit_remark } = req.body;
    const adminId = req.user.id;
    
    if (audit_status === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少审核状态参数'
      });
    }
    
    // 更新商家审核状态
    await pool.query(
      'UPDATE merchant SET audit_status = ?, audit_remark = ?, audit_time = NOW(), audit_admin_id = ? WHERE id = ?',
      [audit_status, audit_remark, adminId, id]
    );
    
    // 审核通过后更新商家状态
    if (audit_status === 1) {
      await pool.query(
        'UPDATE merchant SET status = 1 WHERE id = ?',
        [id]
      );
      
      // 获取商家店主ID
      const [merchants] = await pool.query('SELECT owner_user_id FROM merchant WHERE id = ?', [id]);
      if (merchants.length > 0) {
        const ownerUserId = merchants[0].owner_user_id;
        // 更新用户角色为商家
        await pool.query(
          'UPDATE user SET role = 2, merchant_id = ? WHERE id = ?',
          [id, ownerUserId]
        );
        // 通知商家审核通过
        await pool.query(
          'INSERT INTO notification (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())',
          [ownerUserId, '商家审核结果', '您的商家审核已通过，现在可以登录商家后台管理您的店铺']
        );
      }
    }
    
    // 记录操作日志
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, target_merchant_id, created_at) VALUES (?, ?, ?, NOW())',
      [adminId, audit_status === 1 ? '审核通过商家' : '审核拒绝商家', id]
    );
    
    // 审核拒绝后通知商家
    if (audit_status === 2) {
      // 获取商家店主ID
      const [merchants] = await pool.query('SELECT owner_user_id FROM merchant WHERE id = ?', [id]);
      if (merchants.length > 0) {
        await pool.query(
          'INSERT INTO notification (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())',
          [merchants[0].owner_user_id, '商家审核结果', `您的商家审核已被拒绝，原因：${audit_remark}`]
        );
      }
    }
    
    res.json({
      success: true,
      message: audit_status === 1 ? '审核通过' : '审核拒绝'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新商家状态
 * PUT /api/admin/merchants/:id/status
 */
exports.updateMerchantStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;
    
    if (status === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少状态参数'
      });
    }
    
    // 更新商家状态
    await pool.query(
      'UPDATE merchant SET status = ? WHERE id = ?',
      [status, id]
    );
    
    // 记录操作日志
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, target_merchant_id, created_at) VALUES (?, ?, ?, NOW())',
      [adminId, status ? '设置商家营业' : '设置商家休息', id]
    );
    
    // 强制关闭商家后处理进行中订单
    if (!status) {
      // 标记进行中订单为异常
      await pool.query(
        'UPDATE \`order\` SET status = 4, remark = ? WHERE merchant_id = ? AND status IN (0, 1, 2)',
        ['商家已关闭', id]
      );
      
      // 通知用户
      const [orders] = await pool.query('SELECT user_id FROM \`order\` WHERE merchant_id = ? AND status = 4', [id]);
      for (const order of orders) {
        await pool.query(
          'INSERT INTO notification (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())',
          [order.user_id, '订单异常', '您的订单因商家已关闭而无法继续处理']
        );
      }
    }
    
    res.json({
      success: true,
      message: status ? '商家已设置为营业状态' : '商家已设置为休息状态'
    });
  } catch (error) {
    next(error);
  }
};