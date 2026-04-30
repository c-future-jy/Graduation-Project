function toInt(value, fallback, { min = -Infinity, max = Infinity } = {}) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function getMerchantOwnerUserIdByMerchantId(merchantId, connOrPool) {
  if (!merchantId) return null;
  const [rows] = await connOrPool.query(
    'SELECT owner_user_id FROM merchant WHERE id = ? LIMIT 1',
    [merchantId]
  );
  const ownerUserId = rows && rows[0] && rows[0].owner_user_id;
  return ownerUserId ? parseInt(ownerUserId, 10) : null;
}

async function insertOrderNotification(connOrPool, userId, title, content) {
  if (!userId) return;
  await connOrPool.query(
    'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
    [userId, title, content, 3]
  );
}

async function cancelOneExpiredPendingOrder({ pool, order }) {
  const orderId = order && order.id;
  if (!orderId) return { cancelled: false, reason: 'missing_order_id' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 只取消仍为待支付的订单，避免与“刚支付成功”的并发冲突。
    const [upd] = await conn.query(
      'UPDATE `order` SET status = 4, updated_at = NOW() WHERE id = ? AND status = 0',
      [orderId]
    );

    if (!upd || upd.affectedRows !== 1) {
      await conn.rollback();
      return { cancelled: false, reason: 'status_changed' };
    }

    const [items] = await conn.query(
      'SELECT product_id, quantity FROM order_item WHERE order_id = ?',
      [orderId]
    );

    for (const item of items || []) {
      const productId = item && item.product_id;
      const quantity = Math.max(parseInt(item && item.quantity, 10) || 0, 0);
      if (!productId || quantity <= 0) continue;
      await conn.query(
        'UPDATE product SET stock = stock + ? WHERE id = ?',
        [quantity, productId]
      );
    }

    // 通知商家：订单超时自动取消（失败不影响主流程）
    try {
      const ownerUserId = await getMerchantOwnerUserIdByMerchantId(order.merchant_id, conn);
      if (ownerUserId) {
        await insertOrderNotification(
          conn,
          ownerUserId,
          '订单已取消',
          `订单超时未支付，系统已自动取消${order.order_no ? `（${order.order_no}）` : ''}`
        );
      }
    } catch (_) {
      // ignore
    }

    await conn.commit();
    return { cancelled: true };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {
      // ignore
    }
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * 扫描并自动取消超时未支付订单（status=0）。
 * - 超时判断：TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= expireMinutes
 * - 取消后：status=4，并回滚库存
 */
async function runAutoCancelOnce({ pool, expireMinutes = 5, batchSize = 50 } = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('runAutoCancelOnce requires a mysql2 promise pool');
  }

  const minutes = toInt(expireMinutes, 5, { min: 1, max: 24 * 60 });
  const limit = toInt(batchSize, 50, { min: 1, max: 500 });

  const [orders] = await pool.query(
    'SELECT id, merchant_id, order_no FROM `order` WHERE status = 0 AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= ? ORDER BY created_at ASC LIMIT ?',
    [minutes, limit]
  );

  const list = Array.isArray(orders) ? orders : [];
  if (list.length === 0) {
    return { scanned: 0, cancelled: 0 };
  }

  let cancelled = 0;
  for (const order of list) {
    const r = await cancelOneExpiredPendingOrder({ pool, order });
    if (r && r.cancelled) cancelled++;
  }

  return { scanned: list.length, cancelled };
}

function startAutoCancelScheduler({
  pool,
  expireMinutes = 5,
  intervalMs = 60_000,
  batchSize = 50,
  logger = console
} = {}) {
  const interval = toInt(intervalMs, 60_000, { min: 5_000, max: 60 * 60 * 1000 });

  const timer = setInterval(async () => {
    try {
      const res = await runAutoCancelOnce({ pool, expireMinutes, batchSize });
      if (res && res.cancelled > 0) {
        logger.log(`⏱️ 自动取消超时待支付订单：${res.cancelled}/${res.scanned}`);
      }
    } catch (e) {
      logger.warn('⚠️ 自动取消超时订单任务执行失败:', e && e.message ? e.message : e);
    }
  }, interval);

  // 不阻止进程退出（避免影响测试/脚本）
  if (typeof timer.unref === 'function') timer.unref();

  return timer;
}

module.exports = {
  runAutoCancelOnce,
  startAutoCancelScheduler
};
