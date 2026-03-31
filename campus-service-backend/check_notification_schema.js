require('dotenv').config();

const { pool } = require('./config/db');

async function main() {
  const [cols] = await pool.query('SHOW COLUMNS FROM notification');

  const scheduledTimeExists = cols.some(
    (c) => String(c.Field).toLowerCase() === 'scheduled_time'
  );

  console.log(
    'notification columns:',
    cols.map((c) => ({
      Field: c.Field,
      Type: c.Type,
      Null: c.Null,
      Default: c.Default,
      Extra: c.Extra
    }))
  );
  console.log('scheduled_time exists:', scheduledTimeExists);

  const [logCols] = await pool.query('SHOW COLUMNS FROM admin_operation_log');
  console.log(
    'admin_operation_log columns:',
    logCols.map((c) => ({
      Field: c.Field,
      Type: c.Type,
      Null: c.Null,
      Default: c.Default,
      Extra: c.Extra
    }))
  );
}

main().catch((e) => {
  console.error('CHECK_SCHEMA_ERROR:', e.message);
  process.exitCode = 1;
});
