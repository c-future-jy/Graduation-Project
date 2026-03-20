const { pool } = require('./config/db');

async function createFeedbackTable() {
  try {
    // 创建评价表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT NOT NULL,
        merchant_id INT NOT NULL,
        product_id INT NOT NULL,
        rating TINYINT NOT NULL COMMENT '1-5星',
        content VARCHAR(500),
        image VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES \`order\`(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
        FOREIGN KEY (merchant_id) REFERENCES merchant(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 索引会在表创建时自动添加外键索引

    console.log('评价表创建成功');
  } catch (error) {
    console.error('创建评价表失败:', error);
  } finally {
    pool.end();
  }
}

createFeedbackTable();
