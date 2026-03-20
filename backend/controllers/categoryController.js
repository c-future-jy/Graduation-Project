const { pool } = require('../config/db');

// 获取分类列表
exports.getCategoryList = async (req, res, next) => {
  try {
    const { type = 1, merchant_id } = req.query;
    let query = 'SELECT * FROM category WHERE type = ?';
    let params = [type];
    
    if (merchant_id) {
      query += ' AND (merchant_id = ? OR merchant_id IS NULL)';
      params.push(merchant_id);
    }
    
    query += ' ORDER BY sort_order ASC';
    
    const [categories] = await pool.query(query, params);
    res.json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
};

// 创建分类
exports.createCategory = async (req, res, next) => {
  try {
    const { merchant_id, name, type, sort_order } = req.body;
    const [result] = await pool.query(
      'INSERT INTO category (merchant_id, name, type, sort_order) VALUES (?, ?, ?, ?)',
      [merchant_id, name, type, sort_order || 0]
    );
    res.status(201).json({ success: true, data: { categoryId: result.insertId } });
  } catch (error) {
    next(error);
  }
};

// 更新分类
exports.updateCategory = async (req, res, next) => {
  try {
    const { name, sort_order } = req.body;
    await pool.query(
      'UPDATE category SET name = ?, sort_order = ?, updated_at = NOW() WHERE id = ?',
      [name, sort_order, req.params.id]
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