const { pool } = require('./config/db');

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return (rows[0] && rows[0].cnt > 0) || false;
}

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [tableName, indexName]
  );
  return (rows[0] && rows[0].cnt > 0) || false;
}

async function addColumnIfMissing({ tableName, columnName, addSql }) {
  const exists = await columnExists(tableName, columnName);
  if (exists) {
    console.log(`ℹ️  ${tableName}.${columnName} 已存在，跳过`);
    return;
  }
  await pool.query(addSql);
  console.log(`✅ 已添加 ${tableName}.${columnName}`);
}

async function addIndexIfMissing({ tableName, indexName, addSql }) {
  const exists = await indexExists(tableName, indexName);
  if (exists) {
    console.log(`ℹ️  索引 ${tableName}.${indexName} 已存在，跳过`);
    return;
  }
  await pool.query(addSql);
  console.log(`✅ 已添加索引 ${tableName}.${indexName}`);
}

async function migrate() {
  // 1) order 表：补齐发货/完成时间（orderController 会写这两个字段）
  await addColumnIfMissing({
    tableName: 'order',
    columnName: 'delivery_time',
    addSql: 'ALTER TABLE `order` ADD COLUMN delivery_time DATETIME NULL DEFAULT NULL'
  });
  await addColumnIfMissing({
    tableName: 'order',
    columnName: 'complete_time',
    addSql: 'ALTER TABLE `order` ADD COLUMN complete_time DATETIME NULL DEFAULT NULL'
  });
  // 可选索引（常用于后台筛选/统计）
  await addIndexIfMissing({
    tableName: 'order',
    indexName: 'idx_delivery_time',
    addSql: 'CREATE INDEX idx_delivery_time ON `order` (delivery_time)'
  });
  await addIndexIfMissing({
    tableName: 'order',
    indexName: 'idx_complete_time',
    addSql: 'CREATE INDEX idx_complete_time ON `order` (complete_time)'
  });

  // 2) product 表：补齐管理员下架字段（productController.updateProductStatus 会写）
  await addColumnIfMissing({
    tableName: 'product',
    columnName: 'offline_reason',
    addSql: 'ALTER TABLE product ADD COLUMN offline_reason VARCHAR(255) NULL DEFAULT NULL'
  });
  await addColumnIfMissing({
    tableName: 'product',
    columnName: 'offline_admin_id',
    addSql: 'ALTER TABLE product ADD COLUMN offline_admin_id BIGINT UNSIGNED NULL DEFAULT NULL'
  });
  await addIndexIfMissing({
    tableName: 'product',
    indexName: 'idx_offline_admin_id',
    addSql: 'CREATE INDEX idx_offline_admin_id ON product (offline_admin_id)'
  });

  // 3) user 表：补齐 phone 索引（accountLogin / checkPhone 用到）
  await addIndexIfMissing({
    tableName: 'user',
    indexName: 'idx_phone',
    addSql: 'CREATE INDEX idx_phone ON user (phone)'
  });

  // 4) admin_operation_log：补齐可选字段（logController.logOperation 期望）
  await addColumnIfMissing({
    tableName: 'admin_operation_log',
    columnName: 'target_table',
    addSql: 'ALTER TABLE admin_operation_log ADD COLUMN target_table VARCHAR(50) NULL DEFAULT NULL'
  });
  await addColumnIfMissing({
    tableName: 'admin_operation_log',
    columnName: 'target_id',
    addSql: 'ALTER TABLE admin_operation_log ADD COLUMN target_id BIGINT UNSIGNED NULL DEFAULT NULL'
  });
  await addColumnIfMissing({
    tableName: 'admin_operation_log',
    columnName: 'ip',
    addSql: 'ALTER TABLE admin_operation_log ADD COLUMN ip VARCHAR(64) NULL DEFAULT NULL'
  });
  await addIndexIfMissing({
    tableName: 'admin_operation_log',
    indexName: 'idx_admin_id',
    addSql: 'CREATE INDEX idx_admin_id ON admin_operation_log (admin_id)'
  });
  await addIndexIfMissing({
    tableName: 'admin_operation_log',
    indexName: 'idx_created_at',
    addSql: 'CREATE INDEX idx_created_at ON admin_operation_log (created_at)'
  });

  // 5) feedback：补齐常用索引（后台列表常按时间/状态/商家筛选）
  await addIndexIfMissing({
    tableName: 'feedback',
    indexName: 'idx_merchant_id',
    addSql: 'CREATE INDEX idx_merchant_id ON feedback (merchant_id)'
  });
  await addIndexIfMissing({
    tableName: 'feedback',
    indexName: 'idx_status',
    addSql: 'CREATE INDEX idx_status ON feedback (status)'
  });
  await addIndexIfMissing({
    tableName: 'feedback',
    indexName: 'idx_created_at',
    addSql: 'CREATE INDEX idx_created_at ON feedback (created_at)'
  });

  console.log('\n🎉 迁移完成（可重复执行，已有项会跳过）');
}

migrate()
  .catch((e) => {
    console.error('❌ 迁移失败:', e && e.message ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_) {
      // ignore
    }
  });
