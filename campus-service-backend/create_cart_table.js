const { pool } = require('./config/db');

async function createCartTable() {
  try {
    // 先删除表（如果存在）
    await pool.query('DROP TABLE IF EXISTS cart');
    console.log('已删除旧的购物车表');
    
    const sql = `
      CREATE TABLE cart (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        merchant_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        spec VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(sql);
    console.log('✅ 购物车表创建成功！');
    
    // 添加外键约束
    try {
      await pool.query('ALTER TABLE cart ADD FOREIGN KEY (user_id) REFERENCES user(id)');
      await pool.query('ALTER TABLE cart ADD FOREIGN KEY (product_id) REFERENCES product(id)');
      await pool.query('ALTER TABLE cart ADD FOREIGN KEY (merchant_id) REFERENCES merchant(id)');
      await pool.query('ALTER TABLE cart ADD UNIQUE KEY user_product_spec (user_id, product_id, spec)');
      console.log('✅ 外键约束添加成功！');
    } catch (foreignKeyError) {
      console.warn('⚠️  外键约束添加失败，可能是因为关联表不存在或数据类型不匹配:', foreignKeyError.message);
    }
  } catch (error) {
    console.error('❌ 购物车表创建失败:', error.message);
  } finally {
    process.exit();
  }
}

createCartTable();