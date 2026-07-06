const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware xác thực Token JWT để bảo vệ các route riêng tư
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    // Kiểm tra header Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy token xác thực. Truy cập bị từ chối!'
      });
    }

    // Lấy token thực tế từ chuỗi 'Bearer <token>'
    const token = authHeader.split(' ')[1];

    // Xác thực token
    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkeyforfastfoodapp2026', (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Token không hợp lệ hoặc đã hết hạn!'
        });
      }

      // Lưu thông tin giải mã vào đối tượng req để sử dụng ở các controller sau
      req.user = {
        id: decoded.id,
        email: decoded.email,
        ma_vai_tro: decoded.ma_vai_tro
      };

      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xác thực token.',
      error: error.message
    });
  }
};

// Middleware kiểm tra quyền Quản trị viên (Admin - ma_vai_tro = 3)
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.ma_vai_tro !== 3) {
    return res.status(403).json({
      success: false,
      message: 'Truy cập bị từ chối! Quyền Admin là bắt buộc.'
    });
  }
  next();
};

module.exports = {
  verifyToken,
  isAdmin
};
