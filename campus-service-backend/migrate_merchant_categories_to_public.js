/*
  Migrate merchant-specific categories (category.merchant_id IS NOT NULL)
  to shared public categories (merchant_id IS NULL) by name, and update
  product.category_id references.

  Why:
    - Student side now lists only public categories
    - Merchant side should reuse shared categories

  Usage:
    node migrate_merchant_categories_to_public.js --dry-run
    node migrate_merchant_categories_to_public.js --apply

  Options:
    --type=1               Only process categories of a given type (default: 1)
    --case-insensitive     Match by lower(TRIM(name)) (default: true)

  Safety:
    - Defaults to dry-run
    - apply mode runs in a transaction
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

async function getCategoryColumns(conn) {
  try {
    const [rows] = await conn.query('SHOW COLUMNS FROM `category`');
    const set = new Set((rows || []).map((r) => r && r.Field).filter(Boolean));
    return set;
  } catch (_) {
    return new Set(['id', 'merchant_id', 'name', 'type']);
  }
}

function pick(obj, key, fallback) {
  if (!obj) return fallback;
  const v = obj[key];
  return v === undefined || v === null ? fallback : v;
}

async function findPublicCategoryId(conn, { type, name, caseInsensitive }) {
  if (caseInsensitive) {
    const [rows] = await conn.query(
      'SELECT id FROM category WHERE type = ? AND merchant_id IS NULL AND LOWER(TRIM(name)) = LOWER(?) ORDER BY id ASC LIMIT 1',
      [type, String(name).trim()]
    );
    return rows && rows[0] && rows[0].id ? parseInt(rows[0].id, 10) : null;
  }

  const [rows] = await conn.query(
    'SELECT id FROM category WHERE type = ? AND merchant_id IS NULL AND TRIM(name) = ? ORDER BY id ASC LIMIT 1',
    [type, String(name).trim()]
  );
  return rows && rows[0] && rows[0].id ? parseInt(rows[0].id, 10) : null;
}

async function createPublicCategory(conn, columns, source, type) {
  const name = String(source.name || '').trim();
  const insertCols = ['merchant_id', 'name', 'type'];
  const insertVals = [null, name, type];

  if (columns.has('icon')) {
    insertCols.push('icon');
    insertVals.push(String(pick(source, 'icon', '') || ''));
  }
  if (columns.has('sort_order')) {
    insertCols.push('sort_order');
    const soRaw = pick(source, 'sort_order', 0);
    const so = soRaw === '' || soRaw === null || soRaw === undefined ? 0 : parseInt(soRaw, 10);
    insertVals.push(Number.isFinite(so) ? so : 0);
  }

  const sql = `INSERT INTO category (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`;
  const [res] = await conn.query(sql, insertVals);
  const id = res && res.insertId ? parseInt(res.insertId, 10) : null;
  if (!id) throw new Error('Failed to create public category');
  return id;
}

async function countProductsByCategory(conn, categoryId) {
  const [rows] = await conn.query('SELECT COUNT(*) AS cnt FROM product WHERE category_id = ?', [categoryId]);
  const cnt = rows && rows[0] && rows[0].cnt !== undefined ? parseInt(rows[0].cnt, 10) : 0;
  return Number.isFinite(cnt) ? cnt : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const conn = await pool.getConnection();
  try {
    if (args.apply) await conn.beginTransaction();

    const columns = await getCategoryColumns(conn);

    const selectCols = ['id', 'merchant_id', 'name', 'type'];
    if (columns.has('icon')) selectCols.push('icon');
    if (columns.has('sort_order')) selectCols.push('sort_order');

    const [merchantCats] = await conn.query(
      `SELECT ${selectCols.join(', ')} FROM category WHERE type = ? AND merchant_id IS NOT NULL ORDER BY id ASC`,
      [args.type]
    );

    const list = Array.isArray(merchantCats) ? merchantCats : [];

    console.log('--- Migrate Merchant Categories -> Public ---');
    console.log('mode:', args.apply ? 'APPLY' : 'DRY-RUN');
    console.log('type:', args.type);
    console.log('caseInsensitive:', args.caseInsensitive);
    console.log('merchant categories scanned:', list.length);

    if (list.length === 0) {
      if (args.apply) await conn.commit();
      console.log('No merchant-specific categories found.');
      return;
    }

    const plan = [];
    for (const c of list) {
      const name = String(c.name || '').trim();
      if (!name) continue;

      let publicId = await findPublicCategoryId(conn, {
        type: args.type,
        name,
        caseInsensitive: args.caseInsensitive
      });

      let action = publicId ? 'MAP' : 'CREATE';
      plan.push({
        merchantCategoryId: parseInt(c.id, 10),
        merchantId: c.merchant_id,
        name,
        publicCategoryId: publicId,
        action
      });
    }

    // Print plan summary
    const createCount = plan.filter((p) => p.action === 'CREATE').length;
    const mapCount = plan.filter((p) => p.action === 'MAP').length;
    console.log('plan:', { map: mapCount, create: createCount });

    const maxPrint = 50;
    plan.slice(0, maxPrint).forEach((p, idx) => {
      console.log(
        `${idx + 1}. ${p.action} merchant_cat#${p.merchantCategoryId} (merchant_id=${p.merchantId}, name="${p.name}") -> public#${p.publicCategoryId || 'NEW'}`
      );
    });
    if (plan.length > maxPrint) console.log(`... (${plan.length - maxPrint} more rows not shown)`);

    if (!args.apply) {
      console.log('Dry-run complete. Re-run with --apply to execute changes.');
      return;
    }

    let created = 0;
    let updatedProducts = 0;
    let deletedMerchantCategories = 0;

    for (const p of plan) {
      let publicId = p.publicCategoryId;
      if (!publicId) {
        // Create a public category based on merchant category fields
        const source = list.find((x) => String(x.id) === String(p.merchantCategoryId));
        publicId = await createPublicCategory(conn, columns, source || { name: p.name }, args.type);
        created += 1;
      }

      // Update products
      const [updRes] = await conn.query(
        'UPDATE product SET category_id = ? WHERE category_id = ?',
        [publicId, p.merchantCategoryId]
      );
      const affected = updRes && typeof updRes.affectedRows === 'number' ? updRes.affectedRows : 0;
      updatedProducts += affected;

      // Delete merchant category if now unused
      const left = await countProductsByCategory(conn, p.merchantCategoryId);
      if (left === 0) {
        const [delRes] = await conn.query('DELETE FROM category WHERE id = ?', [p.merchantCategoryId]);
        const del = delRes && typeof delRes.affectedRows === 'number' ? delRes.affectedRows : 0;
        deletedMerchantCategories += del;
      }
    }

    await conn.commit();

    console.log('--- APPLY DONE ---');
    console.log('public categories created:', created);
    console.log('products updated:', updatedProducts);
    console.log('merchant categories deleted:', deletedMerchantCategories);
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
