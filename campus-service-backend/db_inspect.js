const mysql = require('mysql2/promise');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.error('Usage: node db_inspect.js <host> <port> <user> <password> <database>');
    process.exit(2);
  }
  const [host, port, user, password, database] = args;
  const config = { host, port: Number(port), user, password, database };
  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('CONNECTED');

    const [tables] = await conn.query("SHOW TABLES");
    console.log('\n=== TABLES ===');
    console.log(JSON.stringify(tables, null, 2));

    console.log('\n=== COLUMNS FROM notification ===');
    try {
      const [cols] = await conn.query('SHOW COLUMNS FROM notification');
      console.log(JSON.stringify(cols, null, 2));
    } catch (e) {
      console.error('ERROR_SHOW_COLUMNS_NOTIFICATION:', e.message);
    }

    console.log('\n=== SAMPLE FROM notification (10 rows) ===');
    try {
      const [rows] = await conn.query('SELECT * FROM notification ORDER BY created_at DESC LIMIT 10');
      console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
      console.error('ERROR_SELECT_NOTIFICATION:', e.message);
    }

    await conn.end();
  } catch (err) {
    console.error('CONN_ERROR:', err.message);
    if (conn) await conn.end().catch(()=>{});
    process.exit(3);
  }
}

main();
