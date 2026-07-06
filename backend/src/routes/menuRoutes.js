const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// Lấy toàn bộ danh mục thực đơn
router.get('/categories', menuController.getCategories);

// Lấy danh sách món ăn (hỗ trợ phân trang, lọc theo danh mục, tìm kiếm theo tên)
router.get('/items', menuController.getItems);

// Lấy chi tiết món ăn (bao gồm cả các tùy chọn size, topping đi kèm)
router.get('/items/:id', menuController.getItemDetail);

module.exports = router;
