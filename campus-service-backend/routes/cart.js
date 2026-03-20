const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { auth } = require('../middleware/auth');

// 所有购物车路由都需要认证
router.use(auth);

// 购物车商品管理
router.get('/', cartController.getCartList); // 获取购物车列表（支持分页）
router.post('/items', cartController.addToCart); // 添加商品到购物车
router.put('/items/:id', cartController.updateCartItem); // 更新购物车商品（数量、选中状态、规格）
router.delete('/items/:id', cartController.deleteCartItem); // 删除购物车商品

// 购物车操作
router.delete('/items/selected', cartController.deleteSelectedItems); // 删除选中的购物车商品
router.delete('/clear', cartController.clearCart); // 清空购物车
router.delete('/items/invalid', cartController.deleteInvalidItems); // 删除失效商品

// 结算相关
router.get('/selected', cartController.getSelectedItems); // 获取选中的购物车商品（用于结算）

module.exports = router;