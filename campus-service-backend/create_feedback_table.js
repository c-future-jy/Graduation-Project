const { pool } = require('./config/db');

async function createFeedbackTable() {
  try {
    // 创建反馈表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        type TINYINT NOT NULL COMMENT '1-订单评价, 2-商家评价, 3-平台反馈',
        user_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NULL COMMENT '订单ID，当type=1时必填',
        merchant_id BIGINT UNSIGNED NULL COMMENT '商家ID，当type=2时必填',
        rating TINYINT NULL COMMENT '1-5星，可为null',
        content VARCHAR(500) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reply VARCHAR(500) NULL,
        reject_reason TEXT NULL,
        reply_time DATETIME NULL,
        reply_user_id BIGINT UNSIGNED NULL,
        status TINYINT DEFAULT 0 COMMENT '0-未处理, 1-已回复',
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES \`order\`(id) ON DELETE SET NULL,
        FOREIGN KEY (merchant_id) REFERENCES merchant(id) ON DELETE SET NULL,
        FOREIGN KEY (reply_user_id) REFERENCES user(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 索引会在表创建时自动添加外键索引

    console.log('反馈表创建成功');
  } catch (error) {
    console.error('创建反馈表失败:', error);
  } finally {
    pool.end();
  }
}

createFeedbackTable();
