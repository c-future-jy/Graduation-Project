const { pool } = require('../config/db');

/**
 * 获取仪表盘核心统计数据
 * GET /api/admin/dashboard/stats
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const columnExists = async (tableName, columnName) => {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as cnt
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [tableName, columnName]
      );
      return (rows[0] && rows[0].cnt > 0) || false;
    };

    const calcPercentTrend = (todayValue, yesterdayValue) => {
      const todayNum = Number(todayValue) || 0;
      const yesterdayNum = Number(yesterdayValue) || 0;
      if (yesterdayNum === 0) {
        return todayNum === 0 ? 0 : 100;
      }
      return Math.round(((todayNum - yesterdayNum) / yesterdayNum) * 100);
    };

    // 总用户数
    const [totalUsersResult] = await pool.query('SELECT COUNT(*) as count FROM user');
    const totalUsers = totalUsersResult[0].count;

    // 总商家数
    const [totalMerchantsResult] = await pool.query('SELECT COUNT(*) as count FROM merchant');
    const totalMerchants = totalMerchantsResult[0].count;

    // 总商品数
    const [totalProductsResult] = await pool.query('SELECT COUNT(*) as count FROM product');
    const totalProducts = totalProductsResult[0].count;

    // 总订单数
    const [totalOrdersResult] = await pool.query('SELECT COUNT(*) as count FROM `order`');
    const totalOrders = totalOrdersResult[0].count;

    // 今日订单数
    const [todayOrdersResult] = await pool.query('SELECT COUNT(*) as count FROM `order` WHERE DATE(created_at) = CURDATE()');
    const todayOrders = todayOrdersResult[0].count;

    // 昨日订单数（用于趋势）
    const [yesterdayOrdersResult] = await pool.query(
      'SELECT COUNT(*) as count FROM `order` WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    );
    const yesterdayOrders = yesterdayOrdersResult[0].count;

    // 待处理反馈数
    const [pendingFeedbackResult] = await pool.query('SELECT COUNT(*) as count FROM feedback WHERE reply IS NULL');
    const pendingFeedback = pendingFeedbackResult[0].count;

    // 待审核商家数
    let pendingMerchants = 0;
    if (await columnExists('merchant', 'audit_status')) {
      const [pendingMerchantsResult] = await pool.query('SELECT COUNT(*) as count FROM merchant WHERE audit_status = 1');
      pendingMerchants = pendingMerchantsResult[0].count;
    }

    // 待处理订单数
    const [pendingOrdersResult] = await pool.query('SELECT COUNT(*) as count FROM `order` WHERE status IN (0, 1)');
    const pendingOrders = pendingOrdersResult[0].count;

    // 未读通知数
    const [unreadNotificationsResult] = await pool.query('SELECT COUNT(*) as count FROM notification WHERE is_read = 0');
    const unreadNotifications = unreadNotificationsResult[0].count;

    // 计算趋势数据（较昨日，百分比）
    const orderTrend = calcPercentTrend(todayOrders, yesterdayOrders);

    let userTrend = 0;
    let merchantTrend = 0;
    let productTrend = 0;

    if (await columnExists('user', 'created_at')) {
      const [todayNewUsersResult] = await pool.query(
        'SELECT COUNT(*) as count FROM user WHERE DATE(created_at) = CURDATE()'
      );
      const [yesterdayNewUsersResult] = await pool.query(
        'SELECT COUNT(*) as count FROM user WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
      );
      userTrend = calcPercentTrend(todayNewUsersResult[0].count, yesterdayNewUsersResult[0].count);
    }

    if (await columnExists('merchant', 'created_at')) {
      const [todayNewMerchantsResult] = await pool.query(
        'SELECT COUNT(*) as count FROM merchant WHERE DATE(created_at) = CURDATE()'
      );
      const [yesterdayNewMerchantsResult] = await pool.query(
        'SELECT COUNT(*) as count FROM merchant WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
      );
      merchantTrend = calcPercentTrend(todayNewMerchantsResult[0].count, yesterdayNewMerchantsResult[0].count);
    }

    if (await columnExists('product', 'created_at')) {
      const [todayNewProductsResult] = await pool.query(
        'SELECT COUNT(*) as count FROM product WHERE DATE(created_at) = CURDATE()'
      );
      const [yesterdayNewProductsResult] = await pool.query(
        'SELECT COUNT(*) as count FROM product WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
      );
      productTrend = calcPercentTrend(todayNewProductsResult[0].count, yesterdayNewProductsResult[0].count);
    }

    res.json({
      success: true,
      data: {
        totalUsers,
        totalMerchants,
        totalProducts,
        totalOrders,
        todayOrders,
        pendingFeedback,
        pendingMerchants,
        pendingOrders,
        unreadNotifications,
        orderTrend,
        userTrend,
        merchantTrend,
        productTrend
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取订单趋势数据
 * GET /api/admin/dashboard/order-trend
 */
exports.getOrderTrend = async (req, res, next) => {
  try {
    const { startTime, endTime, granularity = 'day' } = req.query;

    let dateFormat;
    switch (granularity) {
      case 'week':
        dateFormat = 'YEARWEEK(created_at, 1)'; // 周统计，1表示周一开始
        break;
      case 'month':
        dateFormat = 'DATE_FORMAT(created_at, "%Y-%m")'; // 月统计
        break;
      default:
        dateFormat = 'DATE_FORMAT(created_at, "%Y-%m-%d")'; // 日统计
    }

    let query = `
      SELECT 
        ${dateFormat} as date,
        COUNT(*) as orderCount,
        status
      FROM 
        \`order\`
    `;

    const queryParams = [];

    if (startTime && endTime) {
      query += ' WHERE created_at BETWEEN ? AND ?';
      queryParams.push(startTime, endTime);
    } else if (startTime) {
      query += ' WHERE created_at >= ?';
      queryParams.push(startTime);
    } else if (endTime) {
      query += ' WHERE created_at <= ?';
      queryParams.push(endTime);
    }

    query += ' GROUP BY date, status ORDER BY date';

    const [orderTrend] = await pool.query(query, queryParams);

    // 按日期和状态整理数据
    const result = {};
    orderTrend.forEach(item => {
      if (!result[item.date]) {
        result[item.date] = {};
      }
      result[item.date][item.status] = item.orderCount;
    });

    // 转换为前端需要的格式
    const formattedResult = Object.entries(result).map(([date, statuses]) => ({
      date,
      ...statuses
    }));

    res.json({
      success: true,
      data: formattedResult
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户趋势数据（按注册时间）
 * GET /api/admin/dashboard/user-trend
 */
exports.getUserTrend = async (req, res, next) => {
  try {
    const { startTime, endTime, granularity = 'day' } = req.query;

    const [colRows] = await pool.query(
      `SELECT COUNT(*) as cnt
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'created_at'`
    );
    const hasCreatedAt = (colRows && colRows[0] && colRows[0].cnt > 0) || false;
    if (!hasCreatedAt) {
      res.json({ success: true, data: [] });
      return;
    }

    let dateFormat;
    switch (granularity) {
      case 'week':
        dateFormat = 'YEARWEEK(created_at, 1)';
        break;
      case 'month':
        dateFormat = 'DATE_FORMAT(created_at, "%Y-%m")';
        break;
      default:
        dateFormat = 'DATE_FORMAT(created_at, "%Y-%m-%d")';
    }

    let query = `
      SELECT 
        ${dateFormat} as date,
        COUNT(*) as userCount
      FROM 
        user
    `;

    const queryParams = [];
    const where = [];

    if (startTime) {
      where.push('created_at >= ?');
      queryParams.push(startTime);
    }
    if (endTime) {
      where.push('created_at <= ?');
      queryParams.push(endTime);
    }

    if (where.length > 0) {
      query += ' WHERE ' + where.join(' AND ');
    }

    query += ' GROUP BY date ORDER BY date';

    const [rows] = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取营业额统计数据
 * GET /api/admin/dashboard/revenue
 */
exports.getRevenue = async (req, res, next) => {
  try {
    const { startTime, endTime } = req.query;

    // 总营业额（已发货和已完成订单）
    const [totalRevenueResult] = await pool.query(
      'SELECT SUM(total_amount) as total FROM `order` WHERE status IN (2, 3)'
    );
    const totalRevenue = totalRevenueResult[0].total || 0;

    // 今日营业额
    const [todayRevenueResult] = await pool.query(
      'SELECT SUM(total_amount) as total FROM `order` WHERE status IN (2, 3) AND DATE(created_at) = CURDATE()'
    );
    const todayRevenue = todayRevenueResult[0].total || 0;

    // 按日期统计营业额趋势
    let revenueTrendQuery = `
      SELECT 
        DATE_FORMAT(created_at, "%Y-%m-%d") as date,
        SUM(total_amount) as revenue
      FROM 
        \`order\`
      WHERE 
        status IN (2, 3)
    `;

    const queryParams = [];

    if (startTime && endTime) {
      revenueTrendQuery += ' AND created_at BETWEEN ? AND ?';
      queryParams.push(startTime, endTime);
    } else if (startTime) {
      revenueTrendQuery += ' AND created_at >= ?';
      queryParams.push(startTime);
    } else if (endTime) {
      revenueTrendQuery += ' AND created_at <= ?';
      queryParams.push(endTime);
    }

    revenueTrendQuery += ' GROUP BY date ORDER BY date';

    const [revenueTrend] = await pool.query(revenueTrendQuery, queryParams);

    res.json({
      success: true,
      data: {
        totalRevenue,
        todayRevenue,
        trend: revenueTrend
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商家分类分布
 * GET /api/admin/dashboard/merchant-categories
 */
exports.getMerchantCategories = async (req, res, next) => {
  try {
    // 关联查询商家和分类表
    const [categories] = await pool.query(`
      SELECT 
        c.name,
        COUNT(m.id) as value
      FROM 
        merchant m
      LEFT JOIN 
        category c ON m.category_id = c.id
      GROUP BY 
        c.name
      ORDER BY 
        value DESC
    `);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};