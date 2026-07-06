const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// 1. ĐĂNG KÝ TÀI KHOẢN (POST /api/auth/register)
const register = async (req, res) => {
  try {
    const { ho_ten, email, mat_khau, so_dien_thoai, dia_chi, ma_vai_tro } = req.body;

    // Validate đầu vào bắt buộc
    if (!ho_ten || !mat_khau) {
      return res.status(400).json({
        success: false,
        message: 'Họ tên và Mật khẩu không được để trống!'
      });
    }

    // Phải cung cấp ít nhất Email hoặc Số điện thoại để định danh
    if (!email && !so_dien_thoai) {
      return res.status(400).json({
        success: false,
        message: 'Bạn cần cung cấp Email hoặc Số điện thoại để đăng ký!'
      });
    }

    // Kiểm tra Email trùng lặp (nếu có nhập email)
    if (email) {
      const [existingEmail] = await db.query('SELECT ma_nguoi_dung FROM nguoi_dung WHERE email = ?', [email]);
      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email này đã được sử dụng!'
        });
      }
    }

    // Kiểm tra Số điện thoại trùng lặp (nếu có nhập SĐT)
    if (so_dien_thoai) {
      const [existingPhone] = await db.query('SELECT ma_nguoi_dung FROM nguoi_dung WHERE so_dien_thoai = ?', [so_dien_thoai]);
      if (existingPhone.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại này đã được đăng ký!'
        });
      }
    }

    // Mã hóa mật khẩu bằng bcrypt (độ mạnh salt = 10)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(mat_khau, salt);

    // Mặc định đăng ký mới là vai trò khach_hang (ma_vai_tro = 1)
    const roleId = ma_vai_tro || 1;

    // Thực hiện chèn vào database
    const [result] = await db.query(
      'INSERT INTO nguoi_dung (ho_ten, email, mat_khau, so_dien_thoai, dia_chi, ma_vai_tro) VALUES (?, ?, ?, ?, ?, ?)',
      [ho_ten, email || null, hashedPassword, so_dien_thoai || null, dia_chi || null, roleId]
    );

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      data: {
        userId: result.insertId,
        ho_ten,
        email,
        so_dien_thoai,
        ma_vai_tro: roleId
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi đăng ký tài khoản.',
      error: error.message
    });
  }
};

// 2. ĐĂNG NHẬP (POST /api/auth/login)
const login = async (req, res) => {
  try {
    const { email_or_phone, mat_khau } = req.body;

    if (!email_or_phone || !mat_khau) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin đăng nhập và mật khẩu!'
      });
    }

    // Tìm người dùng theo Email hoặc Số điện thoại
    const [users] = await db.query(
      'SELECT * FROM nguoi_dung WHERE email = ? OR so_dien_thoai = ?',
      [email_or_phone, email_or_phone]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đăng nhập hoặc mật khẩu không chính xác!'
      });
    }

    const user = users[0];

    // Kiểm tra trạng thái tài khoản
    if (user.trang_thai !== 'hoat_dong') {
      return res.status(403).json({
        success: false,
        message: `Tài khoản của bạn đã bị khóa hoặc cấm. Trạng thái: ${user.trang_thai}`
      });
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(mat_khau, user.mat_khau);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đăng nhập hoặc mật khẩu không chính xác!'
      });
    }

    // Tạo JWT Token chứa id, email, và vai trò của user
    const payload = {
      id: user.ma_nguoi_dung,
      email: user.email,
      ma_vai_tro: user.ma_vai_tro
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'supersecretkeyforfastfoodapp2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: {
        token: `Bearer ${token}`,
        user: {
          id: user.ma_nguoi_dung,
          ho_ten: user.ho_ten,
          email: user.email,
          so_dien_thoai: user.so_dien_thoai,
          dia_chi: user.dia_chi,
          ma_vai_tro: user.ma_vai_tro,
          hinh_anh: user.hinh_anh
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi đăng nhập.',
      error: error.message
    });
  }
};

// 3. LẤY PROFILE NGƯỜI DÙNG (GET /api/auth/profile)
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy thông tin user (loại bỏ mật khẩu)
    const [users] = await db.query(
      'SELECT ma_nguoi_dung, ho_ten, email, so_dien_thoai, dia_chi, hinh_anh, ma_vai_tro, trang_thai, ngay_tao FROM nguoi_dung WHERE ma_nguoi_dung = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin người dùng!'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin cá nhân thành công!',
      data: users[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi truy vấn thông tin cá nhân.',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getProfile
};
