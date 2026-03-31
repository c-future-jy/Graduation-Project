const { pool } = require('../config/db');

const ok = (res, data) => res.json({ success: true, data });
const bad = (res, code, message) => res.status(code).json({ success: false, message });

function getMerchantId(req) {
  return req.user && req.user.merchant_id ? parseInt(req.user.merchant_id, 10) : null;
}

function isYmd(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''));
}

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

// GET /api/merchant/dashboard/stats
exports.getStats = async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    if (!merchantId) return bad(res, 403, '商家身份验证失败');

    const [[todayOrdersRow]] = await pool.query(
      'SELECT COUNT(*) as count FROM `order` WHERE merchant_id = ? AND DATE(created_at) = CURDATE()',
      [merchantId]
    );
    const todayOrders = Number(todayOrdersRow.count) || 0;

    const [[todaySalesRow]] = await pool.query(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM `order` WHERE merchant_id = ? AND status IN (1,2,3) AND DATE(created_at) = CURDATE()',
      [merchantId]
    );
    const todaySales = Number(todaySalesRow.total) || 0;

    const [[pendingOrdersRow]] = await pool.query(
      'SELECT COUNT(*) as count FROM `order` WHERE merchant_id = ? AND status = 1',
      [merchantId]
    );
    const pendingOrders = Number(pendingOrdersRow.count) || 0;

    const [[monthOrdersRow]] = await pool.query(
      'SELECT COUNT(*) as count FROM `order` WHERE merchant_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())',
      [merchantId]
    );
    const monthOrders = Number(monthOrdersRow.count) || 0;

    const [[monthSalesRow]] = await pool.query(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM `order` WHERE merchant_id = ? AND status IN (1,2,3) AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())',
      [merchantId]
    );
    const monthSales = Number(monthSalesRow.total) || 0;

    const [[totalProductsRow]] = await pool.query(
      'SELECT COUNT(*) as count FROM product WHERE merchant_id = ?',
      [merchantId]
    );
    const totalProducts = Number(totalProductsRow.count) || 0;

    const [[lowStockProductsRow]] = await pool.query(
      'SELECT COUNT(*) as count FROM product WHERE merchant_id = ? AND status = 1 AND stock < 10',
      [merchantId]
    );
    const lowStockProducts = Number(lowStockProductsRow.count) || 0;

    const todayAvgOrder = todayOrders > 0 ? Number((todaySales / todayOrders).toFixed(2)) : 0;

    ok(res, {
      todayOrders,
      todaySales,
      todayAvgOrder,
      pendingOrders,
      monthOrders,
      monthSales,
      totalProducts,
      lowStockProducts
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/merchant/dashboard/trend?days=7
exports.getTrend = async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    if (!merchantId) return bad(res, 403, '商家身份验证失败');

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let rangeStart;
    let rangeEnd;
    let days;

    if (isYmd(startDate) && isYmd(endDate)) {
      rangeStart = new Date(String(startDate) + 'T00:00:00');
      rangeEnd = new Date(String(endDate) + 'T00:00:00');
      if (rangeStart > rangeEnd) {
        return bad(res, 400, 'startDate 不能晚于 endDate');
      }
      // 限制最大 31 天，防止过大查询
      const diffDays = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 3600 * 1000)) + 1;
      days = Math.min(Math.max(diffDays, 1), 31);
      rangeEnd = addDays(rangeStart, days - 1);
    } else {
      days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 31);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      rangeEnd = today;
      rangeStart = addDays(today, -(days - 1));
    }

    const startKey = rangeStart.toISOString().slice(0, 10);
    const endKey = rangeEnd.toISOString().slice(0, 10);

    const [rows] = await pool.query(
      `SELECT
         DATE(created_at) as date,
         COUNT(*) as orderCount,
         COALESCE(SUM(CASE WHEN status IN (1,2,3) THEN total_amount ELSE 0 END), 0) as sales
       FROM \`order\`
       WHERE merchant_id = ? AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [merchantId, startKey, endKey]
    );

    // 填充缺失日期
    const map = new Map();
    rows.forEach((r) => {
      const key = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date);
      map.set(key, {
        date: key,
        orderCount: Number(r.orderCount) || 0,
        sales: Number(r.sales) || 0
      });
    });

    const trend = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(rangeStart, i);
      const key = d.toISOString().slice(0, 10);
      trend.push(map.get(key) || { date: key, orderCount: 0, sales: 0 });
    }

    ok(res, { days, startDate: startKey, endDate: endKey, trend });
  } catch (err) {
    next(err);
  }
};

// GET /api/merchant/dashboard/order-status?days=7 or startDate/endDate
exports.getOrderStatus = async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    if (!merchantId) return bad(res, 403, '商家身份验证失败');

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let rangeStart;
    let rangeEnd;
    let days;

    if (isYmd(startDate) && isYmd(endDate)) {
      rangeStart = new Date(String(startDate) + 'T00:00:00');
      rangeEnd = new Date(String(endDate) + 'T00:00:00');
      if (rangeStart > rangeEnd) {
        return bad(res, 400, 'startDate 不能晚于 endDate');
      }
      const diffDays = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 3600 * 1000)) + 1;
      days = Math.min(Math.max(diffDays, 1), 31);
      rangeEnd = addDays(rangeStart, days - 1);
    } else {
      days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 31);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      rangeEnd = today;
      rangeStart = addDays(today, -(days - 1));
    }

    const startKey = rangeStart.toISOString().slice(0, 10);
    const endKey = rangeEnd.toISOString().slice(0, 10);

    const [rows] = await pool.query(
      'SELECT status, COUNT(*) as count FROM `order` WHERE merchant_id = ? AND DATE(created_at) BETWEEN ? AND ? GROUP BY status',
      [merchantId, startKey, endKey]
    );

    const statusName = {
      0: '待支付',
      1: '待发货',
      2: '已发货',
      3: '已完成',
      4: '已取消'
    };
    const counts = new Map();
    rows.forEach((r) => counts.set(Number(r.status), Number(r.count) || 0));
    const data = [0, 1, 2, 3, 4].map((s) => ({ status: statusName[s], value: counts.get(s) || 0 }));

    ok(res, { days, startDate: startKey, endDate: endKey, items: data });
  } catch (err) {
    next(err);
  }
};

// GET /api/merchant/dashboard/top-products?limit=5
exports.getTopProducts = async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    if (!merchantId) return bad(res, 403, '商家身份验证失败');

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);

    const [rows] = await pool.query(
      `SELECT
         p.id,
         p.name,
         COALESCE(SUM(oi.quantity), 0) as sales
       FROM product p
       LEFT JOIN order_item oi ON oi.product_id = p.id
       LEFT JOIN \`order\` o ON o.id = oi.order_id AND o.merchant_id = ? AND o.status IN (2,3)
       WHERE p.merchant_id = ?
       GROUP BY p.id
       ORDER BY sales DESC, p.id DESC
       LIMIT ?`,
      [merchantId, merchantId, limit]
    );

    ok(res, {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        sales: Number(r.sales) || 0
      }))
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/merchant/dashboard/recent-orders?limit=5
exports.getRecentOrders = async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    if (!merchantId) return bad(res, 403, '商家身份验证失败');

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);

    const [rows] = await pool.query(
      'SELECT id, order_no as orderNo, status, total_amount as amount, created_at as createdAt FROM `order` WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ?',
      [merchantId, limit]
    );

    ok(res, { orders: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/merchant/dashboard/low-stock?threshold=10&limit=10
exports.getLowStock = async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    if (!merchantId) return bad(res, 403, '商家身份验证失败');

    const threshold = Math.min(Math.max(parseInt(req.query.threshold, 10) || 10, 1), 9999);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    const [rows] = await pool.query(
      'SELECT id, name, stock FROM product WHERE merchant_id = ? AND status = 1 AND stock < ? ORDER BY stock ASC, id DESC LIMIT ?',
      [merchantId, threshold, limit]
    );

    ok(res, { threshold, items: rows });
  } catch (err) {
    next(err);
  }
};
