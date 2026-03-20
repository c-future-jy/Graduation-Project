const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { auth, checkRole } = require('../middleware/auth');

// 公开路由
router.get('/', categoryController.getCategoryList); // 获取分类列表

// 需要认证的路由
router.post('/', auth, checkRole([2, 3]), categoryController.createCategory); // 创建分类
router.put('/:id', auth, checkRole([2, 3]), categoryController.updateCategory); // 更新分类
router.delete('/:id', auth, checkRole([3]), categoryController.deleteCategory); // 删除分类(管理员)

module.exports = router;