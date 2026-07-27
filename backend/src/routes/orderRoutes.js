const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken } = require('../middlewares/auth');

// Yêu cầu xác thực Token JWT cho toàn bộ các route đơn hàng
router.use(verifyToken);

// 1. Tạo đơn hàng mới (Checkout)
router.post('/', orderController.createOrder);

// 2. Lấy danh sách đơn hàng (Có hỗ trợ lọc theo trạng thái ?status=...)
router.get('/', orderController.getOrders);

// 3. Xem chi tiết đơn hàng & tiến trình theo dõi timeline
router.get('/:id', orderController.getOrderDetail);

// 4. Cập nhật trạng thái đơn hàng (Dành cho Khách hủy đơn, Bếp nhận đơn, Shipper giao, Admin...)
router.put('/:id/status', orderController.updateOrderStatus);

module.exports = router;
