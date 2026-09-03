const db = require('../config/db');

// 1. TẠO ĐƠN HÀNG MỚI (POST /api/orders) - ĐẶT HÀNG TỪ GIỎ HÀNG
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      dia_chi_giao_hang, 
      so_dien_thoai_nhan, 
      ghi_chu = '', 
      phuong_thuc_thanh_toan = 'tien_mat',
      ma_code = null
    } = req.body;

    // Validate bắt buộc
    if (!dia_chi_giao_hang || !so_dien_thoai_nhan) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp địa chỉ giao hàng và số điện thoại nhận hàng!'
      });
    }

    const validPaymentMethods = ['tien_mat', 'chuyen_khoan', 'momo', 'vnpay', 'vietqr'];
    if (!validPaymentMethods.includes(phuong_thuc_thanh_toan)) {
      return res.status(400).json({
        success: false,
        message: `Phương thức thanh toán không hợp lệ! Hợp lệ: ${validPaymentMethods.join(', ')}`
      });
    }

    // 1. Lấy thông tin giỏ hàng của người dùng
    const [carts] = await db.query('SELECT ma_gio_hang FROM gio_hang WHERE ma_nguoi_dung = ?', [userId]);
    if (carts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bạn chưa có giỏ hàng! Không thể đặt hàng.'
      });
    }
    const cartId = carts[0].ma_gio_hang;

    const [cartItems] = await db.query(`
      SELECT ctgh.*, m.ten_mon, m.gia_ban, m.so_luong_ton, m.trang_thai AS trang_thai_mon
      FROM chi_tiet_gio_hang ctgh
      JOIN mon_an m ON ctgh.ma_mon_an = m.ma_mon_an
      WHERE ctgh.ma_gio_hang = ?
    `, [cartId]);

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Giỏ hàng của bạn đang trống! Vui lòng chọn món trước khi đặt hàng.'
      });
    }

    // 2. Kiểm tra tồn kho cho từng món trong giỏ
    for (const item of cartItems) {
      if (item.trang_thai_mon === 'het_hang' || item.so_luong > item.so_luong_ton) {
        return res.status(400).json({
          success: false,
          message: `Món '${item.ten_mon}' không đủ tồn kho (Số lượng đặt: ${item.so_luong}, Tồn kho: ${item.so_luong_ton})!`
        });
      }
    }

    // 3. Tính toán tổng tiền
    const tongTienHang = cartItems.reduce((sum, item) => sum + parseFloat(item.gia_tam_tinh), 0);
    const phiGiaoHang = 15000; // Phí ship cố định 15k
    let soTienGiam = 0;
    let maVoucherId = null;

    // Xử lý giảm giá nếu có ma_code
    if (ma_code) {
      const cleanCode = ma_code.trim().toUpperCase();
      const [vouchers] = await db.query('SELECT * FROM ma_giam_gia WHERE UPPER(ma_code) = ? AND trang_thai = "hoat_dong"', [cleanCode]);
      if (vouchers.length > 0) {
        const v = vouchers[0];
        if (tongTienHang >= parseFloat(v.don_hang_toi_thieu || 0) && v.so_luong_da_dung < v.so_luong_phat_hanh) {
          maVoucherId = v.ma_voucher;
          if (v.loai_giam_gia === 'phan_tram') {
            soTienGiam = (tongTienHang * parseFloat(v.gia_tri_giam)) / 100;
            if (v.giam_toi_da) soTienGiam = Math.min(soTienGiam, parseFloat(v.giam_toi_da));
          } else {
            soTienGiam = Math.min(parseFloat(v.gia_tri_giam), tongTienHang);
          }
          soTienGiam = Math.round(soTienGiam);

          // Cập nhật tăng số lượt đã dùng của voucher
          await db.query('UPDATE ma_giam_gia SET so_luong_da_dung = so_luong_da_dung + 1 WHERE ma_voucher = ?', [maVoucherId]);
        }
      }
    }

    const tongThanhToan = Math.max(0, tongTienHang + phiGiaoHang - soTienGiam);

    // Trạng thái thanh toán mặc định
    const trangThaiThanhToan = phuong_thuc_thanh_toan === 'tien_mat' ? 'chua_thanh_toan' : 'da_thanh_toan';

    // Lấy thông tin họ tên của người dùng để lưu vết lịch sử
    const [users] = await db.query('SELECT ho_ten FROM nguoi_dung WHERE ma_nguoi_dung = ?', [userId]);
    const userName = users.length > 0 ? users[0].ho_ten : 'Khách hàng';

    // 4. Thực hiện Transaction chèn Đơn hàng & Chi tiết đơn hàng
    // 4a. Tạo đơn hàng mới
    const [orderResult] = await db.query(`
      INSERT INTO don_hang (
        ma_nguoi_dung, ma_voucher, tong_tien_hang, phi_giao_hang, so_tien_giam, tong_thanh_toan,
        dia_chi_giao_hang, so_dien_thoai_nhan, ghi_chu,
        phuong_thuc_thanh_toan, trang_thai_thanh_toan, trang_thai_don_hang
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cho_xac_nhan')
    `, [
      userId, maVoucherId, tongTienHang, phiGiaoHang, soTienGiam, tongThanhToan,
      dia_chi_giao_hang, so_dien_thoai_nhan, ghi_chu,
      phuong_thuc_thanh_toan, trangThaiThanhToan
    ]);

    const orderId = orderResult.insertId;

    // 4b. Chèn chi tiết các món vào đơn hàng & Trừ tồn kho món ăn
    for (const item of cartItems) {
      let optionLabels = [];
      if (item.tuy_chon_da_chon) {
        const optionIds = typeof item.tuy_chon_da_chon === 'string'
          ? JSON.parse(item.tuy_chon_da_chon)
          : item.tuy_chon_da_chon;

        if (Array.isArray(optionIds) && optionIds.length > 0) {
          const [options] = await db.query(`
            SELECT gt.ten_gia_tri, gt.gia_tang_them, ntc.ten_nhom
            FROM gia_tri_tuy_chon gt
            JOIN nhom_tuy_chon ntc ON gt.ma_nhom = ntc.ma_nhom
            WHERE gt.ma_gia_tri IN (?)
          `, [optionIds]);
          optionLabels = options.map(opt => ({
            ten: `${opt.ten_nhom}: ${opt.ten_gia_tri}`,
            gia: parseFloat(opt.gia_tang_them)
          }));
        }
      }

      const unitPrice = parseFloat(item.gia_tam_tinh) / item.so_luong;

      await db.query(`
        INSERT INTO chi_tiet_don_hang (
          ma_don_hang, ma_mon_an, ten_mon_an, don_gia, so_luong, tuy_chon_da_chon, thanh_tien
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId, item.ma_mon_an, item.ten_mon, unitPrice, item.so_luong,
        JSON.stringify(optionLabels), parseFloat(item.gia_tam_tinh)
      ]);

      // Trừ số lượng tồn kho
      await db.query(`
        UPDATE mon_an 
        SET so_luong_ton = so_luong_ton - ?,
            trang_thai = IF(so_luong_ton - ? <= 0, 'het_hang', trang_thai)
        WHERE ma_mon_an = ?
      `, [item.so_luong, item.so_luong, item.ma_mon_an]);
    }

    // 4c. Ghi lịch sử trạng thái ban đầu
    await db.query(`
      INSERT INTO lich_su_trang_thai_don (
        ma_don_hang, trang_thai_cu, trang_thai_moi, ghi_chu, nguoi_thuc_hien
      ) VALUES (?, NULL, 'cho_xac_nhan', 'Khách hàng tạo đơn hàng mới thành công', ?)
    `, [orderId, userName]);

    // 4d. Dọn sạch giỏ hàng của khách hàng sau khi đặt thành công
    await db.query('DELETE FROM chi_tiet_gio_hang WHERE ma_gio_hang = ?', [cartId]);

    return res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: {
        ma_don_hang: orderId,
        tong_tien_hang: tongTienHang,
        phi_giao_hang: phiGiaoHang,
        tong_thanh_toan: tongThanhToan,
        phuong_thuc_thanh_toan,
        trang_thai_thanh_toan: trangThaiThanhToan,
        trang_thai_don_hang: 'cho_xac_nhan'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tạo đơn hàng.',
      error: error.message
    });
  }
};

// 2. LẤY DANH SÁCH ĐƠN HÀNG (GET /api/orders)
const getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.ma_vai_tro;
    const { status } = req.query;

    let query = `
      SELECT 
        d.*,
        u.ho_ten AS ten_khach_hang,
        s.ho_ten AS ten_shipper
      FROM don_hang d
      JOIN nguoi_dung u ON d.ma_nguoi_dung = u.ma_nguoi_dung
      LEFT JOIN nguoi_dung s ON d.ma_shipper = s.ma_nguoi_dung
      WHERE 1=1
    `;
    const params = [];

    // Nếu là Khách hàng (ma_vai_tro = 1), chỉ lấy đơn của chính mình
    if (userRole === 1) {
      query += ' AND d.ma_nguoi_dung = ?';
      params.push(userId);
    } else if (userRole === 4) {
      // Nếu là Shipper (ma_vai_tro = 4), lấy các đơn được phân công hoặc đơn chờ giao
      query += ' AND (d.ma_shipper = ? OR d.trang_thai_don_hang = "dang_che_bien")';
      params.push(userId);
    }

    // Lọc theo trạng thái đơn nếu có
    if (status) {
      query += ' AND d.trang_thai_don_hang = ?';
      params.push(status);
    }

    query += ' ORDER BY d.ma_don_hang DESC';

    const [orders] = await db.query(query, params);

    // Lấy kèm tổng số món ăn trong từng đơn
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      const [items] = await db.query('SELECT COUNT(*) AS tong_so_mon FROM chi_tiet_don_hang WHERE ma_don_hang = ?', [order.ma_don_hang]);
      return {
        ...order,
        tong_tien_hang: parseFloat(order.tong_tien_hang),
        phi_giao_hang: parseFloat(order.phi_giao_hang),
        tong_thanh_toan: parseFloat(order.tong_thanh_toan),
        tong_so_mon: items[0].tong_so_mon || 0
      };
    }));

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn hàng thành công!',
      data: ordersWithDetails
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy danh sách đơn hàng.',
      error: error.message
    });
  }
};

// 3. LẤY CHI TIẾT & TIẾN TRÌNH ĐƠN HÀNG (GET /api/orders/:id)
const getOrderDetail = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.ma_vai_tro;
    const orderId = req.params.id;

    // 1. Truy vấn thông tin đơn hàng
    const [orders] = await db.query(`
      SELECT 
        d.*,
        u.ho_ten AS ten_khach_hang,
        u.email AS email_khach_hang,
        s.ho_ten AS ten_shipper,
        s.so_dien_thoai AS sdt_shipper,
        s.bien_so_xe AS bien_so_shipper
      FROM don_hang d
      JOIN nguoi_dung u ON d.ma_nguoi_dung = u.ma_nguoi_dung
      LEFT JOIN nguoi_dung s ON d.ma_shipper = s.ma_nguoi_dung
      WHERE d.ma_don_hang = ?
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Đơn hàng không tồn tại!'
      });
    }

    const order = orders[0];

    // Kiểm tra quyền xem đơn: Khách hàng chỉ xem được đơn của mình
    if (userRole === 1 && order.ma_nguoi_dung !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem thông tin đơn hàng này!'
      });
    }

    // 2. Truy vấn danh sách món ăn trong đơn
    const [items] = await db.query('SELECT * FROM chi_tiet_don_hang WHERE ma_don_hang = ?', [orderId]);

    const formattedItems = items.map(item => ({
      ...item,
      don_gia: parseFloat(item.don_gia),
      thanh_tien: parseFloat(item.thanh_tien),
      tuy_chon_da_chon: item.tuy_chon_da_chon ? JSON.parse(item.tuy_chon_da_chon) : []
    }));

    // 3. Truy vấn lịch sử tiến trình trạng thái đơn hàng (Tracking timeline)
    const [history] = await db.query(`
      SELECT ma_lich_su, trang_thai_cu, trang_thai_moi, ghi_chu, nguoi_thuc_hien, ngay_tao
      FROM lich_su_trang_thai_don
      WHERE ma_don_hang = ?
      ORDER BY ngay_tao ASC, ma_lich_su ASC
    `, [orderId]);

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết đơn hàng thành công!',
      data: {
        ...order,
        tong_tien_hang: parseFloat(order.tong_tien_hang),
        phi_giao_hang: parseFloat(order.phi_giao_hang),
        tong_thanh_toan: parseFloat(order.tong_thanh_toan),
        items: formattedItems,
        lich_su_trang_thai: history
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy chi tiết đơn hàng.',
      error: error.message
    });
  }
};

// 4. CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG (PUT /api/orders/:id/status)
// Luồng trạng thái chuẩn: cho_xac_nhan -> dang_che_bien -> dang_giao -> da_giao (hoặc da_huy)
const updateOrderStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.ma_vai_tro; // 1: Khách, 2: NV, 3: Admin, 4: Shipper, 5: Bếp
    const orderId = req.params.id;
    const { trang_thai_moi, ghi_chu = '', ma_shipper } = req.body;

    const validStatuses = ['cho_xac_nhan', 'dang_che_bien', 'dang_giao', 'da_giao', 'da_huy'];
    if (!validStatuses.includes(trang_thai_moi)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái mới không hợp lệ! Hợp lệ: ${validStatuses.join(', ')}`
      });
    }

    // 1. Kiểm tra đơn hàng có tồn tại không
    const [orders] = await db.query('SELECT * FROM don_hang WHERE ma_don_hang = ?', [orderId]);
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Đơn hàng không tồn tại!'
      });
    }

    const order = orders[0];
    const trangThaiCu = order.trang_thai_don_hang;

    if (trangThaiCu === trang_thai_moi) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng hiện tại đã ở trạng thái '${trang_thai_moi}'!`
      });
    }

    if (trangThaiCu === 'da_giao' || trangThaiCu === 'da_huy') {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng đã ở trạng thái kết thúc ('${trangThaiCu}'), không thể thay đổi thêm!`
      });
    }

    // Khách hàng (role 1) chỉ có quyền tự hủy đơn khi đơn vẫn ở trạng thái 'cho_xac_nhan'
    if (userRole === 1) {
      if (order.ma_nguoi_dung !== userId) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa đơn hàng này!' });
      }
      if (trang_thai_moi !== 'da_huy') {
        return res.status(403).json({ success: false, message: 'Khách hàng chỉ có thể hủy đơn hàng!' });
      }
      if (trangThaiCu !== 'cho_xac_nhan') {
        return res.status(400).json({ success: false, message: 'Đơn hàng đã được tiếp nhận chế biến, không thể hủy!' });
      }
    }

    // Lấy thông tin người thực hiện để ghi log
    const [users] = await db.query(`
      SELECT u.ho_ten, v.ten_vai_tro 
      FROM nguoi_dung u 
      JOIN vai_tro v ON u.ma_vai_tro = v.ma_vai_tro 
      WHERE u.ma_nguoi_dung = ?
    `, [userId]);
    const executorName = users.length > 0 ? `${users[0].ho_ten} (${users[0].ten_vai_tro})` : 'Hệ thống';

    // 2. Xử lý logic theo trạng thái mới
    let updateFields = 'trang_thai_don_hang = ?';
    const queryParams = [trang_thai_moi];

    // Nếu chuyển sang 'da_giao' -> Tự động chuyển trang_thai_thanh_toan thành 'da_thanh_toan'
    if (trang_thai_moi === 'da_giao') {
      updateFields += ', trang_thai_thanh_toan = "da_thanh_toan"';
    }

    // Gắn shipper nếu có truyền lên hoặc nếu Shipper tự nhận đơn
    const shipperIdToAssign = ma_shipper || (userRole === 4 ? userId : null);
    if (shipperIdToAssign) {
      updateFields += ', ma_shipper = ?';
      queryParams.push(shipperIdToAssign);
    }

    queryParams.push(orderId);

    // Cập nhật đơn hàng
    await db.query(`UPDATE don_hang SET ${updateFields} WHERE ma_don_hang = ?`, queryParams);

    // Nếu đơn hàng bị HỦY -> Hoàn lại số lượng tồn kho cho các món ăn
    if (trang_thai_moi === 'da_huy') {
      const [items] = await db.query('SELECT ma_mon_an, so_luong FROM chi_tiet_don_hang WHERE ma_don_hang = ?', [orderId]);
      for (const item of items) {
        await db.query(`
          UPDATE mon_an 
          SET so_luong_ton = so_luong_ton + ?,
              trang_thai = 'con_hang'
          WHERE ma_mon_an = ?
        `, [item.so_luong, item.ma_mon_an]);
      }
    }

    // 3. Ghi lịch sử chuyển đổi trạng thái
    await db.query(`
      INSERT INTO lich_su_trang_thai_don (
        ma_don_hang, trang_thai_cu, trang_thai_moi, ghi_chu, nguoi_thuc_hien
      ) VALUES (?, ?, ?, ?, ?)
    `, [orderId, trangThaiCu, trang_thai_moi, ghi_chu || `Chuyển trạng thái đơn từ ${trangThaiCu} sang ${trang_thai_moi}`, executorName]);

    return res.status(200).json({
      success: true,
      message: `Cập nhật trạng thái đơn hàng thành '${trang_thai_moi}' thành công!`,
      data: {
        ma_don_hang: parseInt(orderId),
        trang_thai_cu: trangThaiCu,
        trang_thai_moi
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi cập nhật trạng thái đơn hàng.',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderDetail,
  updateOrderStatus
};
