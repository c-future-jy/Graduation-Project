const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', 'campus-service-backend', '.env')
});

const { pool } = require('../../campus-service-backend/config/db');

async function addUserStatusField() {
  try {
    // 向user表添加status字段
    await pool.query(`
      ALTER TABLE user ADD COLUMN status TINYINT DEFAULT 1 COMMENT '用户状态：1-正常，0-禁用'
    `);

    console.log('✅ 成功向user表添加status字段！');
  } catch (error) {
    console.error('❌ 向user表添加status字段失败:', error);
  } finally {
    pool.end();
  }
}

addUserStatusField();
