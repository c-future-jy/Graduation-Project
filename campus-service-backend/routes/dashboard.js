const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { auth } = require('../middleware/auth');
const { checkRole } = require('../middleware/auth');

// 仪表盘统计接口，需要管理员权限
router.get('/stats', auth, checkRole([3]), dashboardController.getDashboardStats);
router.get('/order-trend', auth, checkRole([3]), dashboardController.getOrderTrend);
router.get('/revenue', auth, checkRole([3]), dashboardController.getRevenue);
router.get('/merchant-categories', auth, checkRole([3]), dashboardController.getMerchantCategories);

module.exports = router;