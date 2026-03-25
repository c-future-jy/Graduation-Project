const { pool } = require('./config/db');

async function checkTables() {
  try {
    // 检查admin_operation_log表是否存在
    const [tables] = await pool.query(
      "SHOW TABLES LIKE 'admin_operation_log'"
    );
    
    console.log('admin_operation_log表存在:', tables.length > 0);
    
    // 检查merchant表结构
    const [merchantColumns] = await pool.query(
      "SHOW COLUMNS FROM merchant"
    );
    console.log('merchant表结构:', merchantColumns.map(col => col.Field));
    
    // 检查user表结构
    const [userColumns] = await pool.query(
      "SHOW COLUMNS FROM user"
    );
    console.log('user表结构:', userColumns.map(col => col.Field));
    
  } catch (error) {
    console.error('检查数据库表结构失败:', error);
  } finally {
    pool.end();
  }
}

checkTables();