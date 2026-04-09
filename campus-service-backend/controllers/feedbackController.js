const { pool } = require('../config/db');

let _tableColumnsCache = new Map();
async function getTableColumns(tableName) {
  if (_tableColumnsCache.has(tableName)) return _tableColumnsCache.get(tableName);
  const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const set = new Set(cols.map((c) => c.Field));
  _tableColumnsCache.set(tableName, set);
  return set;
}

async function hasTableColumn(tableName, columnName) {
  try {
    const columns = await getTableColumns(tableName);
    return columns.has(columnName);
  } catch (_) {
    return false;
  }
}

function isDev() {
  return String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
}

async function getMerchantIdForCurrentUser(req, connOrPool = pool) {
  const userId = req.user && req.user.id;
  const merchantIdFromToken = req.user && req.user.merchant_id;
  if (merchantIdFromToken) return merchantIdFromToken;
  if (!userId) return null;

  const [rows] = await connOrPool.query(
    'SELECT id FROM merchant WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1',
    [userId]
  );
  return rows && rows[0] && rows[0].id ? rows[0].id : null;
}

async function insertFeedbackNotification(connOrPool, userId, title, content) {
  if (!userId) return;
  await connOrPool.query(
    'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
    [userId, title, content, 1]
  );
}

// 获取反馈列表
exports.getFeedbackList = async (req, res, next) => {
  try {
    const timeColumn = (await hasTableColumn('feedback', 'create_time'))
      ? 'create_time'
      : (await hasTableColumn('feedback', 'created_at'))
        ? 'created_at'
        : null;

    const orderBy = timeColumn ? `ORDER BY \`${timeColumn}\` DESC` : 'ORDER BY id DESC';
    const [feedbacks] = await pool.query(`SELECT * FROM feedback ${orderBy}`);
    res.json({ success: true, data: { feedbacks } });
  } catch (error) {
    next(error);
  }
};

// 创建反馈
exports.createFeedback = async (req, res, next) => {
  try {
    let { merchant_id, order_id, type, rating, content } = req.body;

    const typeNum = parseInt(type, 10);
    if (![1, 2, 3].includes(typeNum)) {
      return res.status(400).json({ success: false, message: '反馈类型不合法' });
    }

    const trimmedContent = String(content || '').trim();
    if (!trimmedContent) {
      return res.status(400).json({ success: false, message: '反馈内容不能为空' });
    }
    if (trimmedContent.length > 500) {
      return res.status(400).json({ success: false, message: '反馈内容不能超过500字符' });
    }

    const ratingNum = rating === null || rating === undefined || rating === '' ? null : parseInt(rating, 10);
    if (typeNum === 1 || typeNum === 2) {
      if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ success: false, message: '评分必须在1-5之间' });
      }
    } else if (ratingNum !== null) {
      if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ success: false, message: '评分必须在1-5之间' });
      }
    }

    const orderIdNum = order_id === null || order_id === undefined || order_id === '' ? null : parseInt(order_id, 10);
    const merchantIdNum = merchant_id === null || merchant_id === undefined || merchant_id === '' ? null : parseInt(merchant_id, 10);

    // 订单评价(type=1)：必须绑定订单，并自动从订单反查 merchant_id（保证商家端可按 merchant_id 看到订单评价）
    if (typeNum === 1) {
      if (!orderIdNum) {
        return res.status(400).json({ success: false, message: '请选择订单' });
      }

      const orderUserIdCol = (await hasTableColumn('order', 'user_id')) ? 'user_id' : null;
      const orderMerchantIdCol = (await hasTableColumn('order', 'merchant_id')) ? 'merchant_id' : null;
      if (!orderUserIdCol || !orderMerchantIdCol) {
        return res.status(500).json({ success: false, message: '订单表结构不兼容，无法创建订单评价' });
      }

      const [orders] = await pool.query(
        `SELECT id, \`${orderUserIdCol}\` as user_id, \`${orderMerchantIdCol}\` as merchant_id FROM \`order\` WHERE id = ? LIMIT 1`,
        [orderIdNum]
      );
      if (!orders || orders.length === 0) {
        return res.status(404).json({ success: false, message: '订单不存在' });
      }
      const order = orders[0];
      if (parseInt(order.user_id, 10) !== parseInt(req.user.id, 10)) {
        return res.status(403).json({ success: false, message: '无权评价该订单' });
      }
      merchant_id = order.merchant_id;
      order_id = orderIdNum;
    }

    // 商家评价(type=2)：必须指定 merchant_id
    if (typeNum === 2) {
      if (!merchantIdNum) {
        return res.status(400).json({ success: false, message: '请选择商家' });
      }
      merchant_id = merchantIdNum;
      order_id = orderIdNum;
    }

    // 平台反馈(type=3)：不需要 merchant_id/order_id
    if (typeNum === 3) {
      merchant_id = null;
      order_id = null;
    }

    const [result] = await pool.query(
      'INSERT INTO feedback (user_id, merchant_id, order_id, type, rating, content) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, merchant_id, order_id, typeNum, ratingNum, trimmedContent]
    );
    res.status(201).json({ success: true, data: { feedbackId: result.insertId } });
  } catch (error) {
    next(error);
  }
};

// 商家获取自己的反馈列表
exports.getMerchantFeedbackList = async (req, res, next) => {
  try {
    const merchantId = await getMerchantIdForCurrentUser(req, pool);
    if (!merchantId) {
      return res.status(403).json({ success: false, message: '商家身份验证失败' });
    }

    const timeColumn = (await hasTableColumn('feedback', 'create_time'))
      ? 'create_time'
      : (await hasTableColumn('feedback', 'created_at'))
        ? 'created_at'
        : null;

    const orderBy = timeColumn ? `ORDER BY f.\`${timeColumn}\` DESC` : 'ORDER BY f.id DESC';

    const userNicknameColumn = (await hasTableColumn('user', 'nickname'))
      ? 'nickname'
      : (await hasTableColumn('user', 'username'))
        ? 'username'
        : null;

    const orderNoColumn = (await hasTableColumn('order', 'order_no')) ? 'order_no' : null;

    // 隐私保护：商家端仅返回必要字段（昵称/评分/内容/回复等），不返回手机号、地址等敏感字段。
    // 权限收口：商家端不展示平台类反馈(type=3)，平台投诉/纠纷仲裁保留给管理员处理。
    const selectCols = [
      'f.id',
      (await hasTableColumn('feedback', 'type')) ? 'f.type' : 'NULL as type',
      (await hasTableColumn('feedback', 'order_id')) ? 'f.order_id' : 'NULL as order_id',
      'f.merchant_id',
      (await hasTableColumn('feedback', 'rating')) ? 'f.rating' : 'NULL as rating',
      'f.content',
      (await hasTableColumn('feedback', 'created_at'))
        ? 'f.created_at'
        : ((await hasTableColumn('feedback', 'create_time')) ? 'f.create_time' : 'NULL as created_at'),
      (await hasTableColumn('feedback', 'reply')) ? 'f.reply' : 'NULL as reply',
      (await hasTableColumn('feedback', 'reply_time')) ? 'f.reply_time' : 'NULL as reply_time',
      (await hasTableColumn('feedback', 'status')) ? 'f.status' : '0 as status'
    ];

    const userNameExpr = userNicknameColumn
      ? `COALESCE(u.\`${userNicknameColumn}\`, '匿名用户') as user_name`
      : "'匿名用户' as user_name";

    const whereParts = ['f.merchant_id = ?'];
    const params = [merchantId];
    if (await hasTableColumn('feedback', 'type')) {
      // 兼容旧数据：type 为空时也当作可见评价
      whereParts.push('(f.type IS NULL OR f.type IN (1, 2))');
    }

    const [feedbacks] = await pool.query(
      `
        SELECT
          ${selectCols.join(',\n          ')},
          ${userNameExpr},
          ${orderNoColumn ? `o.\`${orderNoColumn}\` as order_no` : 'NULL as order_no'}
        FROM feedback f
        LEFT JOIN user u ON f.user_id = u.id
        LEFT JOIN \`order\` o ON f.order_id = o.id
        WHERE ${whereParts.join(' AND ')}
        ${orderBy}
      `,
      params
    );

    res.json({ success: true, data: { feedbacks } });
  } catch (error) {
    next(error);
  }
};

// 回复反馈
exports.replyFeedback = async (req, res, next) => {
  try {
    const { reply } = req.body;
    if (!reply || !String(reply).trim()) {
      return res.status(400).json({ success: false, message: '回复内容不能为空' });
    }
    if (String(reply).length > 500) {
      return res.status(400).json({ success: false, message: '回复内容不能超过500字符' });
    }

    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ success: false, message: '反馈ID不合法' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const hasType = await hasTableColumn('feedback', 'type');
      const [rows] = await conn.query(
        `SELECT id, user_id, merchant_id${hasType ? ', type' : ''} FROM feedback WHERE id = ?`,
        [id]
      );
      if (!rows || rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: '反馈不存在' });
      }
      const feedback = rows[0];

      // 商家只能回复自己店铺的反馈；管理员可回复任意反馈。
      // 同时：平台类反馈(type=3)仅管理员可处理。
      if (req.user && req.user.role === 2) {
        if (hasType && parseInt(feedback.type, 10) === 3) {
          await conn.rollback();
          return res.status(403).json({ success: false, message: '平台类投诉需由管理员处理' });
        }
        const merchantId = await getMerchantIdForCurrentUser(req, conn);
        if (!merchantId || parseInt(feedback.merchant_id, 10) !== parseInt(merchantId, 10)) {
          await conn.rollback();
          return res.status(403).json({ success: false, message: '权限不足，只能回复自己店铺的反馈' });
        }
      }

      await conn.query(
        'UPDATE feedback SET reply = ?, reply_time = NOW(), reply_user_id = ?, status = 1 WHERE id = ?',
        [String(reply).trim(), req.user.id, id]
      );

      await insertFeedbackNotification(conn, feedback.user_id, '反馈已回复', '商家已回复您的反馈，请在“通知”中查看');

      await conn.commit();
      res.json({ success: true, message: '回复成功' });
    } catch (e) {
      await conn.rollback().catch(() => {});
      throw e;
    } finally {
      conn.release();
    }
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
    const {
      page = 1,
      pageSize = 10,
      type,
      status,
      user_id,
      merchant_id,
      startTime,
      endTime,
      keyword
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.max(1, parseInt(pageSize, 10) || 10);
    const offset = (pageNum - 1) * pageSizeNum;

    // 兼容不同表结构：有的库是 create_time，有的可能是 created_at
    const timeColumn = (await hasTableColumn('feedback', 'create_time'))
      ? 'create_time'
      : (await hasTableColumn('feedback', 'created_at'))
        ? 'created_at'
        : null;

    const merchantNameColumn = (await hasTableColumn('merchant', 'name'))
      ? 'name'
      : (await hasTableColumn('merchant', 'merchant_name'))
        ? 'merchant_name'
        : null;

    const userNicknameColumn = (await hasTableColumn('user', 'nickname'))
      ? 'nickname'
      : null;

    const orderNoColumn = (await hasTableColumn('order', 'order_no'))
      ? 'order_no'
      : null;
    
    let query = `
      SELECT 
        f.*,
        ${userNicknameColumn ? `u.\`${userNicknameColumn}\` as user_name` : 'NULL as user_name'},
        ${merchantNameColumn ? `m.\`${merchantNameColumn}\` as merchant_name` : 'NULL as merchant_name'},
        ${orderNoColumn ? `o.\`${orderNoColumn}\` as order_no` : 'NULL as order_no'}
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
    
    if (status !== undefined && status !== null && status !== '') {
      whereClause.push('f.status = ?');
      queryParams.push(parseInt(status));
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
      if (timeColumn) {
        whereClause.push(`f.\`${timeColumn}\` >= ?`);
        queryParams.push(startTime);
      }
    }
    
    if (endTime) {
      if (timeColumn) {
        whereClause.push(`f.\`${timeColumn}\` <= ?`);
        queryParams.push(endTime);
      }
    }

    if (keyword) {
      // 兼容：反馈内容/回复/用户昵称/商家名/订单号 模糊搜索
      const like = `%${keyword}%`;
      const parts = ['f.content LIKE ?'];
      queryParams.push(like);
      if (await hasTableColumn('feedback', 'reply')) {
        parts.push('f.reply LIKE ?');
        queryParams.push(like);
      }
      if (userNicknameColumn) {
        parts.push(`u.\`${userNicknameColumn}\` LIKE ?`);
        queryParams.push(like);
      }
      if (merchantNameColumn) {
        parts.push(`m.\`${merchantNameColumn}\` LIKE ?`);
        queryParams.push(like);
      }
      if (orderNoColumn) {
        parts.push(`o.\`${orderNoColumn}\` LIKE ?`);
        queryParams.push(like);
      }
      whereClause.push(`(${parts.join(' OR ')})`);
    }
    
    // 添加WHERE子句
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
      countQuery += ' WHERE ' + whereClause.join(' AND ');
    }
    
    // 添加排序和分页
    if (timeColumn) {
      query += ` ORDER BY f.\`${timeColumn}\` DESC LIMIT ? OFFSET ?`;
    } else {
      query += ' ORDER BY f.id DESC LIMIT ? OFFSET ?';
    }
    queryParams.push(pageSizeNum, offset);
    
    const [feedbacks] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    // 获取评分统计
    const [ratingStats] = await pool.query(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as total_feedbacks FROM feedback WHERE rating IS NOT NULL'
    );
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / pageSizeNum);
    
    res.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          total,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages
        },
        ratingStats: ratingStats[0]
      }
    });
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: isDev() ? error.message : undefined,
      stack: isDev() ? error.stack : undefined
    });
  }
};

/**
 * 获取反馈详情（管理员）
 * GET /api/admin/feedbacks/:id
 */
exports.getAdminFeedbackDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 兼容不同表结构（避免 Unknown column 直接 500）
    const userNicknameColumn = (await hasTableColumn('user', 'nickname'))
      ? 'nickname'
      : (await hasTableColumn('user', 'username'))
        ? 'username'
        : null;

    const userPhoneColumn = (await hasTableColumn('user', 'phone'))
      ? 'phone'
      : (await hasTableColumn('user', 'mobile'))
        ? 'mobile'
        : null;

    const merchantNameColumn = (await hasTableColumn('merchant', 'name'))
      ? 'name'
      : (await hasTableColumn('merchant', 'merchant_name'))
        ? 'merchant_name'
        : null;

    const merchantPhoneColumn = (await hasTableColumn('merchant', 'phone'))
      ? 'phone'
      : null;

    const orderNoColumn = (await hasTableColumn('order', 'order_no'))
      ? 'order_no'
      : null;

    const orderAmountColumn = (await hasTableColumn('order', 'total_amount'))
      ? 'total_amount'
      : (await hasTableColumn('order', 'total_price'))
        ? 'total_price'
        : null;

    const feedbackTimeColumn = (await hasTableColumn('feedback', 'create_time'))
      ? 'create_time'
      : (await hasTableColumn('feedback', 'created_at'))
        ? 'created_at'
        : null;
    
    // 获取反馈基本信息
    const [feedbacks] = await pool.query(`
      SELECT 
        f.*,
        ${userNicknameColumn ? `u.\`${userNicknameColumn}\` as user_name` : 'NULL as user_name'},
        ${userPhoneColumn ? `u.\`${userPhoneColumn}\` as user_phone` : 'NULL as user_phone'},
        ${merchantNameColumn ? `m.\`${merchantNameColumn}\` as merchant_name` : 'NULL as merchant_name'},
        ${merchantPhoneColumn ? `m.\`${merchantPhoneColumn}\` as merchant_phone` : 'NULL as merchant_phone'},
        ${orderNoColumn ? `o.\`${orderNoColumn}\` as order_no` : 'NULL as order_no'},
        ${orderAmountColumn ? `o.\`${orderAmountColumn}\` as order_amount` : 'NULL as order_amount'}
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
    const historyTimeSelect = feedbackTimeColumn
      ? `\`${feedbackTimeColumn}\` as create_time`
      : 'NULL as create_time';

    const historyOrderBy = feedbackTimeColumn
      ? `\`${feedbackTimeColumn}\` DESC`
      : 'id DESC';

    const [userFeedbacks] = await pool.query(`
      SELECT 
        id, type, content, rating, reply, ${historyTimeSelect}
      FROM 
        feedback
      WHERE 
        user_id = ? AND id != ?
      ORDER BY 
        ${historyOrderBy}
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
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: isDev() ? error.message : undefined,
      stack: isDev() ? error.stack : undefined
    });
  }
};

/**
 * 删除反馈（管理员）
 * DELETE /api/admin/feedbacks/:id
 */
exports.deleteAdminFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM feedback WHERE id = ?', [id]);
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '反馈不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    next(error);
  }
};

/**
 * 批量删除反馈（管理员）
 * POST /api/admin/feedbacks/batch-delete
 * body: { feedback_ids: number[] }
 */
exports.batchDeleteAdminFeedbacks = async (req, res, next) => {
  try {
    const feedbackIds = req.body && (req.body.feedback_ids || req.body.ids);
    if (!Array.isArray(feedbackIds) || feedbackIds.length === 0) {
      return res.status(400).json({ success: false, message: '缺少反馈ID列表' });
    }

    const ids = feedbackIds
      .map((x) => parseInt(x, 10))
      .filter((x) => Number.isFinite(x) && x > 0);

    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: '反馈ID列表无效' });
    }

    const [result] = await pool.query(
      `DELETE FROM feedback WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );

    res.json({
      success: true,
      message: '删除成功',
      data: { deleted: result.affectedRows || 0 }
    });
  } catch (error) {
    next(error);
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
    
    if (reply.length > 500) {
      return res.status(400).json({ success: false, message: '回复内容不能超过500字符' });
    }
    
    // 检查反馈是否存在
    const [feedbacks] = await pool.query('SELECT user_id FROM feedback WHERE id = ?', [id]);
    
    if (feedbacks.length === 0) {
      return res.status(404).json({ success: false, message: '反馈不存在' });
    }
    
    const feedback = feedbacks[0];
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE feedback SET reply = ?, reply_time = NOW(), reply_user_id = ?, status = 1 WHERE id = ?',
        [reply, adminId, id]
      );

      await conn.query(
        'INSERT INTO admin_operation_log (admin_id, operation, target_user_id, created_at) VALUES (?, ?, ?, NOW())',
        [adminId, '回复反馈', feedback.user_id]
      );

      await insertFeedbackNotification(conn, feedback.user_id, '反馈已回复', '您的反馈已收到回复，请在“通知”中查看');

      await conn.commit();
      res.json({ success: true, message: '回复成功' });
    } catch (transactionError) {
      await conn.rollback().catch(() => {});
      console.error('回复反馈失败:', transactionError);
      res.status(500).json({
        success: false,
        message: '回复反馈失败',
        error: isDev() ? transactionError.message : undefined
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('回复反馈失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 驳回反馈（管理员）
 * PUT /api/admin/feedbacks/:id/reject
 */
exports.rejectAdminFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    console.log('Reject feedback request:', { id, reason, adminId, body: req.body });
    
    if (!reason) {
      console.log('Reject reason is empty');
      return res.status(400).json({ success: false, message: '驳回原因不能为空' });
    }
    
    if (reason.length > 500) {
      return res.status(400).json({ success: false, message: '驳回原因不能超过500字符' });
    }
    
    // 检查反馈是否存在
    const [feedbacks] = await pool.query('SELECT user_id FROM feedback WHERE id = ?', [id]);
    
    if (feedbacks.length === 0) {
      return res.status(404).json({ success: false, message: '反馈不存在' });
    }
    
    const feedback = feedbacks[0];
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE feedback SET reject_reason = ?, reply_time = NOW(), reply_user_id = ?, status = 2 WHERE id = ?',
        [reason, adminId, id]
      );

      await conn.query(
        'INSERT INTO admin_operation_log (admin_id, operation, target_user_id, created_at) VALUES (?, ?, ?, NOW())',
        [adminId, '驳回反馈', feedback.user_id]
      );

      await insertFeedbackNotification(conn, feedback.user_id, '反馈已驳回', '您的反馈已被驳回，请在“通知”中查看');

      await conn.commit();
      res.json({ success: true, message: '驳回成功' });
    } catch (transactionError) {
      await conn.rollback().catch(() => {});
      console.error('驳回反馈事务错误:', transactionError);
      res.status(500).json({
        success: false,
        message: '驳回反馈失败',
        error: isDev() ? transactionError.message : undefined
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('驳回反馈外层错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message,
      stack: error.stack 
    });
  }
};