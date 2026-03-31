const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const merchantController = require('../controllers/merchantController');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const feedbackController = require('../controllers/feedbackController');
const notificationController = require('../controllers/notificationController');
const logController = require('../controllers/logController');
const { auth, checkRole } = require('../middleware/auth');

// 用户管理路由
router.get('/users', auth, checkRole([3]), userController.getAdminUserList);
router.get('/users/:id', auth, checkRole([3]), userController.getAdminUserDetail);
router.put('/users/:id/status', auth, checkRole([3]), userController.updateUserStatus);
router.post('/users/:id/reset-password', auth, checkRole([3]), userController.resetUserPassword);

// 商家管理路由
router.get('/merchants', auth, checkRole([3]), merchantController.getAdminMerchantList);
router.get('/merchants/:id', auth, checkRole([3]), merchantController.getAdminMerchantDetail);
router.put('/merchants/:id/audit', auth, checkRole([3]), merchantController.auditMerchant);
router.put('/merchants/:id/status', auth, checkRole([3]), merchantController.updateMerchantStatus);

// 商品管理路由
router.get('/products', auth, checkRole([3]), productController.getAdminProductList);
router.get('/products/:id', auth, checkRole([3]), productController.getAdminProductDetail);
router.put('/products/:id/status', auth, checkRole([3]), productController.updateProductStatus);
router.post('/products/batch-update', auth, checkRole([3]), productController.batchUpdateProducts);

// 订单管理路由
router.get('/orders', auth, checkRole([3]), orderController.getAdminOrders);
router.get('/orders/:id', auth, checkRole([3]), orderController.getAdminOrderDetail);
router.put('/orders/:id/status', auth, checkRole([3]), orderController.updateAdminOrderStatus);
router.post('/orders/:id/force-cancel', auth, checkRole([3]), orderController.forceCancelOrder);

// 反馈管理路由
router.get('/feedbacks', auth, checkRole([3]), feedbackController.getAdminFeedbackList);
router.get('/feedbacks/:id', auth, checkRole([3]), feedbackController.getAdminFeedbackDetail);
router.put('/feedbacks/:id/reply', auth, checkRole([3]), feedbackController.replyAdminFeedback);
router.put('/feedbacks/:id/reject', auth, checkRole([3]), feedbackController.rejectAdminFeedback);
router.delete('/feedbacks/:id', auth, checkRole([3]), feedbackController.deleteAdminFeedback);
router.post('/feedbacks/batch-delete', auth, checkRole([3]), feedbackController.batchDeleteAdminFeedbacks);

// 通知管理路由
router.get('/notifications', auth, checkRole([3]), notificationController.getAdminNotificationList);
router.post('/notifications', auth, checkRole([3]), notificationController.createAdminNotification);
router.put('/notifications/:id/read', auth, checkRole([3]), notificationController.markAdminNotificationAsRead);
router.post('/notifications/batch-read', auth, checkRole([3]), notificationController.batchMarkAdminNotificationsAsRead);
router.delete('/notifications/:id', auth, checkRole([3]), notificationController.deleteAdminNotification);
router.post('/notifications/batch-delete', auth, checkRole([3]), notificationController.batchDeleteAdminNotifications);

// 操作日志路由
router.get('/logs', auth, checkRole([3]), logController.getAdminLogs);

module.exports = router;