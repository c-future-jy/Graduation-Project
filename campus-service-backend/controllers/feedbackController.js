const { pool } = require('../config/db');

// 获取反馈列表
exports.getFeedbackList = async (req, res, next) => {
  try {
    const [feedbacks] = await pool.query('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json({ success: true, data: { feedbacks } });
  } catch (error) {
    next(error);
  }
};

// 创建反馈
exports.createFeedback = async (req, res, next) => {
  try {
    const { merchant_id, order_id, type, rating, content } = req.body;
    const [result] = await pool.query(
      'INSERT INTO feedback (user_id, merchant_id, order_id, type, rating, content) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, merchant_id, order_id, type, rating, content]
    );
    res.status(201).json({ success: true, data: { feedbackId: result.insertId } });
  } catch (error) {
    next(error);
  }
};

// 回复反馈
exports.replyFeedback = async (req, res, next) => {
  try {
    const { reply } = req.body;
    await pool.query(
      'UPDATE feedback SET reply = ?, reply_time = NOW() WHERE id = ?',
      [reply, req.params.id]
    );
    res.json({ success: true, message: '回复成功' });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取反馈列表（管理员）
 * GET /api/admin/feedbacks
 */
exports.getAdminFeedbackList = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, type, status, user_id, merchant_id, startTime, endTime } = req.query;
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT 
        f.*,
        u.nickname as user_name,
        m.name as merchant_name,
        o.order_no as order_no,
        CASE WHEN f.reply IS NULL THEN 0 ELSE 1 END as reply_status
      FROM 
        feedback f
      LEFT JOIN 
        user u ON f.user_id = u.id
      LEFT JOIN 
        merchant m ON f.merchant_id = m.id
      LEFT JOIN 
        \`order\` o ON f.order_id = o.id
    `;
    let countQuery = `
      SELECT 
        COUNT(*) as total
      FROM 
        feedback f
      LEFT JOIN 
        user u ON f.user_id = u.id
      LEFT JOIN 
        merchant m ON f.merchant_id = m.id
      LEFT JOIN 
        \`order\` o ON f.order_id = o.id
    `;
    let queryParams = [];
    let whereClause = [];
    
    // 构建筛选条件
    if (type) {
      whereClause.push('f.type = ?');
      queryParams.push(type);
    }
    
    if (status !== undefined) {
      if (status == 0) {
        whereClause.push('f.reply IS NULL');
      } else if (status == 1) {
        whereClause.push('f.reply IS NOT NULL');
      }
    }
    
    if (user_id) {
      whereClause.push('f.user_id = ?');
      queryParams.push(user_id);
    }
    
    if (merchant_id) {
      whereClause.push('f.merchant_id = ?');
      queryParams.push(merchant_id);
    }
    
    if (startTime) {
      whereClause.push('f.created_at >= ?');
      queryParams.push(startTime);
    }
    
    if (endTime) {
      whereClause.push('f.created_at <= ?');
      queryParams.push(endTime);
    }
    
    // 添加WHERE子句
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
      countQuery += ' WHERE ' + whereClause.join(' AND ');
    }
    
    // 添加排序和分页
    query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), parseInt(offset));
    
    const [feedbacks] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    // 获取评分统计
    const [ratingStats] = await pool.query(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as total_feedbacks FROM feedback'
    );
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(pageSize));
    
    res.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages
        },
        ratingStats: ratingStats[0]
      }
    });
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 获取反馈详情（管理员）
 * GET /api/admin/feedbacks/:id
 */
exports.getAdminFeedbackDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 获取反馈基本信息
    const [feedbacks] = await pool.query(`
      SELECT 
        f.*,
        u.nickname as user_name,
        u.phone as user_phone,
        m.name as merchant_name,
        m.phone as merchant_phone,
        o.order_no as order_no,
        o.total_amount as order_amount
      FROM 
        feedback f
      LEFT JOIN 
        user u ON f.user_id = u.id
      LEFT JOIN 
        merchant m ON f.merchant_id = m.id
      LEFT JOIN 
        \`order\` o ON f.order_id = o.id
      WHERE 
        f.id = ?
    `, [id]);
    
    if (feedbacks.length === 0) {
      return res.status(404).json({ success: false, message: '反馈不存在' });
    }
    
    const feedback = feedbacks[0];
    
    // 获取用户的历史反馈记录
    const [userFeedbacks] = await pool.query(`
      SELECT 
        id, type, content, rating, reply, created_at
      FROM 
        feedback
      WHERE 
        user_id = ? AND id != ?
      ORDER BY 
        created_at DESC
      LIMIT 5
    `, [feedback.user_id, id]);
    
    res.json({
      success: true,
      data: {
        feedback,
        userFeedbacks
      }
    });
  } catch (error) {
    console.error('获取反馈详情失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 回复反馈（管理员）
 * PUT /api/admin/feedbacks/:id/reply
 */
exports.replyAdminFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    const adminId = req.user.id;
    
    if (!reply) {
      return res.status(400).json({ success: false, message: '回复内容不能为空' });
    }
    
    // 检查反馈是否存在
    const [feedbacks] = await pool.query('SELECT user_id FROM feedback WHERE id = ?', [id]);
    
    if (feedbacks.length === 0) {
      return res.status(404).json({ success: false, message: '反馈不存在' });
    }
    
    const feedback = feedbacks[0];
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 更新反馈回复
      await pool.query(
        'UPDATE feedback SET reply = ?, reply_time = NOW(), reply_admin_id = ? WHERE id = ?',
        [reply, adminId, id]
      );
      
      // 记录操作日志
      await pool.query(
        'INSERT INTO admin_operation_log (admin_id, operation, target_feedback_id, created_at) VALUES (?, ?, ?, NOW())',
        [adminId, '回复反馈', id]
      );
      
      // 通知用户
      await pool.query(
        'INSERT INTO notification (user_id, title, content, created_at) VALUES (?, ?, ?, NOW())',
        [feedback.user_id, '反馈已回复', '您的反馈已收到回复，请查看']
      );
      
      // 提交事务
      await pool.query('COMMIT');
      
      res.json({ success: true, message: '回复成功' });
    } catch (transactionError) {
      // 回滚事务
      await pool.query('ROLLBACK');
      console.error('回复反馈失败:', transactionError);
      res.status(500).json({ success: false, message: '回复反馈失败' });
    }
  } catch (error) {
    console.error('回复反馈失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};