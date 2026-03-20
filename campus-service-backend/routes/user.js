const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth, checkRole } = require('../middleware/auth');
const loginRateLimit = require('../middleware/rateLimit');

// 认证相关路由
router.post('/auth/register', loginRateLimit(), userController.register); // 统一注册接口
router.post('/auth/check-username', userController.checkUsername); // 检查用户名是否已被占用
router.post('/auth/check-phone', userController.checkPhone); // 检查手机号是否已注册

// 登录相关路由
router.post('/login', loginRateLimit(), userController.login); // 微信登录
router.post('/login/account', loginRateLimit(), userController.accountLogin); // 账号密码登录

// 需要认证的路由
router.get('/profile', auth, userController.getProfile); // 获取个人信息
router.put('/profile', auth, userController.updateProfile); // 更新个人信息
router.post('/decrypt-phone', auth, userController.decryptWeixinPhone); // 解密微信手机号
router.get('/list', auth, checkRole([3]), userController.getUserList); // 获取用户列表(管理员)

module.exports = router;