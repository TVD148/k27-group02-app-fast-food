const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken } = require('../middlewares/auth');

// Yêu cầu xác thực Token JWT cho toàn bộ các route giỏ hàng
router.use(verifyToken);

// 1. Lấy thông tin chi tiết giỏ hàng
router.get('/', cartController.getCart);

// 2. Thêm món vào giỏ hàng (xử lý trùng option & số lượng)
router.post('/add', cartController.addToCart);

// 3. Cập nhật số lượng món trong giỏ hàng
router.put('/update/:id', cartController.updateCartItem);

// 4. Xóa một món khỏi giỏ hàng
router.delete('/remove/:id', cartController.removeCartItem);

// 5. Làm sạch (xóa tất cả) giỏ hàng
router.delete('/clear', cartController.clearCart);

module.exports = router;
