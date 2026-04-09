const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { auth, checkRole } = require('../middleware/auth');

// 管理员：获取全部反馈（历史兼容：保留该路径，但收口权限）
router.get('/', auth, checkRole([3]), feedbackController.getFeedbackList);

// 需要认证的路由
router.get('/my', auth, checkRole([2]), feedbackController.getMerchantFeedbackList); // 商家获取自己的反馈
router.post('/', auth, feedbackController.createFeedback); // 创建反馈
router.put('/:id/reply', auth, checkRole([2, 3]), feedbackController.replyFeedback); // 回复反馈

module.exports = router;