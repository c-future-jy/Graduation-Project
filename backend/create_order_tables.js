const { pool } = require('./config/db');

async function createOrderTables() {
  try {
    // 创建订单表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`order\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_no VARCHAR(50) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        merchant_id INT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        receiver_name VARCHAR(50) NOT NULL,
        receiver_phone VARCHAR(20) NOT NULL,
        receiver_address VARCHAR(255) NOT NULL,
        remark VARCHAR(255),
        payment_method VARCHAR(20) DEFAULT 'wechat',
        status TINYINT DEFAULT 0 COMMENT '0-待支付, 1-待发货, 2-已发货, 3-已完成, 4-已取消',
        payment_time DATETIME,
        delivery_time DATETIME,
        complete_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
        FOREIGN KEY (merchant_id) REFERENCES merchant(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 创建订单详情表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_item (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(100) NOT NULL,
        product_image VARCHAR(255),
        price DECIMAL(10, 2) NOT NULL,
        quantity INT NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES \`order\`(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 索引会在表创建时自动添加外键索引

    console.log('订单表和订单详情表创建成功');
  } catch (error) {
    console.error('创建订单表失败:', error);
  } finally {
    pool.end();
  }
}

createOrderTables();
