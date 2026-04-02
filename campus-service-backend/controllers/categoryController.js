const { pool } = require('../config/db');

// 获取分类列表
exports.getCategoryList = async (req, res, next) => {
  try {
    const { type = 1, merchant_id } = req.query;
    const normalizedType = parseInt(type, 10) || 1;
    const merchantId = merchant_id !== undefined && merchant_id !== null && merchant_id !== '' ? parseInt(merchant_id, 10) : null;

    // 兼容历史数据：category.merchant_id 可能被写成 merchant.owner_user_id（用户ID）
    // 当前前端会传 merchant.id，这里额外解析 owner_user_id 以便同时命中两种数据。
    let ownerUserId = null;
    if (merchantId) {
      try {
        const [rows] = await pool.query('SELECT owner_user_id FROM merchant WHERE id = ? LIMIT 1', [merchantId]);
        const ouid = rows && rows[0] && rows[0].owner_user_id;
        const ouidNum = ouid !== undefined && ouid !== null && ouid !== '' ? parseInt(ouid, 10) : null;
        ownerUserId = Number.isFinite(ouidNum) ? ouidNum : null;
      } catch (_) {
        ownerUserId = null;
      }
    }

    let query = 'SELECT * FROM category WHERE type = ?';
    const params = [normalizedType];

    if (merchantId) {
      if (ownerUserId && ownerUserId !== merchantId) {
        query += ' AND (merchant_id = ? OR merchant_id = ? OR merchant_id IS NULL)';
        params.push(merchantId, ownerUserId);
      } else {
        query += ' AND (merchant_id = ? OR merchant_id IS NULL)';
        params.push(merchantId);
      }
    }

    query += ' ORDER BY sort_order ASC';

    const [categories] = await pool.query(query, params);

    // 如果命中了“merchant_id=owner_user_id”的历史数据，为了不影响前端严格过滤，
    // 这里把返回值中的 merchant_id 规范化成 merchant.id（仅响应层，不改库）。
    const normalizedCategories = merchantId && ownerUserId
      ? (categories || []).map((c) => {
          const mid = c && c.merchant_id;
          const midNum = mid === undefined || mid === null || mid === '' ? null : parseInt(mid, 10);
          if (Number.isFinite(midNum) && midNum === ownerUserId) {
            return { ...c, merchant_id: merchantId };
          }
          return c;
        })
      : categories;

    res.json({ success: true, data: { categories: normalizedCategories } });
  } catch (error) {
    next(error);
  }
};

// 创建分类
exports.createCategory = async (req, res, next) => {
  try {
    const role = req.user && req.user.role !== undefined && req.user.role !== null ? parseInt(req.user.role, 10) : null;
    const name = String((req.body && req.body.name) || '').trim();
    const icon = String((req.body && req.body.icon) || '').trim();
    const sortOrder = req.body && req.body.sort_order !== undefined && req.body.sort_order !== null && req.body.sort_order !== ''
      ? parseInt(req.body.sort_order, 10)
      : 0;

    if (!name) {
      return res.status(400).json({ success: false, message: '分类名称不能为空' });
    }

    let merchantId = null;
    let type = req.body && req.body.type !== undefined && req.body.type !== null && req.body.type !== ''
      ? parseInt(req.body.type, 10)
      : 1;

    // 商家端：强制绑定当前商家（不信任前端传 merchant_id）
    if (role === 2) {
      const tokenMerchantId = req.user && req.user.merchant_id !== undefined && req.user.merchant_id !== null && req.user.merchant_id !== ''
        ? parseInt(req.user.merchant_id, 10)
        : null;

      if (Number.isFinite(tokenMerchantId) && tokenMerchantId > 0) {
        merchantId = tokenMerchantId;
      } else {
        // 兜底：用 owner_user_id 找最近一条商家记录
        const userId = req.user && req.user.id ? parseInt(req.user.id, 10) : null;
        if (userId) {
          const [rows] = await pool.query(
            'SELECT id FROM merchant WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1',
            [userId]
          );
          const mid = rows && rows[0] && rows[0].id ? parseInt(rows[0].id, 10) : null;
          if (Number.isFinite(mid) && mid > 0) merchantId = mid;
        }
      }

      if (!merchantId) {
        return res.status(400).json({ success: false, message: '缺少商家ID，无法创建分类' });
      }

      // 需求：商品分类 type=1
      type = 1;
    }

    // 管理员端：允许显式指定 merchant_id（也允许为空作为公共分类）
    if (role === 3) {
      const bodyMerchantId = req.body && req.body.merchant_id !== undefined && req.body.merchant_id !== null && req.body.merchant_id !== ''
        ? parseInt(req.body.merchant_id, 10)
        : null;
      merchantId = Number.isFinite(bodyMerchantId) && bodyMerchantId > 0 ? bodyMerchantId : null;
    }

    const safeSortOrder = Number.isFinite(sortOrder) ? sortOrder : 0;
    const safeType = Number.isFinite(type) ? type : 1;

    const [result] = await pool.query(
      'INSERT INTO category (merchant_id, name, icon, type, sort_order) VALUES (?, ?, ?, ?, ?)',
      [merchantId, name, icon, safeType, safeSortOrder]
    );

    res.status(201).json({
      success: true,
      data: {
        categoryId: result.insertId,
        category: { id: result.insertId, merchant_id: merchantId, name, icon, type: safeType, sort_order: safeSortOrder }
      }
    });
  } catch (error) {
    next(error);
  }
};

// 更新分类
exports.updateCategory = async (req, res, next) => {
  try {
    const { name, icon, sort_order } = req.body;
    await pool.query(
      'UPDATE category SET name = ?, icon = ?, sort_order = ?, updated_at = NOW() WHERE id = ?',
      [name, icon, sort_order, req.params.id]
    );
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    next(error);
  }
};

// 删除分类
exports.deleteCategory = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM category WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    next(error);
  }
};