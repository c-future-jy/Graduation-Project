const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth, checkRole } = require('../middleware/auth');

// 公开路由
router.get('/', productController.getProductList); // 获取商品列表
// 商家端：获取自己的商品（含上下架）
router.get('/my', auth, checkRole([2]), productController.getMyProductList);
router.get('/:id', productController.getProductById); // 获取商品详情

// 需要认证的路由
router.post('/', auth, checkRole([2, 3]), productController.createProduct); // 创建商品
router.put('/:id', auth, checkRole([2, 3]), productController.updateProduct); // 更新商品
router.delete('/:id', auth, checkRole([2, 3]), productController.deleteProduct); // 删除商品

module.exports = router;