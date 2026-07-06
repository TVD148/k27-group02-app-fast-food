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

module.exports = router;
