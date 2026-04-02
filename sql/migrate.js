#!/usr/bin/env node
/*
  Simple migration runner for this repo.
  - Migrations live in: <repoRoot>/sql/migrations/<migrationName>/{up.sql,down.sql}
  - Applied migrations recorded in: schema_migrations

  Why not wrap in a DB transaction?
  - MySQL DDL auto-commits; transactions can't reliably rollback CREATE/ALTER.
  - We provide explicit down.sql as "撤回" (best-effort rollback).
*/

const fs = require('fs');
const path = require('path');

function requireFromBackend(moduleId, backendRoot) {
  try {
    // Try normal Node resolution first (works if repo root has node_modules)
    return require(moduleId);
  } catch (_) {
    // Fall back to backend's node_modules to avoid duplicating dependencies at repo root
    const resolved = require.resolve(moduleId, { paths: [backendRoot] });
    return require(resolved);
  }
}

const repoRoot = path.resolve(__dirname, '..');
const backendRoot = path.join(repoRoot, 'campus-service-backend');
const backendEnvPath = path.join(repoRoot, 'campus-service-backend', '.env');

const mysql = requireFromBackend('mysql2/promise', backendRoot);
const dotenv = requireFromBackend('dotenv', backendRoot);

dotenv.config({ path: backendEnvPath });

function usage(exitCode = 0) {
  const cmd = path.relative(repoRoot, __filename).replace(/\\/g, '/');
  console.log(`\nUsage:\n  node ${cmd} <command> [options]\n\nCommands:\n  status               Show applied/pending migrations\n  up [--to <name>]      Apply pending migrations (optionally up to name)\n  down [--steps N]      Rollback last N migrations (default 1)\n\nOptions:\n  --dry-run             Print what would run, do nothing\n  --rollback-on-fail     If a migration fails, run its down.sql (best-effort)\n  --env <path>           Override env file path (default: campus-service-backend/.env)\n\nExamples:\n  node ${cmd} status\n  node ${cmd} up --rollback-on-fail\n  node ${cmd} down --steps 1\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const opts = { dryRun: false, rollbackOnFail: false, to: null, steps: 1, envPath: null };

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--rollback-on-fail') opts.rollbackOnFail = true;
    else if (a === '--to') opts.to = args[++i];
    else if (a === '--steps') opts.steps = Number(args[++i] || 1);
    else if (a === '--env') opts.envPath = args[++i];
    else if (!a) {}
    else {
      console.error('Unknown option:', a);
      usage(2);
    }
  }

  return { command, opts };
}

function loadSqlFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function splitSqlStatements(sqlText) {
  // Basic SQL splitter: handles strings, backticks, -- and /* */ comments.
  // It is sufficient for our migration style (no DELIMITER blocks).
  const statements = [];
  let current = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < sqlText.length) {
    const ch = sqlText[i];
    const next = i + 1 < sqlText.length ? sqlText[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        current += ch;
      }
      i++;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '-' && next === '-') {
        inLineComment = true;
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i += 2;
        continue;
      }
    }

    if (ch === "'" && !inDouble && !inBacktick) {
      // handle escaped single quote '' and backslash escapes
      if (inSingle) {
        if (next === "'") {
          current += "''";
          i += 2;
          continue;
        }
        inSingle = false;
      } else {
        inSingle = true;
      }
      current += ch;
      i++;
      continue;
    }

    if (ch === '"' && !inSingle && !inBacktick) {
      inDouble = !inDouble;
      current += ch;
      i++;
      continue;
    }

    if (ch === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
      current += ch;
      i++;
      continue;
    }

    if (ch === ';' && !inSingle && !inDouble && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function getMigrationsDir() {
  return path.join(repoRoot, 'sql', 'migrations');
}

function listMigrationNames() {
  const dir = getMigrationsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .sort();
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      migration VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function getAppliedMigrations(conn) {
  const [rows] = await conn.query('SELECT migration, applied_at FROM schema_migrations ORDER BY migration ASC');
  return rows.map((r) => ({ migration: r.migration, appliedAt: r.applied_at }));
}

async function runSqlStatements(conn, sqlText, { dryRun }) {
  const statements = splitSqlStatements(sqlText);
  for (const stmt of statements) {
    if (dryRun) {
      console.log('---');
      console.log(stmt);
      continue;
    }
    await conn.query(stmt);
  }
}

async function withConnection(fn) {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !database) {
    throw new Error('Missing DB env vars. Expected DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (loaded from .env).');
  }

  const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: false });
  try {
    await fn(conn);
  } finally {
    await conn.end();
  }
}

async function cmdStatus(opts) {
  await withConnection(async (conn) => {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    const appliedSet = new Set(applied.map((a) => a.migration));

    const all = listMigrationNames();
    const pending = all.filter((m) => !appliedSet.has(m));

    console.log('\nApplied migrations:');
    if (applied.length === 0) console.log('  (none)');
    for (const a of applied) {
      console.log(`  ${a.migration}  @ ${a.appliedAt}`);
    }

    console.log('\nPending migrations:');
    if (pending.length === 0) console.log('  (none)');
    for (const m of pending) console.log('  ' + m);

    if (opts.dryRun) {
      console.log('\n(dry-run mode)');
    }
  });
}

async function applyOneMigration(conn, name, opts) {
  const dir = path.join(getMigrationsDir(), name);
  const upPath = path.join(dir, 'up.sql');
  const downPath = path.join(dir, 'down.sql');

  const upSql = loadSqlFile(upPath);
  if (!upSql) throw new Error(`Missing up.sql for migration: ${name}`);

  console.log(`\n==> Applying: ${name}`);
  try {
    await runSqlStatements(conn, upSql, opts);
  } catch (e) {
    console.error(`❌ Migration failed: ${name}`);
    console.error(e && e.message ? e.message : e);

    if (opts.rollbackOnFail) {
      const downSql = loadSqlFile(downPath);
      if (downSql) {
        console.log(`\n==> Rollback on fail (best-effort): ${name}`);
        try {
          await runSqlStatements(conn, downSql, opts);
        } catch (rollbackErr) {
          console.error('⚠️  Rollback attempt failed:', rollbackErr && rollbackErr.message ? rollbackErr.message : rollbackErr);
        }
      } else {
        console.log('⚠️  No down.sql found; cannot rollback automatically.');
      }
    }

    throw e;
  }

  if (!opts.dryRun) {
    await conn.query('INSERT INTO schema_migrations (migration) VALUES (?)', [name]);
  }
  console.log(`✅ Applied: ${name}`);
}

async function cmdUp(opts) {
  await withConnection(async (conn) => {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    const appliedSet = new Set(applied.map((a) => a.migration));

    const all = listMigrationNames();
    let pending = all.filter((m) => !appliedSet.has(m));
    if (opts.to) {
      pending = pending.filter((m) => m <= opts.to);
    }

    if (pending.length === 0) {
      console.log('\nNo pending migrations.');
      return;
    }

    for (const m of pending) {
      await applyOneMigration(conn, m, opts);
    }
  });
}

async function rollbackOneMigration(conn, name, opts) {
  const dir = path.join(getMigrationsDir(), name);
  const downPath = path.join(dir, 'down.sql');
  const downSql = loadSqlFile(downPath);
  if (!downSql) throw new Error(`Missing down.sql for migration: ${name}`);

  console.log(`\n==> Rolling back: ${name}`);
  await runSqlStatements(conn, downSql, opts);

  if (!opts.dryRun) {
    await conn.query('DELETE FROM schema_migrations WHERE migration = ?', [name]);
  }
  console.log(`✅ Rolled back: ${name}`);
}

async function cmdDown(opts) {
  const steps = Number.isFinite(opts.steps) && opts.steps > 0 ? Math.floor(opts.steps) : 1;

  await withConnection(async (conn) => {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    if (applied.length === 0) {
      console.log('\nNo applied migrations to rollback.');
      return;
    }

    const toRollback = applied.map((a) => a.migration).slice(-steps).reverse();
    for (const m of toRollback) {
      await rollbackOneMigration(conn, m, opts);
    }
  });
}

async function main() {
  const { command, opts } = parseArgs(process.argv);

  if (opts.envPath) {
    dotenv.config({ path: path.resolve(process.cwd(), opts.envPath) });
  }

  if (!command || command === '-h' || command === '--help' || command === 'help') usage(0);

  if (command === 'status') return cmdStatus(opts);
  if (command === 'up') return cmdUp(opts);
  if (command === 'down') return cmdDown(opts);

  console.error('Unknown command:', command);
  usage(2);
}

main().catch((e) => {
  console.error('\nFATAL:', e && e.message ? e.message : e);
  process.exitCode = 1;
});
