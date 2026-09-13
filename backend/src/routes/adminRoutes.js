const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin, isStaffOrAdmin } = require('../middlewares/auth');

// Yêu cầu xác thực Token JWT
router.use(verifyToken);

// 1. Chức năng chung cho cả Nhân viên và Quản trị viên
router.put('/items/:id/toggle-status', isStaffOrAdmin, adminController.toggleItemStatus);
router.get('/ingredients', isStaffOrAdmin, adminController.getIngredients);

// 2. Chức năng yêu cầu quyền Quản trị viên (Admin)
router.use(isAdmin);

// Quản lý Danh mục
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Quản lý Món ăn
router.post('/items', adminController.createItem);
router.put('/items/:id', adminController.updateItem);
router.delete('/items/:id', adminController.deleteItem);

// Quản lý Voucher & Khuyến mãi
router.get('/vouchers', adminController.getAdminVouchers);
router.post('/vouchers', adminController.createVoucher);
router.delete('/vouchers/:id', adminController.deleteVoucher);
router.put('/vouchers/:id/toggle', adminController.toggleVoucherStatus);

// Quản lý Người dùng & Nhân sự
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id/role', adminController.updateUserRole);

// Thống kê Doanh thu & Vận hành
router.get('/dashboard-stats', adminController.getDashboardStats);

// Quản lý Địa chỉ mốc của quán & Giới hạn bán kính giao hàng
router.get('/store-landmark', adminController.getStoreLandmark);
router.put('/store-landmark', adminController.updateStoreLandmark);

module.exports = router;
