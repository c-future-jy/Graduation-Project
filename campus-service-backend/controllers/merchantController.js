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

// 获取商家列表
exports.getMerchantList = async (req, res, next) => {
  try {
    const { category } = req.query;
    const keyword = String(req.query.keyword ?? req.query.q ?? '').trim();
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

    // 关键词搜索（商家名/描述）
    if (keyword) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
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
    // 仅允许查看“营业中/已上架”的商家；审核字段存在时，仅展示已通过审核的商家
    const [auditCols] = await pool.query(
      `SELECT COUNT(*) as cnt
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_status'`
    );
    const hasAuditStatus = (auditCols[0] && auditCols[0].cnt > 0) || false;
    const sql = hasAuditStatus
      ? 'SELECT * FROM merchant WHERE id = ? AND status = 1 AND audit_status = 2'
      : 'SELECT * FROM merchant WHERE id = ? AND status = 1';

    const [merchants] = await pool.query(sql, [req.params.id]);
    if (merchants.length === 0) {
      return res.status(404).json({ success: false, message: '商家不存在' });
    }
    res.json({ success: true, data: { merchant: merchants[0] } });
  } catch (error) {
    next(error);
  }
};

// 获取当前登录用户的商家信息（商家端）
// GET /api/merchants/me
exports.getMyMerchant = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权访问' });
    }

    // 返回该用户名下的最新商家记录（不强制 status/audit_status 过滤，便于商家端管理）
    const [rows] = await pool.query(
      'SELECT * FROM merchant WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '未找到商家信息' });
    }

    res.json({ success: true, data: { merchant: rows[0] } });
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
    const merchantId = parseInt(req.params.id, 10);
    if (!merchantId) {
      return res.status(400).json({ success: false, message: '商家ID不合法' });
    }

    const [existingRows] = await pool.query('SELECT id, owner_user_id FROM merchant WHERE id = ?', [merchantId]);
    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({ success: false, message: '商家不存在' });
    }

    // 商家仅允许更新自己的店铺；管理员可更新任意店铺
    if (req.user && req.user.role === 2) {
      const ownerUserId = existingRows[0].owner_user_id;
      if (!ownerUserId || parseInt(ownerUserId, 10) !== parseInt(req.user.id, 10)) {
        return res.status(403).json({ success: false, message: '权限不足，只能修改自己的店铺信息' });
      }
    }

    // 兼容不同数据库结构：按实际存在列动态更新
    const [merchantColumns] = await pool.query(
      `SELECT column_name AS column_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'merchant'`
    );
    const colSet = new Set(
      (merchantColumns || [])
        .map((r) => (r && (r.column_name || r.COLUMN_NAME || r.Column_name || r.COLUMNNAME)) || null)
        .filter(Boolean)
        .map((c) => String(c).toLowerCase())
    );

    if (colSet.size === 0) {
      return res.status(500).json({ success: false, message: '商家表结构异常，无法更新' });
    }

    const body = req.body || {};
    const candidates = [
      ['name', body.name],
      ['logo', body.logo],
      ['description', body.description],
      ['address', body.address],
      ['phone', body.phone],
      ['status', body.status]
    ];

    const setParts = [];
    const params = [];
    for (const [field, value] of candidates) {
      if (!colSet.has(field)) continue;
      if (value === undefined) continue;
      setParts.push(`${field} = ?`);
      params.push(value);
    }

    if (colSet.has('updated_at')) {
      setParts.push('updated_at = NOW()');
    }

    if (setParts.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    const sql = `UPDATE merchant SET ${setParts.join(', ')} WHERE id = ?`;
    params.push(merchantId);
    await pool.query(sql, params);

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
    // 兼容：不同数据库版本 merchant 表字段不完全一致（phone/address/audit_status 等），按实际字段动态插入
    const [merchantColumns] = await pool.query(
      `SELECT column_name AS column_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'merchant'`
    );

    const getColumnName = (row) =>
      row &&
      (row.column_name || row.COLUMN_NAME || row.Column_name || row.columnName || row.COLUMNNAME);

    const columnSet = new Set((merchantColumns || []).map(getColumnName).filter(Boolean));

    if (columnSet.size === 0) {
      return res.status(500).json({
        success: false,
        message: 'merchant 表不存在或无法读取表结构',
        error:
          process.env.NODE_ENV === 'production'
            ? undefined
            : 'information_schema.columns 查询结果为空（可能是表名不一致、表未创建或账号无权限）'
      });
    }

    const insertColumns = [];
    const insertPlaceholders = [];
    const insertParams = [];

    const addParamColumn = (columnName, value) => {
      if (!columnSet.has(columnName)) return;
      insertColumns.push(columnName);
      insertPlaceholders.push('?');
      insertParams.push(value);
    };

    const addRawColumn = (columnName, rawExpression) => {
      if (!columnSet.has(columnName)) return;
      insertColumns.push(columnName);
      insertPlaceholders.push(rawExpression);
    };

    // 最小必要字段
    addParamColumn('owner_user_id', user_id);
    addParamColumn('name', nickname);
    addParamColumn('status', 0);

    // 可选字段：若存在且可能为必填，尽量给出默认值以避免 NOT NULL 报错
    addParamColumn('phone', phone || '');
    addParamColumn('address', '');
    addParamColumn('description', '');
    addParamColumn('logo', '');

    // 审核字段（存在则写入待审核）
    addParamColumn('audit_status', 1);

    // 时间字段（若存在则写入 NOW()，避免无默认值导致失败）
    addRawColumn('created_at', 'NOW()');
    addRawColumn('updated_at', 'NOW()');

    if (insertColumns.length === 0) {
      return res.status(500).json({
        success: false,
        message: '商家表结构异常，无法提交申请',
        error:
          process.env.NODE_ENV === 'production'
            ? undefined
            : '无法从 information_schema 解析 merchant 表列名（可能是字段名大小写差异）'
      });
    }

    const insertSql = `INSERT INTO merchant (${insertColumns.join(', ')}) VALUES (${insertPlaceholders.join(', ')})`;
    const [result] = await pool.query(insertSql, insertParams);

    // 操作日志：可选（缺表/字段时不影响主流程）
    try {
      const [tables] = await pool.query("SHOW TABLES LIKE 'admin_operation_log'");
      const logTableExists = Array.isArray(tables) && tables.length > 0;
      if (logTableExists) {
        await pool.query(
          'INSERT INTO admin_operation_log (admin_id, operation, target_user_id, created_at) VALUES (?, ?, ?, NOW())',
          [user_id, '用户申请成为商家', user_id]
        );
      }
    } catch (_) {
      // ignore
    }

    res.json({
      success: true,
      message: '申请提交成功，等待管理员审核',
      data: {
        merchantId: result && result.insertId
      }
    });
  } catch (error) {
    console.error('申请成为商家失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};



/**
 * 获取商家列表（管理员）
 * GET /api/admin/merchants
 */
exports.getAdminMerchantList = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, status, audit_status, keyword, category_id } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.max(parseInt(pageSize, 10) || 10, 1);
    const offset = (safePage - 1) * safePageSize;

    const columnExists = async (tableName, columnName) => {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as cnt
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [tableName, columnName]
      );
      return (rows[0] && rows[0].cnt > 0) || false;
    };

    const isProvided = (value) => value !== undefined && value !== null && value !== '';
    
    let query = `
      SELECT 
        m.*,
        u.nickname as owner_name,
        COUNT(DISTINCT p.id) as product_count,
        COUNT(DISTINCT o.id) as order_count
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
    if (isProvided(status)) {
      whereClause.push('m.status = ?');
      queryParams.push(status);
    }
    
    if (isProvided(audit_status)) {
      const hasAuditStatus = await columnExists('merchant', 'audit_status');
      if (hasAuditStatus) {
        whereClause.push('m.audit_status = ?');
        queryParams.push(audit_status);
      }
    }
    
    if (keyword && String(keyword).trim()) {
      whereClause.push('(m.name LIKE ? OR m.description LIKE ? OR u.nickname LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    if (isProvided(category_id)) {
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
    queryParams.push(safePageSize, offset);
    
    const [merchants] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / safePageSize);
    
    res.json({
      success: true,
      data: {
        merchants,
        pagination: {
          total,
          page: safePage,
          pageSize: safePageSize,
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

    const columnExists = async (tableName, columnName) => {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as cnt
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [tableName, columnName]
      );
      return (rows[0] && rows[0].cnt > 0) || false;
    };
    
    // 获取商家基本信息
    const [merchants] = await pool.query(`
      SELECT 
        m.*,
        u.id as owner_id,
        u.nickname as owner_name,
        u.phone as owner_phone,
        u.username as owner_username,
        u.role as owner_role
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

    const owner = merchant.owner_id ? {
      id: merchant.owner_id,
      nickname: merchant.owner_name || null,
      phone: merchant.owner_phone || null,
      username: merchant.owner_username || null,
      role: merchant.owner_role
    } : null;
    
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

    // 获取商家订单统计
    const [orderStatsRows] = await pool.query(`
      SELECT
        COUNT(*) as order_count,
        SUM(total_amount) as order_amount,
        SUM(CASE WHEN status IN (2, 3) THEN 1 ELSE 0 END) as finished_count,
        SUM(CASE WHEN status IN (0, 1) THEN 1 ELSE 0 END) as processing_count
      FROM
        \`order\`
      WHERE
        merchant_id = ?
    `, [id]);

    // 获取用户评价反馈（type=2 商家评价）
    // 兼容：不同库里时间字段可能叫 create_time 或 created_at
    const feedbackTimeCol = (await columnExists('feedback', 'create_time'))
      ? 'create_time'
      : (await columnExists('feedback', 'created_at'))
        ? 'created_at'
        : null;

    const feedbackTimeSelect = feedbackTimeCol ? `f.\`${feedbackTimeCol}\` as created_at` : 'NULL as created_at';
    const feedbackOrderBy = feedbackTimeCol ? `f.\`${feedbackTimeCol}\` DESC` : 'f.id DESC';

    const [feedbacks] = await pool.query(`
      SELECT
        f.id,
        f.rating,
        f.content,
        f.reply,
        f.status,
        ${feedbackTimeSelect},
        u.nickname as user_name
      FROM
        feedback f
      LEFT JOIN
        user u ON f.user_id = u.id
      WHERE
        f.merchant_id = ? AND f.type = 2
      ORDER BY
        ${feedbackOrderBy}
      LIMIT 20
    `, [id]);
    
    res.json({
      success: true,
      data: {
        merchant,
        owner,
        products,
        feedbackStats: feedbackStats[0],
        revenueStats: revenueStats[0],
        orderStats: orderStatsRows[0],
        feedbacks
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
  const NOTIFICATION_TYPE_MERCHANT = 4;

  let conn;
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

    const auditStatusInt = parseInt(audit_status, 10);
    // 约定：1 待审核；2 已通过；3 已拒绝
    // 兼容旧调用：若传 1 表示“通过”，则映射为 2
    const normalizedAuditStatus = auditStatusInt === 1 ? 2 : auditStatusInt;

    if (![2, 3].includes(normalizedAuditStatus)) {
      return res.status(400).json({
        success: false,
        message: '非法的审核状态'
      });
    }

    // 事务必须使用同一连接，不能用 pool.query 直接 START TRANSACTION
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const columnExists = async (tableName, columnName) => {
      const [rows] = await conn.query(
        `SELECT COUNT(*) as cnt
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [tableName, columnName]
      );
      return (rows[0] && rows[0].cnt > 0) || false;
    };

    const [merchants] = await conn.query(
      'SELECT id, owner_user_id FROM merchant WHERE id = ?',
      [id]
    );
    if (!merchants || merchants.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: '商家不存在'
      });
    }

    const ownerUserId = merchants[0].owner_user_id;
    const remarkText = audit_remark || '';

    // 更新商家审核状态
    await conn.query(
      'UPDATE merchant SET audit_status = ?, audit_remark = ?, audit_time = NOW(), audit_admin_id = ? WHERE id = ?',
      [normalizedAuditStatus, remarkText, adminId, id]
    );

    if (normalizedAuditStatus === 2) {
      // 审核通过后更新商家状态
      await conn.query('UPDATE merchant SET status = 1 WHERE id = ?', [id]);

      if (ownerUserId) {
        // 更新用户角色为商家
        const userHasMerchantId = await columnExists('user', 'merchant_id');
        if (userHasMerchantId) {
          await conn.query(
            'UPDATE user SET role = 2, merchant_id = ? WHERE id = ?',
            [id, ownerUserId]
          );
        } else {
          await conn.query('UPDATE user SET role = 2 WHERE id = ?', [ownerUserId]);
        }
        // 通知商家审核通过（notification.type 必填）
        await conn.query(
          'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
          [
            ownerUserId,
            '商家审核结果',
            '您的商家审核已通过，现在可以登录商家后台管理您的店铺',
            NOTIFICATION_TYPE_MERCHANT
          ]
        );
      }
    }

    if (normalizedAuditStatus === 3 && ownerUserId) {
      // 审核拒绝后通知商家（notification.type 必填）
      await conn.query(
        'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
        [
          ownerUserId,
          '商家审核结果',
          `您的商家审核已被拒绝，原因：${remarkText || '无'}`,
          NOTIFICATION_TYPE_MERCHANT
        ]
      );
    }

    // 记录操作日志：可选（缺表时不影响主流程）
    try {
      const [tables] = await conn.query("SHOW TABLES LIKE 'admin_operation_log'");
      const logTableExists = Array.isArray(tables) && tables.length > 0;
      if (logTableExists) {
        await conn.query(
          'INSERT INTO admin_operation_log (admin_id, operation, target_merchant_id, created_at) VALUES (?, ?, ?, NOW())',
          [adminId, normalizedAuditStatus === 2 ? '审核通过商家' : '审核拒绝商家', id]
        );
      }
    } catch (_) {
      // ignore
    }

    await conn.commit();

    res.json({
      success: true,
      message: normalizedAuditStatus === 2 ? '审核通过' : '审核拒绝'
    });
  } catch (error) {
    if (conn) {
      await conn.rollback().catch(() => {});
    }
    next(error);
  } finally {
    if (conn) conn.release();
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
    
    const statusInt = parseInt(status, 10);
    if (![0, 1].includes(statusInt)) {
      return res.status(400).json({
        success: false,
        message: '非法的状态参数'
      });
    }

    // 更新商家状态
    await pool.query(
      'UPDATE merchant SET status = ? WHERE id = ?',
      [statusInt, id]
    );
    
    // 记录操作日志
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, target_merchant_id, created_at) VALUES (?, ?, ?, NOW())',
      [adminId, statusInt === 1 ? '设置商家营业' : '设置商家休息', id]
    );
    
    // 强制关闭商家后处理进行中订单
    if (statusInt === 0) {
      // 所有商品自动下架
      await pool.query(
        'UPDATE product SET status = 0 WHERE merchant_id = ?',
        [id]
      );

      // 标记进行中订单为异常
      await pool.query(
        'UPDATE \`order\` SET status = 4, remark = ? WHERE merchant_id = ? AND status IN (0, 1, 2)',
        ['商家已关闭', id]
      );
      
      // 通知用户
      const [orders] = await pool.query('SELECT user_id FROM \`order\` WHERE merchant_id = ? AND status = 4', [id]);
      for (const order of orders) {
        await pool.query(
          'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
          [order.user_id, '订单异常', '您的订单因商家已关闭而无法继续处理', 3]
        );
      }
    }
    
    res.json({
      success: true,
      message: statusInt === 1 ? '商家已设置为营业状态' : '商家已设置为休息状态'
    });
  } catch (error) {
    next(error);
  }
};