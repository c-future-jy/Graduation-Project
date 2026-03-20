const { pool } = require('../config/db');

// 获取商家列表
exports.getMerchantList = async (req, res, next) => {
  try {
    const [merchants] = await pool.query('SELECT * FROM merchant WHERE status = 1 ORDER BY created_at DESC');
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