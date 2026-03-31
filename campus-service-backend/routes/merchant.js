const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
const { auth, checkRole } = require('../middleware/auth');

// 公开路由
router.get('/', merchantController.getMerchantList); // 获取商家列表
// 当前登录用户的商家信息（用于商家端管理；不依赖 token 内的 role/merchant_id，避免审核后 token 未刷新导致 403）
router.get('/me', auth, merchantController.getMyMerchant);
router.get('/:id', merchantController.getMerchantById); // 获取商家详情

// 需要认证的路由
router.post('/apply', auth, merchantController.applyMerchant); // 申请成为商家
router.post('/', auth, checkRole([2, 3]), merchantController.createMerchant); // 创建商家
router.put('/:id', auth, checkRole([2, 3]), merchantController.updateMerchant); // 更新商家
router.delete('/:id', auth, checkRole([3]), merchantController.deleteMerchant); // 删除商家(管理员)

module.exports = router;