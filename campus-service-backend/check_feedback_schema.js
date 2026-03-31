require('dotenv').config();

const { pool } = require('./config/db');
const fs = require('fs');
const path = require('path');

async function getTableColumns(tableName) {
  const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(cols.map((c) => c.Field));
}

async function main() {
  const out = {
    ok: true,
    feedbackColumns: null,
    sampleRow: null,
    sampleQueryError: null
  };

  const [cols] = await pool.query('SHOW COLUMNS FROM feedback');
  out.feedbackColumns = cols.map((c) => ({
    Field: c.Field,
    Type: c.Type,
    Null: c.Null,
    Default: c.Default,
    Extra: c.Extra
  }));

  const feedbackColSet = await getTableColumns('feedback');
  const timeColumn = feedbackColSet.has('create_time')
    ? 'create_time'
    : feedbackColSet.has('created_at')
      ? 'created_at'
      : null;

  // Try the same style of query used by admin feedback list
  const query = `
    SELECT 
      f.*,
      u.nickname as user_name,
      m.name as merchant_name,
      o.order_no as order_no
    FROM 
      feedback f
    LEFT JOIN 
      user u ON f.user_id = u.id
    LEFT JOIN 
      merchant m ON f.merchant_id = m.id
    LEFT JOIN 
      \`order\` o ON f.order_id = o.id
    ${timeColumn ? `ORDER BY f.${timeColumn} DESC` : 'ORDER BY f.id DESC'}
    LIMIT 1
  `;

  try {
    const [rows] = await pool.query(query);
    out.sampleRow = rows[0] || null;
  } catch (e) {
    out.ok = false;
    out.sampleQueryError = e && e.message ? e.message : String(e);
  }

  const outPath = path.join(__dirname, 'check_feedback_schema_output.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
}

main().catch((e) => {
  try {
    const outPath = require('path').join(__dirname, 'check_feedback_schema_output.json');
    require('fs').writeFileSync(
      outPath,
      JSON.stringify({ ok: false, fatal: e && e.message ? e.message : String(e) }, null, 2),
      'utf8'
    );
  } catch (_) {}
  process.exitCode = 1;
});
