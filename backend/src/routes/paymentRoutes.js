const express = require('express');
const router = express.Router();
const { 
  generateVietQR, 
  confirmPayment, 
  getPaymentByOrder 
} = require('../controllers/paymentController');

// Route 1: Sinh mã QR VietQR động và ghi nhật ký thanh toán
router.post('/vietqr/generate', generateVietQR);

// Route 2: Xác nhận trạng thái thanh toán thành công (Webhook / Client callback)
router.post('/confirm', confirmPayment);

// Route 3: Lấy thông tin nhật ký thanh toán của đơn hàng
router.get('/order/:orderId', getPaymentByOrder);

module.exports = router;
