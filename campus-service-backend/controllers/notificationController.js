const { pool } = require('../config/db');

let _notificationColumnsCache = null;
async function getNotificationColumns() {
  if (_notificationColumnsCache) return _notificationColumnsCache;
  const [cols] = await pool.query('SHOW COLUMNS FROM notification');
  _notificationColumnsCache = new Set(cols.map((c) => c.Field));
  return _notificationColumnsCache;
}

async function hasNotificationColumn(columnName) {
  try {
    const columns = await getNotificationColumns();
    return columns.has(columnName);
  } catch (e) {
    return false;
  }
}

// 通知类型：数据库使用 tinyint，这里统一做映射（兼容历史数据）
// 说明：已通过现有数据确认 type=1 用于“反馈”通知。
const NOTIFICATION_TYPE_CODE = Object.freeze({
  feedback: 1,
  system: 2,
  order: 3,
  merchant: 4,
  platform: 5,
  activity: 6
});

const NOTIFICATION_TYPE_LABEL = Object.freeze({
  1: '反馈',
  2: '系统公告',
  3: '订单',
  4: '商家',
  5: '平台',
  6: '活动提醒'
});

function normalizeNotificationType(type) {
  if (type === undefined || type === null || type === '') return null;

  // number or numeric string
  if (typeof type === 'number' && Number.isFinite(type)) return type;
  const typeStr = String(type).trim();
  if (/^\d+$/.test(typeStr)) return Number(typeStr);

  // string key mapping
  const lowered = typeStr.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPE_CODE, lowered)) {
    return NOTIFICATION_TYPE_CODE[lowered];
  }

  return null;
}

function formatNotificationTypeLabel(type) {
  const code = normalizeNotificationType(type);
  return NOTIFICATION_TYPE_LABEL[code] || '未知类型';
}

// 获取通知列表
exports.getNotificationList = async (req, res, next) => {
  try {
    const supportsDeletedAt = await hasNotificationColumn('deleted_at');
    const sql = supportsDeletedAt
      ? 'SELECT * FROM notification WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC'
      : 'SELECT * FROM notification WHERE user_id = ? ORDER BY created_at DESC';
    const [notifications] = await pool.query(sql, [req.user.id]);
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

    const supportsDeletedAt = await hasNotificationColumn('deleted_at');
    
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

    if (supportsDeletedAt) {
      whereClause.push('n.deleted_at IS NULL');
    }
    
    // 构建筛选条件
    if (type) {
      const typeCode = normalizeNotificationType(type);
      whereClause.push('n.type = ?');
      queryParams.push(typeCode !== null ? typeCode : type);
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

    // 后端直接提供格式化类型，前端可直接展示
    const processedNotifications = Array.isArray(notifications)
      ? notifications.map((n) => ({
          ...n,
          formattedType: formatNotificationTypeLabel(n.type)
        }))
      : [];
    
    // 计算已读/未读数量
    const readStatsSql = supportsDeletedAt
      ? 'SELECT COUNT(*) as total, SUM(is_read) as read_count FROM notification WHERE deleted_at IS NULL'
      : 'SELECT COUNT(*) as total, SUM(is_read) as read_count FROM notification';
    const [readStats] = await pool.query(readStatsSql);
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(pageSize));
    
    res.json({
      success: true,
      data: {
        notifications: processedNotifications,
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

    const typeCode = normalizeNotificationType(type);
    
    if (!title || !content) {
      return res.status(400).json({ success: false, message: '标题和内容不能为空' });
    }

    if (typeCode === null) {
      return res.status(400).json({ success: false, message: '通知类型不合法' });
    }
    
    // 兼容：前端未传 receive_scope 时，默认为 all_users
    const normalizedReceiveScope = receive_scope || 'all_users';

    // 事务必须使用同一连接，不能用 pool.query 直接 START TRANSACTION
    const supportsScheduledTime = await hasNotificationColumn('scheduled_time');
    const insertSql = supportsScheduledTime
      ? 'INSERT INTO notification (user_id, title, content, type, created_at, scheduled_time) VALUES (?, ?, ?, ?, NOW(), ?)'
      : 'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())';

    const buildInsertParams = (userId) => {
      const base = [userId, title, content, typeCode];
      return supportsScheduledTime ? [...base, scheduled_time] : base;
    };

    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      let notificationIds = [];

      if (normalizedReceiveScope === 'all_users') {
        const [users] = await conn.query('SELECT id FROM user');
        for (const user of users) {
          const [result] = await conn.query(insertSql, buildInsertParams(user.id));
          notificationIds.push(result.insertId);
        }
      } else if (normalizedReceiveScope === 'specific_users' && Array.isArray(user_ids)) {
        for (const userId of user_ids) {
          const [result] = await conn.query(insertSql, buildInsertParams(userId));
          notificationIds.push(result.insertId);
        }
      } else if (normalizedReceiveScope === 'specific_roles' && Array.isArray(role_ids)) {
        for (const roleId of role_ids) {
          const [users] = await conn.query('SELECT id FROM user WHERE role = ?', [roleId]);
          for (const user of users) {
            const [result] = await conn.query(insertSql, buildInsertParams(user.id));
            notificationIds.push(result.insertId);
          }
        }
      } else {
        await conn.rollback();
        return res.status(400).json({ success: false, message: '接收范围不合法' });
      }

      if (notificationIds.length === 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: '没有匹配到任何接收用户' });
      }

      await conn.query(
        'INSERT INTO admin_operation_log (admin_id, operation, created_at) VALUES (?, ?, NOW())',
        [adminId, `发布通知，共发送 ${notificationIds.length} 条`]
      );

      await conn.commit();

      return res.json({
        success: true,
        message: `通知发布成功，共发送 ${notificationIds.length} 条`,
        data: { notificationIds }
      });
    } catch (transactionError) {
      if (conn) {
        await conn.rollback().catch(() => {});
      }
      console.error('发布通知失败:', transactionError);
      return res.status(500).json({
        success: false,
        message: '发布通知失败',
        error: transactionError && transactionError.message ? transactionError.message : undefined
      });
    } finally {
      if (conn) conn.release();
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

    const supportsDeletedAt = await hasNotificationColumn('deleted_at');
    if (supportsDeletedAt) {
      // 软删除
      await pool.query(
        'UPDATE notification SET deleted_at = NOW() WHERE id = ?',
        [id]
      );
    } else {
      // 兼容旧表结构：硬删除
      await pool.query('DELETE FROM notification WHERE id = ?', [id]);
    }
    
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
 * 标记通知为已读（管理员）
 * PUT /api/admin/notifications/:id/read
 */
exports.markAdminNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const supportsDeletedAt = await hasNotificationColumn('deleted_at');
    const sql = supportsDeletedAt
      ? 'UPDATE notification SET is_read = 1, read_time = NOW() WHERE id = ? AND deleted_at IS NULL'
      : 'UPDATE notification SET is_read = 1, read_time = NOW() WHERE id = ?';
    const [result] = await pool.query(sql, [id]);

    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, created_at) VALUES (?, ?, NOW())',
      [adminId, '标记通知已读']
    );

    res.json({ success: true, message: '已标记为已读', data: { affectedRows: result.affectedRows } });
  } catch (error) {
    console.error('标记通知已读失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 批量标记通知为已读（管理员）
 * POST /api/admin/notifications/batch-read
 */
exports.batchMarkAdminNotificationsAsRead = async (req, res, next) => {
  try {
    const { notification_ids } = req.body;
    const adminId = req.user.id;

    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return res.status(400).json({ success: false, message: '缺少通知ID列表' });
    }

    const supportsDeletedAt = await hasNotificationColumn('deleted_at');
    const sql = supportsDeletedAt
      ? 'UPDATE notification SET is_read = 1, read_time = NOW() WHERE id IN (?) AND deleted_at IS NULL'
      : 'UPDATE notification SET is_read = 1, read_time = NOW() WHERE id IN (?)';
    const [result] = await pool.query(sql, [notification_ids]);

    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, created_at) VALUES (?, ?, NOW())',
      [adminId, `批量标记通知已读，共 ${notification_ids.length} 条`]
    );

    res.json({ success: true, message: `成功标记 ${notification_ids.length} 条为已读`, data: { affectedRows: result.affectedRows } });
  } catch (error) {
    console.error('批量标记通知已读失败:', error);
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
    
    const supportsDeletedAt = await hasNotificationColumn('deleted_at');
    if (supportsDeletedAt) {
      // 软删除
      await pool.query(
        'UPDATE notification SET deleted_at = NOW() WHERE id IN (?)',
        [notification_ids]
      );
    } else {
      // 兼容旧表结构：硬删除
      await pool.query('DELETE FROM notification WHERE id IN (?)', [notification_ids]);
    }
    
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