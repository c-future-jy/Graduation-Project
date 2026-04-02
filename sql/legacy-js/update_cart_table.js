const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', 'campus-service-backend', '.env')
});

const { pool } = require('../../campus-service-backend/config/db');

async function updateCartTable() {
  try {
    // 添加selected字段
    await pool.query('ALTER TABLE cart ADD COLUMN selected TINYINT NOT NULL DEFAULT 1');
    console.log('✅ 购物车表添加selected字段成功！');

    // 添加唯一索引
    await pool.query('CREATE UNIQUE INDEX uk_user_product_spec ON cart (user_id, product_id, spec)');
    console.log('✅ 购物车表添加唯一索引成功！');

    // 添加索引优化查询性能
    await pool.query('CREATE INDEX idx_user_id ON cart (user_id)');
    await pool.query('CREATE INDEX idx_merchant_id ON cart (merchant_id)');
    console.log('✅ 购物车表添加索引成功！');
  } catch (error) {
    console.error('❌ 购物车表更新失败:', error.message);
  } finally {
    process.exit();
  }
}

updateCartTable();
