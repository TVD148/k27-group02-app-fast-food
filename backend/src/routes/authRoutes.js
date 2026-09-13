const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/auth');

// Route đăng ký
router.post('/register', authController.register);

// Route đăng nhập
router.post('/login', authController.login);

// Route lấy thông tin cá nhân (yêu cầu gửi kèm Token JWT hợp lệ)
router.get('/profile', verifyToken, authController.getProfile);

// Route cập nhật thông tin cá nhân (Họ tên, SĐT, Email)
router.put('/profile', verifyToken, authController.updateProfile);

// Route heartbeat điểm danh trực tuyến
router.post('/heartbeat', verifyToken, authController.heartbeat);

// Route cập nhật trạng thái trực tuyến của shipper
router.put('/shipper-status', verifyToken, authController.updateShipperStatus);

module.exports = router;
