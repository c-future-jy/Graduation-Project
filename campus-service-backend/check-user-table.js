const { pool } = require('./config/db');

async function checkUserTable() {
  try {
    // 检查user表结构
    const [userColumns] = await pool.query(
      "SHOW COLUMNS FROM user"
    );
    console.log('user表结构:', userColumns.map(col => col.Field));
    
  } catch (error) {
    console.error('检查用户表结构失败:', error);
  } finally {
    pool.end();
  }
}

checkUserTable();