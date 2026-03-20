const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { auth } = require('../middleware/auth');

// 所有地址路由都需要认证
router.use(auth);

router.get('/', addressController.getAddressList); // 获取地址列表
router.post('/', addressController.createAddress); // 创建地址
router.put('/:id', addressController.updateAddress); // 更新地址
router.delete('/:id', addressController.deleteAddress); // 删除地址
router.put('/:id/default', addressController.setDefaultAddress); // 设置默认地址

module.exports = router;