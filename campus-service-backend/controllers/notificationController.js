const { pool } = require('../config/db');

// 获取通知列表
exports.getNotificationList = async (req, res, next) => {
  try {
    const [notifications] = await pool.query(
      'SELECT * FROM notification WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, data: { notifications } });
  } catch (error) {
    next(error);
  }
};

// 标记为已读
exports.markAsRead = async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notification SET is_read = 1, read_time = NOW() WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: '已标记为已读' });
  } catch (error) {
    next(error);
  }
};

// 标记全部为已读
exports.markAllAsRead = async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notification SET is_read = 1, read_time = NOW() WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ success: true, message: '全部已标记为已读' });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取通知列表（管理员）
 * GET /api/admin/notifications
 */
exports.getAdminNotificationList = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, type, user_id, is_read, startTime, endTime, keyword } = req.query;
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT 
        n.*,
        u.nickname as user_name,
        (SELECT COUNT(*) FROM notification WHERE id = n.id) as total_count,
        (SELECT COUNT(*) FROM notification WHERE id = n.id AND is_read = 1) as read_count
      FROM 
        notification n
      LEFT JOIN 
        user u ON n.user_id = u.id
    `;
    let countQuery = `
      SELECT 
        COUNT(*) as total
      FROM 
        notification n
      LEFT JOIN 
        user u ON n.user_id = u.id
    `;
    let queryParams = [];
    let whereClause = [];
    
    // 构建筛选条件
    if (type) {
      whereClause.push('n.type = ?');
      queryParams.push(type);
    }
    
    if (user_id) {
      whereClause.push('n.user_id = ?');
      queryParams.push(user_id);
    }
    
    if (is_read !== undefined && is_read !== '') {
      whereClause.push('n.is_read = ?');
      queryParams.push(is_read);
    }
    
    if (startTime) {
      whereClause.push('n.created_at >= ?');
      queryParams.push(startTime);
    }
    
    if (endTime) {
      whereClause.push('n.created_at <= ?');
      queryParams.push(endTime);
    }
    
    if (keyword) {
      whereClause.push('(n.title LIKE ? OR n.content LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    // 添加WHERE子句
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
      countQuery += ' WHERE ' + whereClause.join(' AND ');
    }
    
    // 添加排序和分页
    query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), parseInt(offset));
    
    const [notifications] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    // 计算已读/未读数量
    const [readStats] = await pool.query(
      'SELECT COUNT(*) as total, SUM(is_read) as read_count FROM notification'
    );
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(pageSize));
    
    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages
        },
        readStats: {
          total: readStats[0].total,
          readCount: readStats[0].read_count,
          unreadCount: readStats[0].total - readStats[0].read_count,
          readRate: readStats[0].total > 0 ? (readStats[0].read_count / readStats[0].total * 100).toFixed(2) + '%' : '0%'
        }
      }
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 发布通知（管理员）
 * POST /api/admin/notifications
 */
exports.createAdminNotification = async (req, res, next) => {
  try {
    const { title, content, type, receive_scope, user_ids, role_ids, scheduled_time } = req.body;
    const adminId = req.user.id;
    
    if (!title || !content) {
      return res.status(400).json({ success: false, message: '标题和内容不能为空' });
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      let notificationIds = [];
      
      if (receive_scope === 'all_users') {
        // 发送给所有用户
        const [users] = await pool.query('SELECT id FROM user');
        for (const user of users) {
          const [result] = await pool.query(
            'INSERT INTO notification (user_id, title, content, type, created_at, scheduled_time) VALUES (?, ?, ?, ?, NOW(), ?)',
            [user.id, title, content, type, scheduled_time]
          );
          notificationIds.push(result.insertId);
        }
      } else if (receive_scope === 'specific_users' && user_ids && Array.isArray(user_ids)) {
        // 发送给指定用户
        for (const userId of user_ids) {
          const [result] = await pool.query(
            'INSERT INTO notification (user_id, title, content, type, created_at, scheduled_time) VALUES (?, ?, ?, ?, NOW(), ?)',
            [userId, title, content, type, scheduled_time]
          );
          notificationIds.push(result.insertId);
        }
      } else if (receive_scope === 'specific_roles' && role_ids && Array.isArray(role_ids)) {
        // 发送给指定角色
        for (const roleId of role_ids) {
          const [users] = await pool.query('SELECT id FROM user WHERE role = ?', [roleId]);
          for (const user of users) {
            const [result] = await pool.query(
              'INSERT INTO notification (user_id, title, content, type, created_at, scheduled_time) VALUES (?, ?, ?, ?, NOW(), ?)',
              [user.id, title, content, type, scheduled_time]
            );
            notificationIds.push(result.insertId);
          }
        }
      }
      
      // 记录操作日志
      await pool.query(
        'INSERT INTO admin_operation_log (admin_id, operation, created_at) VALUES (?, ?, NOW())',
        [adminId, `发布通知，共发送 ${notificationIds.length} 条`]
      );
      
      // 提交事务
      await pool.query('COMMIT');
      
      res.json({
        success: true,
        message: `通知发布成功，共发送 ${notificationIds.length} 条`,
        data: { notificationIds }
      });
    } catch (transactionError) {
      // 回滚事务
      await pool.query('ROLLBACK');
      console.error('发布通知失败:', transactionError);
      res.status(500).json({ success: false, message: '发布通知失败' });
    }
  } catch (error) {
    console.error('发布通知失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 删除通知（管理员）
 * DELETE /api/admin/notifications/:id
 */
exports.deleteAdminNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    // 软删除
    await pool.query(
      'UPDATE notification SET deleted_at = NOW() WHERE id = ?',
      [id]
    );
    
    // 记录操作日志
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, created_at) VALUES (?, ?, NOW())',
      [adminId, '删除通知']
    );
    
    res.json({ success: true, message: '通知已删除' });
  } catch (error) {
    console.error('删除通知失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 批量删除通知（管理员）
 * POST /api/admin/notifications/batch-delete
 */
exports.batchDeleteAdminNotifications = async (req, res, next) => {
  try {
    const { notification_ids } = req.body;
    const adminId = req.user.id;
    
    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return res.status(400).json({ success: false, message: '缺少通知ID列表' });
    }
    
    // 软删除
    await pool.query(
      'UPDATE notification SET deleted_at = NOW() WHERE id IN (?)',
      [notification_ids]
    );
    
    // 记录操作日志
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, created_at) VALUES (?, ?, NOW())',
      [adminId, `批量删除通知，共 ${notification_ids.length} 条`]
    );
    
    res.json({ success: true, message: `成功删除 ${notification_ids.length} 条通知` });
  } catch (error) {
    console.error('批量删除通知失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};