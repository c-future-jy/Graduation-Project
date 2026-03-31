const { pool } = require('../config/db');

// 搜索商家和商品
exports.search = async (req, res, next) => {
  try {
    const keyword = String(req.query.keyword ?? req.query.q ?? '').trim();
    
    if (!keyword) {
      return res.status(400).json({ success: false, message: '搜索关键词不能为空' });
    }
    
    // 搜索商家
    const [merchants] = await pool.query(
      'SELECT id, name, logo, description, address, phone FROM merchant WHERE status = 1 AND (name LIKE ? OR description LIKE ?) ORDER BY created_at DESC LIMIT 10',
      [`%${keyword}%`, `%${keyword}%`]
    );
    
    // 搜索商品
    const [products] = await pool.query(
      'SELECT p.id, p.name, p.price, p.description, p.image, m.name as merchant_name FROM product p JOIN merchant m ON p.merchant_id = m.id WHERE p.status = 1 AND m.status = 1 AND (p.name LIKE ? OR p.description LIKE ?) ORDER BY p.created_at DESC LIMIT 10',
      [`%${keyword}%`, `%${keyword}%`]
    );
    
    // 整合搜索结果
    const results = [
      ...merchants.map(merchant => ({
        id: merchant.id,
        type: 'merchant',
        title: merchant.name,
        desc: merchant.description || '暂无描述',
        image: merchant.logo,
        meta: merchant.address
      })),
      ...products.map(product => ({
        id: product.id,
        type: 'product',
        title: product.name,
        desc: product.description || '暂无描述',
        image: product.image,
        meta: `${product.merchant_name} - ¥${product.price}`
      }))
    ];
    
    res.json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
};
