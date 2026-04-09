const { pool } = require('../config/db');

// 获取分类列表
exports.getCategoryList = async (req, res, next) => {
  try {
    const { type = 1, merchant_id } = req.query;
    const includeMerchantRaw = req.query.include_merchant;
    const includeMerchant = includeMerchantRaw === 1 || includeMerchantRaw === '1' || includeMerchantRaw === true || includeMerchantRaw === 'true';
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

    // 默认：不传 merchant_id 时，仅返回公共分类（merchant_id IS NULL），避免学生端分类被商家私有分类污染
    // 管理端如需查看全部分类，可传 include_merchant=1
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
    } else if (!includeMerchant) {
      query += ' AND merchant_id IS NULL';
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

    // 商家端：创建公共分类（全局共享），与学生端分类合并；并由后端做同名去重
    if (role === 2) {
      merchantId = null;
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

    // 去重：同一 (type, merchant_id) 下，分类名相同则直接复用，避免反复新增导致学生端分类列表膨胀
    const [existingRows] = await pool.query(
      'SELECT id, merchant_id, name, icon, type, sort_order FROM category WHERE type = ? AND name = ? AND (merchant_id <=> ?) LIMIT 1',
      [safeType, name, merchantId]
    );
    if (existingRows && existingRows.length > 0) {
      return res.json({
        success: true,
        data: {
          categoryId: existingRows[0].id,
          category: existingRows[0]
        }
      });
    }

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