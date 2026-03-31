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

async function addColumnIfMissing(sql, tableName, columnName) {
  const exists = await columnExists(tableName, columnName);
  if (exists) {
    console.log(`ℹ️  ${tableName}.${columnName} 已存在，跳过`);
    return;
  }
  await pool.query(sql);
  console.log(`✅ 已添加 ${tableName}.${columnName}`);
}

async function updateMerchantTable() {
  try {
    // 审核状态：1 待审核；2 已通过；3 已拒绝
    await addColumnIfMissing(
      "ALTER TABLE merchant ADD COLUMN audit_status TINYINT NOT NULL DEFAULT 2 COMMENT '审核状态：1待审核 2通过 3拒绝（历史商家默认通过）'",
      'merchant',
      'audit_status'
    );

    await addColumnIfMissing(
      "ALTER TABLE merchant ADD COLUMN audit_remark VARCHAR(255) NULL COMMENT '审核备注'",
      'merchant',
      'audit_remark'
    );

    await addColumnIfMissing(
      "ALTER TABLE merchant ADD COLUMN audit_time DATETIME NULL COMMENT '审核时间'",
      'merchant',
      'audit_time'
    );

    await addColumnIfMissing(
      "ALTER TABLE merchant ADD COLUMN audit_admin_id INT NULL COMMENT '审核管理员ID'",
      'merchant',
      'audit_admin_id'
    );

    // 可选索引：加速筛选
    try {
      await pool.query('CREATE INDEX idx_merchant_audit_status ON merchant (audit_status)');
      console.log('✅ 已添加索引 idx_merchant_audit_status');
    } catch (e) {
      // 索引已存在等情况
      console.log(`ℹ️  索引 idx_merchant_audit_status 添加跳过：${e.message}`);
    }
  } catch (error) {
    console.error('❌ merchant 表审核字段更新失败:', error.message);
  } finally {
    try {
      await pool.end();
    } catch (_) {
      // ignore
    }
    process.exit();
  }
}

updateMerchantTable();
