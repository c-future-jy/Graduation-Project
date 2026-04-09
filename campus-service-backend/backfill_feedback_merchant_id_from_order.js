const { pool } = require('./config/db');

async function getColumns(tableName) {
  const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set((cols || []).map((c) => c.Field));
}

async function main() {
  const feedbackCols = await getColumns('feedback');
  const orderCols = await getColumns('order');

  if (!feedbackCols.has('type') || !feedbackCols.has('merchant_id') || !feedbackCols.has('order_id')) {
    throw new Error('feedback 表缺少必要字段(type/merchant_id/order_id)，无法回填');
  }
  if (!orderCols.has('merchant_id')) {
    throw new Error('order 表缺少 merchant_id 字段，无法回填');
  }

  const [result] = await pool.query(
    `
      UPDATE feedback f
      JOIN \`order\` o ON o.id = f.order_id
      SET f.merchant_id = o.merchant_id
      WHERE (f.merchant_id IS NULL OR f.merchant_id = 0)
        AND f.type = 1
        AND f.order_id IS NOT NULL
        AND o.merchant_id IS NOT NULL
    `
  );

  console.log('Backfill completed:', {
    affectedRows: result && result.affectedRows,
    changedRows: result && result.changedRows
  });
}

main()
  .catch((err) => {
    console.error('[backfill_feedback_merchant_id_from_order] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_) {
      // ignore
    }
  });
