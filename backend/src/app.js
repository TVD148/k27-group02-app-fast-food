const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Khởi tạo Express app
const app = express();

// Middlewares cơ bản
app.use(cors()); // Cho phép cross-origin requests
app.use(express.json()); // Phân tích body JSON của request
app.use(express.urlencoded({ extended: true }));

// Import các router định tuyến
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Khai báo các đường dẫn API gốc
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/admin', adminRoutes);

// Route chào mừng cơ bản để test server
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Chào mừng bạn đến với API của ứng dụng Đặt thức ăn nhanh (Fast Food App) - Sprint 1!'
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
