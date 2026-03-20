const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth, checkRole } = require('../middleware/auth');

// 所有订单路由都需要认证
router.use(auth);

// 用户订单接口
router.get('/', orderController.getOrderList); // 获取订单列表
router.post('/', orderController.createOrder); // 创建订单
router.get('/:id', orderController.getOrderById); // 获取订单详情
router.put('/:id/cancel', orderController.cancelOrder); // 取消订单
router.put('/:id/status', orderController.updateOrderStatus); // 更新订单状态
router.delete('/:id', orderController.deleteOrder); // 删除订单

// 商家订单接口
router.get('/merchant/orders', checkRole([2]), orderController.getMerchantOrders); // 商家获取订单列表

// 管理员订单接口
router.get('/admin/orders', checkRole([3]), orderController.getAdminOrders); // 管理员获取订单列表

module.exports = router;