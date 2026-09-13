const jwt = require('jsonwebtoken');
const db = require('../config/db');
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

      // Cập nhật thời điểm hoạt động gần nhất của tài khoản (để admin theo dõi nhân sự trực tuyến thật)
      db.query('UPDATE nguoi_dung SET lan_hoat_dong_cuoi = NOW() WHERE ma_nguoi_dung = ?', [decoded.id]).catch(() => {});

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

// Middleware kiểm tra quyền Nhân viên hoặc Quản trị viên (ma_vai_tro = 2 hoặc 3)
const isStaffOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.ma_vai_tro !== 2 && req.user.ma_vai_tro !== 3)) {
    return res.status(403).json({
      success: false,
      message: 'Truy cập bị từ chối! Quyền Nhân viên hoặc Quản trị viên là bắt buộc.'
    });
  }
  next();
};

// Middleware xác thực Token tùy chọn (không bắt buộc nhưng nếu có token thì giải mã)
const optionalVerifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET || 'supersecretkeyforfastfoodapp2026', (err, decoded) => {
        if (!err && decoded) {
          req.user = {
            id: decoded.id,
            email: decoded.email,
            ma_vai_tro: decoded.ma_vai_tro
          };
        }
        next();
      });
    } else {
      next();
    }
  } catch (e) {
    next();
  }
};

module.exports = {
  verifyToken,
  optionalVerifyToken,
  isAdmin,
  isStaffOrAdmin
};
