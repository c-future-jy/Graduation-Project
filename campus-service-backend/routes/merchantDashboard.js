const express = require('express');
const router = express.Router();
const merchantDashboardController = require('../controllers/merchantDashboardController');
const { auth, checkRole } = require('../middleware/auth');

router.use(auth, checkRole([2]));

router.get('/stats', merchantDashboardController.getStats);
router.get('/trend', merchantDashboardController.getTrend);
router.get('/order-status', merchantDashboardController.getOrderStatus);
router.get('/top-products', merchantDashboardController.getTopProducts);
router.get('/recent-orders', merchantDashboardController.getRecentOrders);
router.get('/low-stock', merchantDashboardController.getLowStock);

module.exports = router;
