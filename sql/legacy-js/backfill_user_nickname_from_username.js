const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', 'campus-service-backend', '.env')
});

const { pool } = require('../../campus-service-backend/config/db');

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return (rows[0] && rows[0].cnt > 0) || false;
}

async function main() {
  const hasUsername = await columnExists('user', 'username');
  if (!hasUsername) {
    console.error('❌ user.username 列不存在，先运行 migrate_schema_compat.js 再重试');
    process.exitCode = 1;
    return;
  }

  const [result] = await pool.query(
    `UPDATE user
     SET nickname = username
     WHERE (nickname IS NULL OR nickname = '' OR nickname = '新用户')
       AND username IS NOT NULL AND username <> ''`
  );

  console.log(`✅ 已回填 nickname：影响行数 ${result.affectedRows}`);
}

main()
  .catch((e) => {
    console.error('❌ 回填失败:', e && e.message ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_) {
      // ignore
    }
  });
