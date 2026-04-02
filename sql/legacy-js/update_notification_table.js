const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', 'campus-service-backend', '.env')
});

const { pool } = require('../../campus-service-backend/config/db');

async function updateNotificationTable() {
  try {
    // 1) add deleted_at column if missing
    const [colRows] = await pool.query("SHOW COLUMNS FROM notification LIKE 'deleted_at'");
    if (!colRows || colRows.length === 0) {
      await pool.query('ALTER TABLE notification ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL');
      console.log('✅ notification 表添加 deleted_at 字段成功！');
    } else {
      console.log('ℹ️ notification 表已存在 deleted_at 字段，跳过');
    }

    // 2) add index for deleted_at (optional but good for filter)
    const [idxRows] = await pool.query(
      "SHOW INDEX FROM notification WHERE Key_name = 'idx_notification_deleted_at'"
    );
    if (!idxRows || idxRows.length === 0) {
      await pool.query('CREATE INDEX idx_notification_deleted_at ON notification (deleted_at)');
      console.log('✅ notification 表添加 deleted_at 索引成功！');
    } else {
      console.log('ℹ️ notification 表已存在 deleted_at 索引，跳过');
    }
  } catch (error) {
    console.error('❌ notification 表更新失败:', error.message);
  } finally {
    process.exit();
  }
}

updateNotificationTable();
