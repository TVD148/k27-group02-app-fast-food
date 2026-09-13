const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Khởi tạo Express app
const app = express();

// Middlewares cơ bản
app.use(cors()); // Cho phép cross-origin requests
app.use(express.json()); // Phân tích body JSON của request
app.use(express.urlencoded({ extended: true }));

// Import các router định tuyến (Sprint 1, Sprint 2 & Sprint 3)
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const adminRoutes = require('./routes/adminRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const storeRoutes = require('./routes/storeRoutes');
const addressRoutes = require('./routes/addressRoutes');

// Log mọi request gửi đến server để dễ dàng kiểm tra kết nối
app.use((req, res, next) => {
  console.log(`[API Call] ${req.method} ${req.url}`);
  next();
});

// Khai báo các đường dẫn API gốc (Hỗ trợ cả tiền tố /api/ và không có /api/)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/address', addressRoutes);
app.use('/address', addressRoutes);

app.use('/api/menu', menuRoutes);
app.use('/menu', menuRoutes);

app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);

app.use('/api/cart', cartRoutes);
app.use('/cart', cartRoutes);

app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);

app.use('/api/nutrition', nutritionRoutes);
app.use('/nutrition', nutritionRoutes);

app.use('/api/vouchers', voucherRoutes);
app.use('/vouchers', voucherRoutes);

app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);

app.use('/api/store', storeRoutes);
app.use('/store', storeRoutes);

// Route chào mừng cơ bản để test server
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FastFood API Server is running!'
  });
});

// Xử lý lỗi 404 (Không tìm thấy route hợp lệ)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Đường dẫn API ${req.originalUrl} không tồn tại trên server!`
  });
});

// Global Error Handler (Middleware xử lý lỗi tập trung)
app.use((err, req, res, next) => {
  console.error('Lỗi hệ thống tập trung:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Đã xảy ra lỗi hệ thống nghiêm trọng!',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

module.exports = app;
