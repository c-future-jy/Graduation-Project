const { pool } = require('../config/db');

// 获取商品列表
exports.getProductList = async (req, res, next) => {
  try {
    const { merchant_id, category_id, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM product WHERE status = 1';
    let params = [];
    
    if (merchant_id) {
      query += ' AND merchant_id = ?';
      params.push(merchant_id);
    }
    if (category_id) {
      query += ' AND category_id = ?';
      params.push(category_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [products] = await pool.query(query, params);
    res.json({ success: true, data: { products } });
  } catch (error) {
    next(error);
  }
};

// 获取商品详情
exports.getProductById = async (req, res, next) => {
  try {
    const [products] = await pool.query('SELECT * FROM product WHERE id = ?', [req.params.id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }
    res.json({ success: true, data: { product: products[0] } });
  } catch (error) {
    next(error);
  }
};

// 创建商品
exports.createProduct = async (req, res, next) => {
  try {
    const { merchant_id, category_id, name, description, price, stock, image } = req.body;
    const [result] = await pool.query(
      'INSERT INTO product (merchant_id, category_id, name, description, price, stock, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [merchant_id, category_id, name, description, price, stock, image]
    );
    res.status(201).json({ success: true, data: { productId: result.insertId } });
  } catch (error) {
    next(error);
  }
};

// 更新商品
exports.updateProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, image, status } = req.body;
    await pool.query(
      'UPDATE product SET name = ?, description = ?, price = ?, stock = ?, image = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [name, description, price, stock, image, status, req.params.id]
    );
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    next(error);
  }
};

// 删除商品
exports.deleteProduct = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM product WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    next(error);
  }
};