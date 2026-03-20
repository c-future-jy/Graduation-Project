const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { auth, checkRole } = require('../middleware/auth');

// 所有通知路由都需要认证
router.use(auth);

router.get('/', notificationController.getNotificationList); // 获取通知列表
router.put('/:id/read', notificationController.markAsRead); // 标记为已读
router.post('/read-all', notificationController.markAllAsRead); // 标记全部为已读

module.exports = router;