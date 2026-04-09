/*
  Dedupe categories and update product.category_id references.

  Usage:
    node dedupe_categories.js --dry-run
    node dedupe_categories.js --apply

  Options:
    --type=1            Only process categories of a given type (default: 1)
    --merchant=all      Process all merchants (default)
    --merchant=null     Only process public categories (merchant_id IS NULL)
    --merchant=123      Only process categories for one merchant_id
    --case-insensitive  Treat names as case-insensitive when grouping (default: true)

  Safety:
    - Defaults to dry-run
    - Wraps apply mode in a transaction
*/

const { pool } = require('./config/db');

function endPool() {
  if (!pool || typeof pool.end !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    try {
      pool.end(() => resolve());
    } catch (_) {
      resolve();
    }
  });
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    apply: false,
    type: 1,
    merchant: 'all',
    caseInsensitive: true
  };

  for (const raw of argv) {
    if (raw === '--apply') {
      args.apply = true;
      args.dryRun = false;
      continue;
    }
    if (raw === '--dry-run') {
      args.dryRun = true;
      args.apply = false;
      continue;
    }
    if (raw.startsWith('--type=')) {
      const v = parseInt(raw.slice('--type='.length), 10);
      if (Number.isFinite(v)) args.type = v;
      continue;
    }
    if (raw.startsWith('--merchant=')) {
      const v = raw.slice('--merchant='.length);
      args.merchant = v;
      continue;
    }
    if (raw === '--case-insensitive') {
      args.caseInsensitive = true;
      continue;
    }
    if (raw === '--case-sensitive') {
      args.caseInsensitive = false;
      continue;
    }
  }

  return args;
}

function normalizeName(name, caseInsensitive) {
  const s = String(name || '').trim();
  return caseInsensitive ? s.toLowerCase() : s;
}

function formatMerchantKey(merchantId) {
  return merchantId === null || merchantId === undefined ? 'NULL' : String(merchantId);
}

async function fetchCategories(conn, { type, merchant }) {
  let where = 'WHERE type = ?';
  const params = [type];

  if (merchant === 'null') {
    where += ' AND merchant_id IS NULL';
  } else if (merchant !== 'all') {
    const mid = parseInt(String(merchant), 10);
    if (!Number.isFinite(mid) || mid <= 0) {
      throw new Error(`Invalid --merchant=${merchant}`);
    }
    where += ' AND merchant_id = ?';
    params.push(mid);
  }

  const sql = `SELECT id, merchant_id, name, type FROM category ${where} ORDER BY id ASC`;
  const [rows] = await conn.query(sql, params);
  return Array.isArray(rows) ? rows : [];
}

function buildPlan(rows, caseInsensitive) {
  // group by (type, merchant_id, normalizedName)
  const groups = new Map();

  for (const row of rows) {
    const merchantKey = formatMerchantKey(row.merchant_id);
    const nameKey = normalizeName(row.name, caseInsensitive);
    const key = `${row.type}::${merchantKey}::${nameKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const merges = [];
  for (const [key, list] of groups.entries()) {
    if (!list || list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => a.id - b.id);
    const keep = sorted[0];
    const remove = sorted.slice(1);
    merges.push({ key, keep, remove });
  }

  return merges;
}

async function applyPlan(conn, merges) {
  let totalUpdatedProducts = 0;
  let totalDeletedCategories = 0;

  for (const m of merges) {
    const keepId = m.keep.id;
    const removeIds = m.remove.map((r) => r.id);

    // 1) Update product.category_id
    const [updRes] = await conn.query(
      `UPDATE product SET category_id = ? WHERE category_id IN (${removeIds.map(() => '?').join(',')})`,
      [keepId, ...removeIds]
    );

    const affected = updRes && typeof updRes.affectedRows === 'number' ? updRes.affectedRows : 0;
    totalUpdatedProducts += affected;

    // 2) Delete duplicate categories
    const [delRes] = await conn.query(
      `DELETE FROM category WHERE id IN (${removeIds.map(() => '?').join(',')})`,
      removeIds
    );

    const deleted = delRes && typeof delRes.affectedRows === 'number' ? delRes.affectedRows : 0;
    totalDeletedCategories += deleted;
  }

  return { totalUpdatedProducts, totalDeletedCategories };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const conn = await pool.getConnection();
  try {
    if (args.apply) {
      await conn.beginTransaction();
    }

    const rows = await fetchCategories(conn, args);
    const merges = buildPlan(rows, args.caseInsensitive);

    console.log('--- Dedupe Categories ---');
    console.log('mode:', args.apply ? 'APPLY' : 'DRY-RUN');
    console.log('type:', args.type);
    console.log('merchant:', args.merchant);
    console.log('caseInsensitive:', args.caseInsensitive);
    console.log('categories scanned:', rows.length);
    console.log('duplicate groups:', merges.length);

    if (merges.length === 0) {
      if (args.apply) await conn.commit();
      console.log('No duplicates found.');
      return;
    }

    // Print plan (capped)
    const maxPrint = 50;
    merges.slice(0, maxPrint).forEach((m, idx) => {
      const keep = m.keep;
      const removeIds = m.remove.map((r) => r.id).join(', ');
      console.log(
        `${idx + 1}. keep #${keep.id} (merchant_id=${formatMerchantKey(keep.merchant_id)}, name="${String(keep.name).trim()}") <- remove [${removeIds}]`
      );
    });
    if (merges.length > maxPrint) {
      console.log(`... (${merges.length - maxPrint} more groups not shown)`);
    }

    if (!args.apply) {
      console.log('Dry-run complete. Re-run with --apply to execute changes.');
      return;
    }

    const result = await applyPlan(conn, merges);
    await conn.commit();

    console.log('--- APPLY DONE ---');
    console.log('products updated:', result.totalUpdatedProducts);
    console.log('duplicate categories deleted:', result.totalDeletedCategories);
  } catch (err) {
    try {
      if (args.apply) await conn.rollback();
    } catch (_) {
      // ignore
    }
    console.error('FAILED:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await endPool();
  }
}

main();
