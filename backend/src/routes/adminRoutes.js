const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middlewares/auth');

// Áp dụng các middleware xác thực JWT và kiểm tra quyền Admin cho toàn bộ route quản lý
router.use(verifyToken);
router.use(isAdmin);

// 1. Quản lý danh mục (CRUD danh mục)
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// 2. Quản lý món ăn (CRUD món ăn)
router.post('/items', adminController.createItem);
router.put('/items/:id', adminController.updateItem);
router.delete('/items/:id', adminController.deleteItem);

module.exports = router;
