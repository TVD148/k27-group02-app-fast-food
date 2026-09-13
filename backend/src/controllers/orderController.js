const db = require('../config/db');

// Tính khoảng cách giữa 2 tọa độ GPS (Đơn vị: Kilomet)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const p1 = parseFloat(lat1);
  const l1 = parseFloat(lon1);
  const p2 = parseFloat(lat2);
  const l2 = parseFloat(lon2);
  if (isNaN(p1) || isNaN(l1) || isNaN(p2) || isNaN(l2)) return 0;

  const R = 6371; // Bán kính trái đất (km)
  const dLat = (p2 - p1) * Math.PI / 180;
  const dLon = (l2 - l1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1 * Math.PI / 180) * Math.cos(p2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Lấy thông tin địa chỉ mốc của quán từ database
const getStoreLandmarkConfig = async () => {
  try {
    const [rows] = await db.query('SELECT * FROM cau_hinh_quan WHERE id = 1');
    if (rows.length > 0) {
      return {
        ten_quan: rows[0].ten_quan,
        dia_chi_quan: rows[0].dia_chi_quan,
        vi_do: parseFloat(rows[0].vi_do),
        kinh_do: parseFloat(rows[0].kinh_do),
        ban_kinh_phuc_vu_km: parseFloat(rows[0].ban_kinh_phuc_vu_km || 3),
        gia_ship_moi_km: parseFloat(rows[0].gia_ship_moi_km || 5000)
      };
    }
  } catch (e) {
    console.log('Lỗi đọc mốc quán từ DB, dùng mốc dự phòng:', e.message);
  }
  return {
    ten_quan: 'Cửa hàng FastFood BDU',
    dia_chi_quan: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
    vi_do: 10.9805,
    kinh_do: 106.6745,
    ban_kinh_phuc_vu_km: 3.0,
    gia_ship_moi_km: 5000
  };
};

// 1. TẠO ĐƠN HÀNG MỚI (POST /api/orders) - ĐẶT HÀNG TỪ GIỎ HÀNG
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      dia_chi_giao_hang, 
      so_dien_thoai_nhan, 
      ghi_chu = '', 
      phuong_thuc_thanh_toan = 'tien_mat',
      ma_code = null,
      vi_do = null,
      kinh_do = null,
      coords = null
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

    // 3. Kiểm tra vị trí khách hàng so với Mốc Quán (Giới hạn bán kính 3km)
    const store = await getStoreLandmarkConfig();
    const custLat = vi_do || (coords && coords.lat) || null;
    const custLng = kinh_do || (coords && coords.lng) || null;

    let distanceKm = null;
    let phiGiaoHang = 5000; // Mặc định 5k cho đơn dưới 1km hoặc khi chưa có GPS

    if (custLat && custLng) {
      distanceKm = calculateHaversineDistance(store.vi_do, store.kinh_do, custLat, custLng);
      // Kiểm tra bán kính phục vụ
      if (distanceKm > store.ban_kinh_phuc_vu_km) {
        return res.status(400).json({
          success: false,
          message: `Rất tiếc! Quán chỉ nhận giao hàng trong bán kính ${store.ban_kinh_phuc_vu_km}km. Địa chỉ của bạn cách quán ${distanceKm}km (vượt quá ${store.ban_kinh_phuc_vu_km}km)!`
        });
      }
      // Phí giao hàng tính từ vị trí QUÁN: dưới 1km là 5.000đ, từ 1km trở đi cứ 1km thêm 5k, 100m thêm 500đ
      if (distanceKm <= 1.0) {
        phiGiaoHang = 5000;
      } else {
        const extraKm = distanceKm - 1.0;
        const extra100m = Math.ceil(Math.round(extraKm * 1000) / 100);
        phiGiaoHang = 5000 + extra100m * 500;
      }
    }

    // 4. Tính toán tổng tiền
    const tongTienHang = cartItems.reduce((sum, item) => sum + parseFloat(item.gia_tam_tinh), 0);
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
          const isFreeship = v.loai_ap_dung === 'phi_ship' || 
                             cleanCode.includes('SHIP') || 
                             (v.ten_voucher && v.ten_voucher.toLowerCase().includes('vận chuyển'));

          if (isFreeship) {
            // LOẠI 1: MIỄN / GIẢM PHÍ VẬN CHUYỂN
            // QUY TẮC: Chỉ được giảm tối đa bằng đúng tiền ship thực tế, KHÔNG ĐƯỢC GIẢM QUA TIỀN MÓN ĂN!
            if (phiGiaoHang > 0) {
              if (v.loai_giam_gia === 'phan_tram') {
                soTienGiam = (phiGiaoHang * parseFloat(v.gia_tri_giam)) / 100;
                if (v.giam_toi_da) soTienGiam = Math.min(soTienGiam, parseFloat(v.giam_toi_da));
              } else {
                soTienGiam = parseFloat(v.gia_tri_giam);
              }
              // Giảm tối đa bằng đúng phí ship, không bao giờ trừ quá phí ship
              soTienGiam = Math.min(Math.round(soTienGiam), phiGiaoHang);
            } else {
              soTienGiam = 0;
            }
          } else {
            // LOẠI 2: GIẢM GIÁ TIỀN MÓN ĂN / ĐƠN HÀNG
            // QUY TẮC: Chỉ được giảm tối đa bằng đúng tiền món ăn
            if (v.loai_giam_gia === 'phan_tram') {
              soTienGiam = (tongTienHang * parseFloat(v.gia_tri_giam)) / 100;
              if (v.giam_toi_da) soTienGiam = Math.min(soTienGiam, parseFloat(v.giam_toi_da));
            } else {
              soTienGiam = parseFloat(v.gia_tri_giam);
            }
            // Giảm tối đa bằng đúng tiền hàng
            soTienGiam = Math.min(Math.round(soTienGiam), tongTienHang);
          }

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

    // 5. Thực hiện Transaction chèn Đơn hàng & Chi tiết đơn hàng
    // 5a. Tạo đơn hàng mới kèm tọa độ giao và khoảng cách
    const [orderResult] = await db.query(`
      INSERT INTO don_hang (
        ma_nguoi_dung, ma_voucher, tong_tien_hang, phi_giao_hang, so_tien_giam, tong_thanh_toan,
        dia_chi_giao_hang, so_dien_thoai_nhan, ghi_chu,
        phuong_thuc_thanh_toan, trang_thai_thanh_toan, trang_thai_don_hang,
        vi_do_giao, kinh_do_giao, khoang_cach_km
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cho_xac_nhan', ?, ?, ?)
    `, [
      userId, maVoucherId, tongTienHang, phiGiaoHang, soTienGiam, tongThanhToan,
      dia_chi_giao_hang, so_dien_thoai_nhan, ghi_chu,
      phuong_thuc_thanh_toan, trangThaiThanhToan,
      custLat, custLng, distanceKm
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
    const { status, date } = req.query;

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
      // Nếu là Shipper (ma_vai_tro = 4), lấy các đơn của chính mình hoặc đơn chờ nhận (kể cả đang chế biến và sẵn sàng giao)
      query += ' AND (d.ma_shipper = ? OR (d.ma_shipper IS NULL AND d.trang_thai_don_hang IN ("san_sang_giao", "dang_che_bien")))';
      params.push(userId);
    }
    // Nhân viên (role 2) và Admin (role 3) xem toàn bộ danh sách đơn hàng để chế biến/quản lý

    // Lọc theo trạng thái đơn nếu có
    if (status) {
      query += ' AND d.trang_thai_don_hang = ?';
      params.push(status);
    }

    // Lọc theo ngày đặt hàng nếu có (Định dạng YYYY-MM-DD)
    if (date) {
      query += ' AND DATE(d.ngay_dat) = ?';
      params.push(date);
    }

    query += ' ORDER BY d.ma_don_hang DESC';

    const [orders] = await db.query(query, params);

    // Lấy kèm danh sách món ăn chi tiết trong từng đơn và chuẩn hóa các trường dữ liệu
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      const [items] = await db.query(`
        SELECT ct.*, m.ten_mon, m.hinh_anh, m.gia_ban
        FROM chi_tiet_don_hang ct
        JOIN mon_an m ON ct.ma_mon_an = m.ma_mon_an
        WHERE ct.ma_don_hang = ?
      `, [order.ma_don_hang]);

      const totalItemsCount = items.reduce((sum, it) => sum + (parseInt(it.so_luong) || 1), 0);

      return {
        ...order,
        dia_chi_giao: order.dia_chi_giao_hang,
        dia_chi_giao_hang: order.dia_chi_giao_hang,
        so_dien_thoai: order.so_dien_thoai_nhan,
        so_dien_thoai_nhan: order.so_dien_thoai_nhan,
        tong_tien: parseFloat(order.tong_thanh_toan),
        tong_thanh_toan: parseFloat(order.tong_thanh_toan),
        tong_tien_hang: parseFloat(order.tong_tien_hang),
        phi_giao_hang: parseFloat(order.phi_giao_hang),
        so_tien_giam: parseFloat(order.so_tien_giam || 0),
        khoang_cach_km: parseFloat(order.khoang_cach_km || 0),
        vi_do_giao: order.vi_do_giao ? parseFloat(order.vi_do_giao) : null,
        kinh_do_giao: order.kinh_do_giao ? parseFloat(order.kinh_do_giao) : null,
        vi_do_shipper: order.vi_do_shipper ? parseFloat(order.vi_do_shipper) : null,
        kinh_do_shipper: order.kinh_do_shipper ? parseFloat(order.kinh_do_shipper) : null,
        tong_so_mon: totalItemsCount,
        danh_sach_mon: items.map(it => ({
          ma_chi_tiet: it.ma_chi_tiet,
          ma_mon_an: it.ma_mon_an,
          ten_mon: it.ten_mon,
          hinh_anh: it.hinh_anh,
          so_luong: it.so_luong,
          don_gia: parseFloat(it.don_gia || it.gia_ban || 0),
          thanh_tien: parseFloat(it.thanh_tien || (it.don_gia * it.so_luong) || 0),
          ghi_chu: it.ghi_chu_mon
        }))
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
        dia_chi_giao: order.dia_chi_giao_hang,
        dia_chi_giao_hang: order.dia_chi_giao_hang,
        so_dien_thoai: order.so_dien_thoai_nhan,
        so_dien_thoai_nhan: order.so_dien_thoai_nhan,
        tong_tien: parseFloat(order.tong_thanh_toan),
        tong_thanh_toan: parseFloat(order.tong_thanh_toan),
        tong_tien_hang: parseFloat(order.tong_tien_hang),
        phi_giao_hang: parseFloat(order.phi_giao_hang),
        so_tien_giam: parseFloat(order.so_tien_giam || 0),
        khoang_cach_km: parseFloat(order.khoang_cach_km || 0),
        vi_do_giao: order.vi_do_giao ? parseFloat(order.vi_do_giao) : null,
        kinh_do_giao: order.kinh_do_giao ? parseFloat(order.kinh_do_giao) : null,
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

    const validStatuses = ['cho_xac_nhan', 'dang_che_bien', 'san_sang_giao', 'dang_giao', 'da_giao', 'da_huy'];
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

    // Kiểm tra quyền: Cho phép cập nhật tiến trình đơn hàng tuần tự
    if (userRole === 1) {
      if (order.ma_nguoi_dung !== userId) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa đơn hàng này!' });
      }
      if (trang_thai_moi === 'da_huy' && trangThaiCu !== 'cho_xac_nhan') {
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

    // Gắn shipper nếu có truyền lên hoặc nếu chuyển sang dang_giao mà chưa có shipper
    let shipperIdToAssign = ma_shipper || (userRole === 4 ? userId : null);
    if (!shipperIdToAssign && trang_thai_moi === 'dang_giao' && !order.ma_shipper) {
      const [shippers] = await db.query('SELECT ma_nguoi_dung FROM nguoi_dung WHERE ma_vai_tro = 4 LIMIT 1');
      if (shippers.length > 0) {
        shipperIdToAssign = shippers[0].ma_nguoi_dung;
      }
    }

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

// 5. SHIPPER NHẬN ĐƠN HÀNG (PUT /api/orders/:id/accept-delivery)
const acceptDelivery = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.ma_vai_tro;
    const orderId = req.params.id;
    const { vi_do = null, kinh_do = null, coords = null } = req.body;

    if (userRole !== 4 && userRole !== 3) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ tài xế giao hàng (Shipper) mới có quyền nhận đơn này!'
      });
    }

    const [orders] = await db.query('SELECT * FROM don_hang WHERE ma_don_hang = ?', [orderId]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Đơn hàng không tồn tại!' });
    }

    const order = orders[0];
    if (order.trang_thai_don_hang !== 'san_sang_giao' && order.trang_thai_don_hang !== 'dang_che_bien') {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng đang ở trạng thái '${order.trang_thai_don_hang}', không thể nhận giao!`
      });
    }

    if (order.ma_shipper && order.ma_shipper !== userId) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng này đã có tài xế khác nhận!'
      });
    }

    const store = await getStoreLandmarkConfig();
    const shipperLat = vi_do || (coords && coords.lat) || null;
    const shipperLng = kinh_do || (coords && coords.lng) || null;

    // Yêu cầu bắt buộc phải có GPS thực tế của Shipper
    if (!shipperLat || !shipperLng) {
      return res.status(400).json({
        success: false,
        message: 'Bạn phải bật GPS để xác định vị trí trước khi nhận đơn hàng!'
      });
    }

    // Bắt buộc Shipper phải ở trong phạm vi 3km so với quán mới được nhận đơn
    const distToStore = calculateHaversineDistance(store.vi_do, store.kinh_do, shipperLat, shipperLng);
    const maxRadius = parseFloat(store.ban_kinh_phuc_vu_km || 3.0);
    if (distToStore !== null && distToStore > maxRadius) {
      return res.status(400).json({
        success: false,
        message: `Bạn đang ở cách quán ${distToStore} km (vượt quá bán kính ${maxRadius} km của quán). Bạn chỉ được nhận đơn khi trong phạm vi 3km từ quán!`
      });
    }

    // Khoảng cách và phí giao hàng giữ nguyên theo khoảng cách từ QUÁN đến KHÁCH HÀNG (không tính từ vị trí shipper nữa)
    const fixedDistanceKm = parseFloat(order.khoang_cach_km || 0);
    const fixedShippingFee = parseFloat(order.phi_giao_hang || 5000);
    const fixedTotal = parseFloat(order.tong_thanh_toan);

    const [users] = await db.query('SELECT ho_ten FROM nguoi_dung WHERE ma_nguoi_dung = ?', [userId]);
    const shipperName = users.length > 0 ? users[0].ho_ten : 'Tài xế';

    // Cập nhật ma_shipper theo cơ chế ATOMIC UPDATE (Ai nhanh tay nhận trước sẽ được)
    const [updateRes] = await db.query(`
      UPDATE don_hang 
      SET ma_shipper = ?, 
          trang_thai_don_hang = "dang_giao",
          vi_do_shipper = ?,
          kinh_do_shipper = ?
      WHERE ma_don_hang = ? 
        AND (ma_shipper IS NULL OR ma_shipper = ?)
        AND trang_thai_don_hang IN ('san_sang_giao', 'dang_che_bien')
    `, [userId, shipperLat, shipperLng, orderId, userId]);

    if (updateRes.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rất tiếc! Đơn hàng này vừa được tài xế khác nhanh tay nhận trước!'
      });
    }

    // Ghi log
    await db.query(`
      INSERT INTO lich_su_trang_thai_don (
        ma_don_hang, trang_thai_cu, trang_thai_moi, ghi_chu, nguoi_thuc_hien
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      orderId, 
      order.trang_thai_don_hang, 
      'dang_giao', 
      `Shipper đã nhận đơn giao tới khách (Khoảng cách từ quán: ${fixedDistanceKm} km, Tiền ship: ${fixedShippingFee.toLocaleString('vi-VN')} đ)`, 
      `${shipperName} (Shipper)`
    ]);

    return res.status(200).json({
      success: true,
      message: `Tài xế ${shipperName} đã nhận đơn #${orderId} thành công!`,
      data: { 
        ma_don_hang: parseInt(orderId), 
        trang_thai: 'dang_giao',
        khoang_cach_km: fixedDistanceKm,
        phi_giao_hang: fixedShippingFee,
        tong_thanh_toan: fixedTotal
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi nhận đơn giao.', error: error.message });
  }
};

// 6. THỐNG KÊ GIAO HÀNG & THU NHẬP THEO NGÀY CHO SHIPPER (GET /api/orders/shipper/stats)
const getShipperStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Tổng quan tích lũy toàn thời gian
    const [overall] = await db.query(`
      SELECT 
        COUNT(*) as total_delivered, 
        COALESCE(SUM(phi_giao_hang), 0) as total_shipping_earnings,
        COALESCE(SUM(CASE WHEN phuong_thuc_thanh_toan = 'tien_mat' THEN tong_thanh_toan ELSE 0 END), 0) as total_cod 
      FROM don_hang 
      WHERE ma_shipper = ? AND trang_thai_don_hang = "da_giao"
    `, [userId]);

    // 2. Thu nhập hôm nay
    const [today] = await db.query(`
      SELECT 
        COUNT(*) as today_delivered, 
        COALESCE(SUM(phi_giao_hang), 0) as today_shipping_earnings,
        COALESCE(SUM(CASE WHEN phuong_thuc_thanh_toan = 'tien_mat' THEN tong_thanh_toan ELSE 0 END), 0) as today_cod 
      FROM don_hang 
      WHERE ma_shipper = ? AND trang_thai_don_hang = "da_giao" 
        AND DATE(COALESCE(ngay_cap_nhat, ngay_dat)) = CURDATE()
    `, [userId]);

    // 3. Phân chia thu nhập chi tiết theo từng ngày (Daily breakdown)
    const [dailyEarnings] = await db.query(`
      SELECT 
        DATE_FORMAT(COALESCE(ngay_cap_nhat, ngay_dat), '%Y-%m-%d') as ngay,
        COUNT(*) as so_don,
        COALESCE(SUM(phi_giao_hang), 0) as thu_nhap_ship,
        COALESCE(SUM(CASE WHEN phuong_thuc_thanh_toan = 'tien_mat' THEN tong_thanh_toan ELSE 0 END), 0) as cod_thu_ho
      FROM don_hang 
      WHERE ma_shipper = ? AND trang_thai_don_hang = "da_giao"
      GROUP BY DATE_FORMAT(COALESCE(ngay_cap_nhat, ngay_dat), '%Y-%m-%d')
      ORDER BY ngay DESC
      LIMIT 30
    `, [userId]);

    // 4. Số đơn đang giao
    const [delivering] = await db.query(
      'SELECT COUNT(*) as total_delivering FROM don_hang WHERE ma_shipper = ? AND trang_thai_don_hang = "dang_giao"',
      [userId]
    );

    // 5. Số đơn có sẵn chờ nhận
    const [available] = await db.query(
      'SELECT COUNT(*) as total_available FROM don_hang WHERE trang_thai_don_hang = "san_sang_giao" AND ma_shipper IS NULL'
    );

    return res.status(200).json({
      success: true,
      data: {
        total_delivered: parseInt(overall[0]?.total_delivered || 0),
        total_earnings: parseFloat(overall[0]?.total_shipping_earnings || 0),
        total_cod: parseFloat(overall[0]?.total_cod || 0),
        today_delivered: parseInt(today[0]?.today_delivered || 0),
        today_earnings: parseFloat(today[0]?.today_shipping_earnings || 0),
        today_cod: parseFloat(today[0]?.today_cod || 0),
        daily_earnings: dailyEarnings.map(d => ({
          ngay: d.ngay,
          so_don: parseInt(d.so_don || 0),
          thu_nhap_ship: parseFloat(d.thu_nhap_ship || 0),
          cod_thu_ho: parseFloat(d.cod_thu_ho || 0)
        })),
        total_delivering: parseInt(delivering[0]?.total_delivering || 0),
        total_available: parseInt(available[0]?.total_available || 0)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi thống kê shipper.', error: error.message });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderDetail,
  updateOrderStatus,
  acceptDelivery,
  getShipperStats
};
