const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Lấy thông tin địa chỉ mốc quán, tọa độ GPS, bán kính giao hàng và giá ship/km
router.get('/landmark', adminController.getStoreLandmark);

module.exports = router;
