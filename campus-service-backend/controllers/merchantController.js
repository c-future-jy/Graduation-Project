const { pool } = require('../config/db');
const { success, fail } = require('../utils/response');

async function getTableColumns(tableName, connOrPool = pool) {
  try {
    const [rows] = await connOrPool.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const names = (rows || []).map((r) => r && r.Field).filter(Boolean);
    return new Set(names);
  } catch (_) {
    return new Set();
  }
}

async function hasTable(tableName, connOrPool = pool) {
  try {
    const [rows] = await connOrPool.query('SHOW TABLES LIKE ?', [tableName]);
    return Array.isArray(rows) && rows.length > 0;
  } catch (_) {
    return false;
  }
}

async function resolveMerchantTableName(connOrPool = pool) {
  if (await hasTable('merchant', connOrPool)) return 'merchant';
  if (await hasTable('merchants', connOrPool)) return 'merchants';
  return 'merchant';
}

async function columnExists(tableName, columnName, connOrPool = pool) {
  try {
    const result = await connOrPool.query(
      `SELECT COUNT(*) as cnt
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [tableName, columnName]
    );

    // mysql2: [rows, fields]
    // jest mocks: may return rows directly or { rows }
    const rows = Array.isArray(result)
      ? result[0]
      : (result && Array.isArray(result.rows) ? result.rows : result);

    if (!Array.isArray(rows) || rows.length === 0) return false;
    const cnt = rows[0] && rows[0].cnt !== undefined ? Number(rows[0].cnt) : 0;
    return Number.isFinite(cnt) && cnt > 0;
  } catch (_) {
    return false;
  }
}

// 获取商家公开评价（用于商家详情页展示）
// GET /api/merchants/:id/feedbacks?limit=3&since_id=123
exports.getMerchantPublicFeedbacks = async (req, res, next) => {
  try {
    const merchantId = parseInt(req.params.id, 10);
    if (!Number.isFinite(merchantId) || merchantId <= 0) {
      return res.status(400).json({ success: false, message: '商家ID不合法' });
    }

    const limitRaw = req.query.limit;
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 3, 1), 50);

    const sinceIdRaw = req.query.since_id;
    const sinceId = sinceIdRaw !== undefined && sinceIdRaw !== null && sinceIdRaw !== ''
      ? parseInt(sinceIdRaw, 10)
      : null;

    const timeColumn = (await columnExists('feedback', 'create_time'))
      ? 'create_time'
      : (await columnExists('feedback', 'created_at'))
        ? 'created_at'
        : null;

    const userNameColumn = (await columnExists('user', 'nickname'))
      ? 'nickname'
      : (await columnExists('user', 'username'))
        ? 'username'
        : null;

    const createdAtSelect = timeColumn ? `f.\`${timeColumn}\` as created_at` : 'NULL as created_at';
    const orderBy = timeColumn ? `f.\`${timeColumn}\` DESC` : 'f.id DESC';
    const userNameExpr = userNameColumn
      ? `COALESCE(u.\`${userNameColumn}\`, '匿名用户') as user_name`
      : "'匿名用户' as user_name";

    const where = ['f.merchant_id = ?', 'f.type = 2'];
    const params = [merchantId];

    if (Number.isFinite(sinceId) && sinceId > 0) {
      where.push('f.id > ?');
      params.push(sinceId);
    }

    const [rows] = await pool.query(
      `
        SELECT
          f.id,
          f.rating,
          f.content,
          f.reply,
          ${createdAtSelect},
          ${userNameExpr}
        FROM feedback f
        LEFT JOIN user u ON f.user_id = u.id
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT ?
      `,
      [...params, limit]
    );

    return res.json({ success: true, data: { feedbacks: rows || [] } });
  } catch (error) {
    next(error);
  }
};

// 获取商家列表
exports.getMerchantList = async (req, res, next) => {
  try {
    const { category } = req.query;
    const categoryIdRaw = req.query.category_id;
    const keyword = String(req.query.keyword ?? req.query.q ?? '').trim();

    // 兼容：category 既可能是老的英文 key（breakfast 等），也可能被前端当成数字 id 直接传来
    const legacyCategoryKeyMap = {
      breakfast: 1,
      lunch: 2,
      noodles: 3,
      rice: 4,
      salad: 5,
      snack: 6,
      drink: 7,
      market: 8
    };

    let categoryId = null;
    if (categoryIdRaw !== undefined && categoryIdRaw !== null && categoryIdRaw !== '') {
      const n = parseInt(categoryIdRaw, 10);
      categoryId = Number.isFinite(n) && n > 0 ? n : null;
    }
    if (!categoryId && category && category !== 'recommend') {
      const s = String(category).trim();
      if (/^\d+$/.test(s)) {
        const n = parseInt(s, 10);
        categoryId = Number.isFinite(n) && n > 0 ? n : null;
      } else if (legacyCategoryKeyMap[s]) {
        categoryId = legacyCategoryKeyMap[s];
      }
    }

    const shouldFilterByCategory = !!categoryId && String(category || '').trim() !== 'recommend';

    const buildSql = (tableName, includeAuditStatus) => {
      let query = `SELECT DISTINCT m.* FROM ${tableName} m`;
      const params = [];

      if (shouldFilterByCategory) {
        query += ' INNER JOIN product p ON p.merchant_id = m.id AND p.status = 1 AND p.category_id = ?';
        params.push(categoryId);
      }

      query += includeAuditStatus ? ' WHERE m.audit_status = 2' : ' WHERE 1=1';

      if (keyword) {
        query += ' AND (m.name LIKE ? OR m.description LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      query += ' ORDER BY m.status DESC, m.created_at DESC';
      return { query, params };
    };

    // 默认路径：兼容旧测试（只发起一次 query）。若 audit_status 或表名不兼容，再降级重试。
    try {
      const { query, params } = buildSql('merchant', true);
      const [merchants] = await pool.query(query, params);
      return res.json({ success: true, data: { merchants } });
    } catch (e) {
      const msg = e && e.message ? String(e.message) : '';

      const noSuchTable = e && (e.code === 'ER_NO_SUCH_TABLE' || msg.includes("doesn't exist"));
      const missingAuditCol =
        (e && e.code === 'ER_BAD_FIELD_ERROR') ||
        msg.includes("Unknown column 'audit_status'") ||
        msg.includes('Unknown column audit_status');

      // 非兼容性问题，继续抛出
      if (!noSuchTable && !missingAuditCol) throw e;

      const tableName = noSuchTable ? 'merchants' : 'merchant';
      const includeAuditStatus = !missingAuditCol;

      try {
        const { query, params } = buildSql(tableName, includeAuditStatus);
        const [merchants] = await pool.query(query, params);
        return res.json({ success: true, data: { merchants } });
      } catch (e2) {
        const msg2 = e2 && e2.message ? String(e2.message) : '';
        const missingAuditCol2 =
          (e2 && e2.code === 'ER_BAD_FIELD_ERROR') ||
          msg2.includes("Unknown column 'audit_status'") ||
          msg2.includes('Unknown column audit_status');
        if (!missingAuditCol2) throw e2;

        const { query, params } = buildSql(tableName, false);
        const [merchants] = await pool.query(query, params);
        return res.json({ success: true, data: { merchants } });
      }
    }
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
      ? 'SELECT * FROM merchant WHERE id = ? AND audit_status = 2'
      : 'SELECT * FROM merchant WHERE id = ?';

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
      return fail(res, 401, '未授权访问');
    }

    const merchantTable = await resolveMerchantTableName();

    const tokenMerchantId = req.user && req.user.merchant_id !== undefined && req.user.merchant_id !== null && req.user.merchant_id !== ''
      ? parseInt(req.user.merchant_id, 10)
      : null;

    // 返回该用户名下的最新商家记录（不强制 status/audit_status 过滤，便于商家端管理）
    const [rows] = await pool.query(
      `SELECT * FROM ${merchantTable} WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );

    if (rows && rows.length > 0) {
      return success(res, { merchant: rows[0] });
    }

    // 兼容：部分库可能只在 user.merchant_id 里绑定店铺，merchant.owner_user_id 为空/不一致
    let merchantId = Number.isFinite(tokenMerchantId) && tokenMerchantId > 0 ? tokenMerchantId : null;

    if (!merchantId) {
      try {
        const [users] = await pool.query('SELECT merchant_id FROM user WHERE id = ? LIMIT 1', [userId]);
        const mid = users && users[0] && users[0].merchant_id;
        const midNum = mid !== undefined && mid !== null && mid !== '' ? parseInt(mid, 10) : null;
        if (Number.isFinite(midNum) && midNum > 0) merchantId = midNum;
      } catch (_) {
        merchantId = null;
      }
    }

    if (merchantId) {
      const [byId] = await pool.query(`SELECT * FROM ${merchantTable} WHERE id = ? LIMIT 1`, [merchantId]);
      if (byId && byId.length > 0) {
        return success(res, { merchant: byId[0] });
      }
    }

    // 兜底修复：若 DB 中用户已是商家(role=2)但没有 merchant 记录，则自动创建一条（避免注册/历史数据导致商家端不可用）
    let userRole = null;
    let merchantName = '我的店铺';
    try {
      const [users] = await pool.query('SELECT role, nickname, username, merchant_id FROM user WHERE id = ? LIMIT 1', [userId]);
      const u = users && users[0] ? users[0] : null;
      userRole = u && u.role !== undefined && u.role !== null && u.role !== '' ? parseInt(u.role, 10) : null;
      if (u && (u.nickname || u.username)) merchantName = String(u.nickname || u.username);
      // 若 token/user 的 merchant_id 未取到，但 DB 里有，则再尝试一次 byId
      if (!merchantId && u && u.merchant_id !== undefined && u.merchant_id !== null && u.merchant_id !== '') {
        const midNum = parseInt(u.merchant_id, 10);
        if (Number.isFinite(midNum) && midNum > 0) {
          const [byId2] = await pool.query(`SELECT * FROM ${merchantTable} WHERE id = ? LIMIT 1`, [midNum]);
          if (byId2 && byId2.length > 0) {
            return success(res, { merchant: byId2[0] });
          }
        }
      }
    } catch (_) {
      // ignore
    }

    if (userRole === 2) {
      try {
        const columnSet = await getTableColumns(merchantTable);
        if (columnSet.size > 0) {

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

          addParamColumn('owner_user_id', userId);
          addParamColumn('name', merchantName);
          addParamColumn('status', 1);

          // 常见字段：部分表可能 NOT NULL，无默认值，这里尽量补齐
          addParamColumn('phone', '');
          addParamColumn('address', '');
          addParamColumn('description', '');
          addParamColumn('logo', '');

          addParamColumn('audit_status', 2);
          addRawColumn('created_at', 'NOW()');
          addRawColumn('updated_at', 'NOW()');

          if (insertColumns.length > 0) {
            const insertSql = `INSERT INTO ${merchantTable} (${insertColumns.join(', ')}) VALUES (${insertPlaceholders.join(', ')})`;
            const [insertRes] = await pool.query(insertSql, insertParams);
            const newMerchantId = insertRes && insertRes.insertId ? insertRes.insertId : null;

            if (newMerchantId) {
              console.log(`merchant self-heal: created merchant ${newMerchantId} for user ${userId}`);
              // 尝试回写 user.merchant_id（若列存在）
              try {
                const userCols = await getTableColumns('user');
                if (userCols.has('merchant_id')) {
                  await pool.query('UPDATE user SET merchant_id = ? WHERE id = ? LIMIT 1', [newMerchantId, userId]);
                }
              } catch (_) {
                // ignore
              }

              const [createdRows] = await pool.query(`SELECT * FROM ${merchantTable} WHERE id = ? LIMIT 1`, [newMerchantId]);
              if (createdRows && createdRows.length > 0) {
                return success(res, { merchant: createdRows[0] });
              }
            }
          }
        }
      } catch (e) {
        console.warn('merchant self-heal failed:', e && e.message ? e.message : e);
      }
    }

    return fail(res, 404, '未找到商家信息');
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
    
    // 检查是否已有商家记录：
    // - audit_status=1：审核中，不允许重复提交
    // - audit_status=2：已通过，视为已是商家
    // - audit_status=3：已驳回，允许重新提交（把状态重置为 1）
    const [existingMerchants] = await pool.query(
      'SELECT id, audit_status FROM merchant WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1',
      [user_id]
    );

    const existingMerchant = existingMerchants && existingMerchants[0] ? existingMerchants[0] : null;

    if (existingMerchant) {
      const auditStatusNum =
        existingMerchant.audit_status === undefined || existingMerchant.audit_status === null || existingMerchant.audit_status === ''
          ? null
          : parseInt(existingMerchant.audit_status, 10);

      if (auditStatusNum === 2) {
        return res.status(400).json({ success: false, message: '您已经是商家' });
      }

      if (auditStatusNum === 1 || auditStatusNum === null) {
        return res.status(400).json({ success: false, message: '您已经提交了申请，正在审核中' });
      }

      if (auditStatusNum === 3) {
        // 重新提交：更新现有记录为待审核，并刷新申请信息
        const [merchantColumns] = await pool.query(
          `SELECT column_name AS column_name
           FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'merchant'`
        );

        const getColumnName = (row) =>
          row &&
          (row.column_name || row.COLUMN_NAME || row.Column_name || row.columnName || row.COLUMNNAME);

        const columnSet = new Set((merchantColumns || []).map(getColumnName).filter(Boolean));

        const setParts = [];
        const params = [];
        const setIfExists = (col, value) => {
          if (!columnSet.has(col)) return;
          setParts.push(`${col} = ?`);
          params.push(value);
        };

        setIfExists('name', nickname);
        setIfExists('phone', phone || '');
        setIfExists('status', 0);
        setIfExists('audit_status', 1);
        if (columnSet.has('audit_remark')) {
          // 追加一条“重新申请”记录，保留历史驳回原因/记录
          setParts.push(
            `audit_remark = TRIM(BOTH CHAR(10) FROM CONCAT(
              IFNULL(audit_remark, ''),
              IF(audit_remark IS NULL OR audit_remark = '', '', CHAR(10)),
              '[', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), '] ',
              '重新申请：', ?,
              '；电话：', ?
            ))`
          );
          params.push(String(nickname));
          params.push(String(phone || ''));
        }
        if (columnSet.has('updated_at')) setParts.push('updated_at = NOW()');

        if (setParts.length === 0) {
          return res.status(500).json({ success: false, message: '商家表结构异常，无法重新提交申请' });
        }

        const updateSql = `UPDATE merchant SET ${setParts.join(', ')} WHERE id = ?`;
        params.push(existingMerchant.id);
        await pool.query(updateSql, params);

        // 操作日志：可选（缺表/字段时不影响主流程）
        try {
          const [tables] = await pool.query("SHOW TABLES LIKE 'admin_operation_log'");
          const logTableExists = Array.isArray(tables) && tables.length > 0;
          if (logTableExists) {
            await pool.query(
              'INSERT INTO admin_operation_log (admin_id, operation, target_user_id, created_at) VALUES (?, ?, ?, NOW())',
              [user_id, '用户重新申请成为商家', user_id]
            );
          }
        } catch (_) {
          // ignore
        }

        return res.json({
          success: true,
          message: '申请已重新提交，等待管理员审核',
          data: {
            merchantId: existingMerchant.id
          }
        });
      }
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
    // - 通过：按当前 remark 覆盖（通常为空）
    // - 拒绝：将本次驳回原因追加到 audit_remark，保留历史
    if (normalizedAuditStatus === 3) {
      const reasonText = remarkText || '无';
      // 使用 CONCAT + CHAR(10) 追加换行，避免依赖字符串转义行为
      await conn.query(
        `UPDATE merchant
         SET
           audit_status = ?,
           audit_remark = TRIM(BOTH CHAR(10) FROM CONCAT(
             IFNULL(audit_remark, ''),
             IF(audit_remark IS NULL OR audit_remark = '', '', CHAR(10)),
             '[', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), '] ',
             '驳回原因：', ?
           )),
           audit_time = NOW(),
           audit_admin_id = ?
         WHERE id = ?`,
        [normalizedAuditStatus, reasonText, adminId, id]
      );
    } else {
      await conn.query(
        'UPDATE merchant SET audit_status = ?, audit_remark = ?, audit_time = NOW(), audit_admin_id = ? WHERE id = ?',
        [normalizedAuditStatus, remarkText, adminId, id]
      );
    }

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
      // 驳回后：用户恢复为学生；merchant_id 若指向该商家则清空
      try {
        const userHasMerchantId = await columnExists('user', 'merchant_id');
        if (userHasMerchantId) {
          await conn.query(
            'UPDATE user SET role = 1, merchant_id = NULL WHERE id = ? AND (merchant_id = ? OR merchant_id IS NULL)',
            [ownerUserId, id]
          );
        } else {
          await conn.query('UPDATE user SET role = 1 WHERE id = ? AND role = 2', [ownerUserId]);
        }
      } catch (_) {
        // ignore
      }

      // 店铺置为停用/不可用（仍保留记录供管理员查看）
      try {
        await conn.query('UPDATE merchant SET status = 0 WHERE id = ?', [id]);
      } catch (_) {
        // ignore
      }

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