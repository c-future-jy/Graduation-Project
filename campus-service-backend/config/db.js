const mysql = require('mysql2');
require('dotenv').config();

// 创建连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 包装为 Promise 以便使用 async/await
const promisePool = pool.promise();

// 测试数据库连接
const testConnection = async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅ 数据库连接成功！');
    connection.release();
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
  }
};

module.exports = {
  pool: promisePool,
  testConnection
};