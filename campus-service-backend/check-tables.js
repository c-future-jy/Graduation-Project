const { pool } = require('./config/db');

async function checkTables() {
  try {
    // 检查订单表结构
    console.log('=== Order table structure ===');
    const [orderRows] = await pool.query('SHOW COLUMNS FROM `order`');
    orderRows.forEach(row => {
      console.log(`${row.Field}: ${row.Type} (${row.Null}, ${row.Key})`);
    });
    
    pool.end();
  } catch (error) {
    console.error('Error checking tables:', error);
    pool.end();
  }
}

checkTables();