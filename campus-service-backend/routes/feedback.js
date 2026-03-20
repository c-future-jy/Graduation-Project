const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { auth, checkRole } = require('../middleware/auth');

// 公开路由
router.get('/', feedbackController.getFeedbackList); // 获取反馈列表

// 需要认证的路由
router.post('/', auth, feedbackController.createFeedback); // 创建反馈
router.put('/:id/reply', auth, checkRole([2, 3]), feedbackController.replyFeedback); // 回复反馈

module.exports = router;