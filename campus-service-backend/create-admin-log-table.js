const { pool } = require('./config/db');

async function createAdminLogTable() {
  try {
    // 创建admin_operation_log表
    const sql = `CREATE TABLE IF NOT EXISTS admin_operation_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      operation VARCHAR(255) NOT NULL,
      target_user_id INT,
      target_merchant_id INT,
      target_order_id INT,
      created_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
    
    await pool.query(sql);
    
    console.log('✅ admin_operation_log表创建成功！');
    
  } catch (error) {
    console.error('❌ 创建admin_operation_log表失败:', error);
  } finally {
    pool.end();
  }
}

createAdminLogTable();