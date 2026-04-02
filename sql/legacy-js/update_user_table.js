const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', 'campus-service-backend', '.env')
});

const { pool } = require('../../campus-service-backend/config/db');

async function updateUserTable() {
  try {
    // 添加username字段
    await pool.query('ALTER TABLE user ADD COLUMN username VARCHAR(50) UNIQUE');
    console.log('✅ 用户表添加username字段成功！');

    // 确保openid字段有唯一索引
    await pool.query('CREATE UNIQUE INDEX uk_openid ON user (openid)');
    console.log('✅ 用户表添加openid唯一索引成功！');

    // 确保phone字段有索引
    await pool.query('CREATE INDEX idx_phone ON user (phone)');
    console.log('✅ 用户表添加phone索引成功！');
  } catch (error) {
    console.error('❌ 用户表更新失败:', error.message);
  } finally {
    process.exit();
  }
}

updateUserTable();
