const express = require('express');
const router = express.Router();

// 导入各个模块的路由
const userRoutes = require('./user');
const merchantRoutes = require('./merchant');
const productRoutes = require('./product');
const orderRoutes = require('./order');
const categoryRoutes = require('./category');
const addressRoutes = require('./address');
const feedbackRoutes = require('./feedback');
const notificationRoutes = require('./notification');
const uploadRoutes = require('./upload');
const cartRoutes = require('./cart');
const dashboardRoutes = require('./dashboard');
const adminRoutes = require('./admin');
const merchantDashboardRoutes = require('./merchantDashboard');
const searchController = require('../controllers/searchController');

// 注册路由
router.use('/users', userRoutes);
router.use('/merchants', merchantRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/categories', categoryRoutes);
router.use('/addresses', addressRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/notifications', notificationRoutes);
router.use('/upload', uploadRoutes);
router.use('/cart', cartRoutes);
router.use('/merchant/dashboard', merchantDashboardRoutes);
router.use('/admin/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);

// 搜索路由
router.get('/search', searchController.search);

// API文档根路径
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '校园一站式服务平台API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      merchants: '/api/merchants',
      products: '/api/products',
      orders: '/api/orders',
      categories: '/api/categories',
      addresses: '/api/addresses',
      feedback: '/api/feedback',
      notifications: '/api/notifications',
      upload: '/api/upload',
      cart: '/api/cart',
      dashboard: '/api/admin/dashboard',
      admin: '/api/admin'
    }
  });
});

module.exports = router;