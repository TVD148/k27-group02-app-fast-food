const db = require('../config/db');

// 1. LẤY DANH SÁCH CÁC MÃ GIẢM GIÁ ĐANG CÓ HIỆU LỰC
const getAllVouchers = async (req, res) => {
  try {
    const [vouchers] = await db.query(
      `SELECT ma_voucher, ma_code, ten_voucher, mo_ta, loai_giam_gia, gia_tri_giam, giam_toi_da, don_hang_toi_thieu, so_luong_phat_hanh, so_luong_da_dung, ngay_bat_dau, ngay_ket_thuc, trang_thai
       FROM ma_giam_gia
       WHERE trang_thai = 'hoat_dong' AND ngay_ket_thuc >= NOW()
       ORDER BY ma_voucher DESC`
    );

    return res.status(200).json({
      success: true,
      message: 'Tải danh sách mã giảm giá thành công',
      data: vouchers
    });
  } catch (error) {
    console.error('Lỗi getAllVouchers:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách mã giảm giá',
      error: error.message
    });
  }
};

// 2. KÍCH HOẠT & KIỂM TRA ĐIỀU KIỆN ÁP DỤNG MÃ GIẢM GIÁ
const applyVoucher = async (req, res) => {
  try {
    const { ma_code, tong_tien_hang } = req.body;

    if (!ma_code || tong_tien_hang === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ma_code và tong_tien_hang!'
      });
    }

    const cleanCode = ma_code.trim().toUpperCase();
    const subtotal = parseFloat(tong_tien_hang);

    // 2.1 Tìm kiếm mã giảm giá trong CSDL
    const [vouchers] = await db.query(
      'SELECT * FROM ma_giam_gia WHERE UPPER(ma_code) = ?',
      [cleanCode]
    );

    if (vouchers.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Mã giảm giá '${cleanCode}' không tồn tại trong hệ thống!`
      });
    }

    const voucher = vouchers[0];

    // 2.2 Kiểm tra trạng thái hoạt động
    if (voucher.trang_thai !== 'hoat_dong') {
      return res.status(400).json({
        success: false,
        message: `Mã giảm giá '${cleanCode}' hiện tạm dừng hoặc ngừng sử dụng!`
      });
    }

    // 2.3 Kiểm tra hạn sử dụng
    const now = new Date();
    const startDate = new Date(voucher.ngay_bat_dau);
    const endDate = new Date(voucher.ngay_ket_thuc);

    if (now < startDate) {
      return res.status(400).json({
        success: false,
        message: `Mã giảm giá '${cleanCode}' chưa đến thời gian áp dụng (Bắt đầu từ ${startDate.toLocaleDateString('vi-VN')})!`
      });
    }

    if (now > endDate) {
      return res.status(400).json({
        success: false,
        message: `Mã giảm giá '${cleanCode}' đã hết hạn sử dụng!`
      });
    }

    // 2.4 Kiểm tra số lượng lượt dùng phát hành
    if (voucher.so_luong_da_dung >= voucher.so_luong_phat_hanh) {
      return res.status(400).json({
        success: false,
        message: `Mã giảm giá '${cleanCode}' đã hết số lượt sử dụng!`
      });
    }

    // 2.5 Kiểm tra đơn hàng tối thiểu
    const minOrder = parseFloat(voucher.don_hang_toi_thieu || 0);
    if (subtotal < minOrder) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng của bạn cần tối thiểu ${minOrder.toLocaleString('vi-VN')} đ để sử dụng mã này!`
      });
    }

    // 2.6 Tính toán số tiền được giảm
    let discountAmount = 0;
    const value = parseFloat(voucher.gia_tri_giam);

    if (voucher.loai_giam_gia === 'phan_tram') {
      discountAmount = (subtotal * value) / 100;
      if (voucher.giam_toi_da && parseFloat(voucher.giam_toi_da) > 0) {
        const maxDiscount = parseFloat(voucher.giam_toi_da);
        discountAmount = Math.min(discountAmount, maxDiscount);
      }
    } else {
      // loai_giam_gia === 'so_tien'
      discountAmount = Math.min(value, subtotal);
    }

    discountAmount = Math.round(discountAmount);
    const finalAmount = Math.max(0, subtotal - discountAmount);

    return res.status(200).json({
      success: true,
      message: `Áp dụng mã giảm giá '${cleanCode}' thành công!`,
      data: {
        ma_voucher: voucher.ma_voucher,
        ma_code: voucher.ma_code,
        ten_voucher: voucher.ten_voucher,
        loai_giam_gia: voucher.loai_giam_gia,
        gia_tri_giam: value,
        so_tien_giam: discountAmount,
        tong_tien_hang: subtotal,
        tong_thanh_toan_sau_giam: finalAmount
      }
    });
  } catch (error) {
    console.error('Lỗi applyVoucher:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể xác thực mã giảm giá',
      error: error.message
    });
  }
};

module.exports = {
  getAllVouchers,
  applyVoucher
};
