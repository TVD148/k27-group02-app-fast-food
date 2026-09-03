const db = require('../config/db');

// Cấu hình ngân hàng thụ hưởng mặc định cho VietQR
const VIETQR_CONFIG = {
  BANK_ID: '970422', // Mã BIN ngân hàng (970422: MB Bank)
  BANK_NAME: 'MB Bank - Ngân hàng TMCP Quân Đội',
  ACCOUNT_NO: '0987654321',
  ACCOUNT_NAME: 'CONG TY APP FAST FOOD'
};

// 1. SINH MÃ VIETQR ĐỘNG CHO ĐƠN HÀNG VÀ GHI LOG GIAO DỊCH
const generateVietQR = async (req, res) => {
  try {
    const { ma_don_hang } = req.body;

    if (!ma_don_hang) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ma_don_hang!'
      });
    }

    // 1.1 Kiểm tra thông tin đơn hàng
    const [orders] = await db.query('SELECT * FROM don_hang WHERE ma_don_hang = ?', [ma_don_hang]);
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy đơn hàng #${ma_don_hang}`
      });
    }
    const order = orders[0];
    const amount = parseFloat(order.tong_thanh_toan);
    const transferContent = `FASTFOOD${order.ma_don_hang}`;

    // 1.2 Sinh đường dẫn ảnh mã QR động bằng dịch vụ VietQR API
    const encodedContent = encodeURIComponent(transferContent);
    const encodedAccName = encodeURIComponent(VIETQR_CONFIG.ACCOUNT_NAME);
    const qrUrl = `https://img.vietqr.io/image/${VIETQR_CONFIG.BANK_ID}-${VIETQR_CONFIG.ACCOUNT_NO}-compact2.jpg?amount=${amount}&addInfo=${encodedContent}&accountName=${encodedAccName}`;

    // 1.3 Kiểm tra xem nhật ký thanh toán cho đơn hàng đã tồn tại chưa
    const [existingLogs] = await db.query('SELECT ma_thanh_toan FROM thanh_toan WHERE ma_don_hang = ?', [ma_don_hang]);
    
    let paymentId;
    if (existingLogs.length > 0) {
      paymentId = existingLogs[0].ma_thanh_toan;
      await db.query(
        `UPDATE thanh_toan 
         SET phuong_thuc = 'vietqr', so_tien = ?, noi_dung_chuyen_khoan = ?, ma_qr_code_url = ?, trang_thai_thanh_toan = 'cho_thanh_toan' 
         WHERE ma_thanh_toan = ?`,
        [amount, transferContent, qrUrl, paymentId]
      );
    } else {
      const [insertResult] = await db.query(
        `INSERT INTO thanh_toan (ma_don_hang, phuong_thuc, so_tien, trang_thai_thanh_toan, noi_dung_chuyen_khoan, ma_qr_code_url) 
         VALUES (?, 'vietqr', ?, 'cho_thanh_toan', ?, ?)`,
        [ma_don_hang, amount, transferContent, qrUrl]
      );
      paymentId = insertResult.insertId;
    }

    return res.status(200).json({
      success: true,
      message: 'Sinh mã VietQR thanh toán động thành công',
      data: {
        ma_thanh_toan: paymentId,
        ma_don_hang: order.ma_don_hang,
        so_tien: amount,
        phuong_thuc: 'vietqr',
        ngan_hang: VIETQR_CONFIG.BANK_NAME,
        so_tai_khoan: VIETQR_CONFIG.ACCOUNT_NO,
        ten_tai_khoan: VIETQR_CONFIG.ACCOUNT_NAME,
        noi_dung_chuyen_khoan: transferContent,
        ma_qr_code_url: qrUrl,
        trang_thai_thanh_toan: 'cho_thanh_toan'
      }
    });
  } catch (error) {
    console.error('Lỗi generateVietQR:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể khởi tạo mã VietQR thanh toán',
      error: error.message
    });
  }
};

// 2. XÁC NHẬN THANH TOÁN (PAYMENT WEBHOOK / CONFIRMATION)
const confirmPayment = async (req, res) => {
  try {
    const { ma_don_hang, ma_giao_dich_cong, phuong_thuc } = req.body;

    if (!ma_don_hang) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ma_don_hang!'
      });
    }

    // 2.1 Kiểm tra đơn hàng
    const [orders] = await db.query('SELECT * FROM don_hang WHERE ma_don_hang = ?', [ma_don_hang]);
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy đơn hàng #${ma_don_hang}`
      });
    }

    const payMethod = phuong_thuc || 'vietqr';
    const txnCode = ma_giao_dich_cong || `TXN${Date.now()}`;

    // 2.2 Cập nhật bảng thanh_toan
    await db.query(
      `UPDATE thanh_toan 
       SET trang_thai_thanh_toan = 'thanh_cong', ma_giao_dich_cong = ?, ngay_thanh_toan = NOW() 
       WHERE ma_don_hang = ?`,
      [txnCode, ma_don_hang]
    );

    // 2.3 Cập nhật bảng don_hang sang 'da_thanh_toan'
    await db.query(
      `UPDATE don_hang 
       SET trang_thai_thanh_toan = 'da_thanh_toan', phuong_thuc_thanh_toan = ? 
       WHERE ma_don_hang = ?`,
      [payMethod, ma_don_hang]
    );

    // 2.4 Ghi log lịch sử trạng thái đơn
    await db.query(
      `INSERT INTO lich_su_trang_thai_don (ma_don_hang, trang_thai, ghi_chu) 
       VALUES (?, 'cho_xac_nhan', ?)`,
      [ma_don_hang, `Đã nhận thanh toán trực tuyến qua ${payMethod.toUpperCase()} (Mã GD: ${txnCode})`]
    );

    return res.status(200).json({
      success: true,
      message: `Xác nhận thanh toán cho đơn hàng #${ma_don_hang} thành công!`,
      data: {
        ma_don_hang: parseInt(ma_don_hang),
        trang_thai_thanh_toan: 'da_thanh_toan',
        ma_giao_dich_cong: txnCode
      }
    });
  } catch (error) {
    console.error('Lỗi confirmPayment:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể xác nhận thanh toán đơn hàng',
      error: error.message
    });
  }
};

// 3. LẤY NHẬT KÝ THANH TOÁN THEO ĐƠN HÀNG
const getPaymentByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [payments] = await db.query(
      `SELECT tt.*, dh.tong_thanh_toan, dh.trang_thai_don_hang 
       FROM thanh_toan tt
       JOIN don_hang dh ON tt.ma_don_hang = dh.ma_don_hang
       WHERE tt.ma_don_hang = ?`,
      [orderId]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Chưa có nhật ký giao dịch cho đơn hàng #${orderId}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tải nhật ký thanh toán thành công',
      data: payments[0]
    });
  } catch (error) {
    console.error('Lỗi getPaymentByOrder:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy thông tin nhật ký thanh toán',
      error: error.message
    });
  }
};

module.exports = {
  generateVietQR,
  confirmPayment,
  getPaymentByOrder
};
