const express = require('express');
const router = express.Router();
const { getAllVouchers, applyVoucher } = require('../controllers/voucherController');
const { optionalVerifyToken } = require('../middlewares/auth');

// Route 1: Lấy danh sách toàn bộ các mã giảm giá công khai đang có hiệu lực
router.get('/', optionalVerifyToken, getAllVouchers);

// Route 2: Áp dụng và kiểm tra điều kiện mã giảm giá
router.post('/apply', optionalVerifyToken, applyVoucher);

module.exports = router;
