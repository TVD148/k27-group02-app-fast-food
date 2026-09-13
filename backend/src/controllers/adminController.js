const db = require('../config/db');

// ============================================================================
// I. QUẢN LÝ DANH MỤC (CRUD CATEGORIES)
// ============================================================================

// 1. Thêm danh mục mới (POST /api/admin/categories)
const createCategory = async (req, res) => {
  try {
    const { ten_danh_muc, mo_ta, hinh_anh } = req.body;

    if (!ten_danh_muc) {
      return res.status(400).json({
        success: false,
        message: 'Tên danh mục không được để trống!'
      });
    }

    const [result] = await db.query(
      'INSERT INTO danh_muc (ten_danh_muc, mo_ta, hinh_anh) VALUES (?, ?, ?)',
      [ten_danh_muc, mo_ta || null, hinh_anh || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Tạo danh mục mới thành công!',
      data: {
        ma_danh_muc: result.insertId,
        ten_danh_muc,
        mo_ta,
        hinh_anh
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tạo danh mục.',
      error: error.message
    });
  }
};

// 2. Cập nhật thông tin danh mục (PUT /api/admin/categories/:id)
const updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { ten_danh_muc, mo_ta, hinh_anh } = req.body;

    // Kiểm tra danh mục có tồn tại không
    const [categories] = await db.query('SELECT * FROM danh_muc WHERE ma_danh_muc = ?', [categoryId]);
    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Danh mục không tồn tại!'
      });
    }

    if (!ten_danh_muc) {
      return res.status(400).json({
        success: false,
        message: 'Tên danh mục không được để trống!'
      });
    }

    await db.query(
      'UPDATE danh_muc SET ten_danh_muc = ?, mo_ta = ?, hinh_anh = ? WHERE ma_danh_muc = ?',
      [ten_danh_muc, mo_ta || null, hinh_anh || null, categoryId]
    );

    return res.status(200).json({
      success: true,
      message: 'Cập nhật danh mục thành công!',
      data: {
        ma_danh_muc: parseInt(categoryId),
        ten_danh_muc,
        mo_ta,
        hinh_anh
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi cập nhật danh mục.',
      error: error.message
    });
  }
};

// 3. Xóa danh mục (DELETE /api/admin/categories/:id)
const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Kiểm tra danh mục có tồn tại không
    const [categories] = await db.query('SELECT * FROM danh_muc WHERE ma_danh_muc = ?', [categoryId]);
    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Danh mục không tồn tại!'
      });
    }

    // Thực hiện xóa (các món ăn trong danh mục này sẽ tự động chuyển ma_danh_muc thành NULL theo cấu hình ON DELETE SET NULL)
    await db.query('DELETE FROM danh_muc WHERE ma_danh_muc = ?', [categoryId]);

    return res.status(200).json({
      success: true,
      message: 'Xóa danh mục thành công!'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi xóa danh mục.',
      error: error.message
    });
  }
};


// ============================================================================
// II. QUẢN LÝ MÓN ĂN (CRUD ITEMS)
// ============================================================================

// 1. Thêm món ăn mới (POST /api/admin/items)
const createItem = async (req, res) => {
  try {
    const { ten_mon, mo_ta, gia_ban, hinh_anh, ma_danh_muc, trang_thai, ma_nhom_list } = req.body;

    // Validation đầu vào
    if (!ten_mon || gia_ban === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Tên món ăn và Giá bán không được để trống!'
      });
    }

    if (parseFloat(gia_ban) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Giá bán không được nhỏ hơn 0!'
      });
    }

    // Kiểm tra danh mục liên kết có tồn tại không
    if (ma_danh_muc) {
      const [categories] = await db.query('SELECT * FROM danh_muc WHERE ma_danh_muc = ?', [ma_danh_muc]);
      if (categories.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh mục món ăn liên kết không tồn tại!'
        });
      }
    }

    // Chèn vào CSDL
    const [result] = await db.query(
      'INSERT INTO mon_an (ten_mon, mo_ta, gia_ban, hinh_anh, ma_danh_muc, trang_thai) VALUES (?, ?, ?, ?, ?, ?)',
      [ten_mon, mo_ta || null, gia_ban, hinh_anh || null, ma_danh_muc || null, trang_thai || 'con_hang']
    );

    const newId = result.insertId;

    // Nếu có truyền kèm danh sách nhóm tùy chọn, thực hiện liên kết
    if (ma_nhom_list && Array.isArray(ma_nhom_list) && ma_nhom_list.length > 0) {
      const linkQueries = ma_nhom_list.map(ma_nhom => {
        return db.query('INSERT INTO tuy_chon_mon_an (ma_mon_an, ma_nhom) VALUES (?, ?)', [newId, ma_nhom]);
      });
      await Promise.all(linkQueries);
    }

    return res.status(201).json({
      success: true,
      message: 'Thêm món ăn mới thành công!',
      data: {
        ma_mon_an: newId,
        ten_mon,
        mo_ta,
        gia_ban: parseFloat(gia_ban),
        hinh_anh,
        ma_danh_muc,
        trang_thai,
        ma_nhom_list
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi thêm món ăn.',
      error: error.message
    });
  }
};

// 2. Cập nhật thông tin món ăn (PUT /api/admin/items/:id)
const updateItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const { ten_mon, mo_ta, gia_ban, hinh_anh, ma_danh_muc, trang_thai, ma_nhom_list } = req.body;

    // Kiểm tra món ăn có tồn tại không
    const [items] = await db.query('SELECT * FROM mon_an WHERE ma_mon_an = ?', [itemId]);
    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Món ăn không tồn tại!'
      });
    }

    // Validation
    if (!ten_mon || gia_ban === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Tên món ăn và Giá bán không được để trống!'
      });
    }

    if (parseFloat(gia_ban) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Giá bán không được nhỏ hơn 0!'
      });
    }

    // Cập nhật bảng mon_an
    await db.query(
      'UPDATE mon_an SET ten_mon = ?, mo_ta = ?, gia_ban = ?, hinh_anh = ?, ma_danh_muc = ?, trang_thai = ? WHERE ma_mon_an = ?',
      [ten_mon, mo_ta || null, gia_ban, hinh_anh || null, ma_danh_muc || null, trang_thai || 'con_hang', itemId]
    );

    // Đồng bộ lại danh sách nhóm tùy chọn (nếu có gửi lên)
    if (ma_nhom_list && Array.isArray(ma_nhom_list)) {
      // 1. Xóa các tùy chọn cũ của món này
      await db.query('DELETE FROM tuy_chon_mon_an WHERE ma_mon_an = ?', [itemId]);
      
      // 2. Thêm lại các tùy chọn mới
      if (ma_nhom_list.length > 0) {
        const linkQueries = ma_nhom_list.map(ma_nhom => {
          return db.query('INSERT INTO tuy_chon_mon_an (ma_mon_an, ma_nhom) VALUES (?, ?)', [itemId, ma_nhom]);
        });
        await Promise.all(linkQueries);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật món ăn thành công!',
      data: {
        ma_mon_an: parseInt(itemId),
        ten_mon,
        mo_ta,
        gia_ban: parseFloat(gia_ban),
        hinh_anh,
        ma_danh_muc,
        trang_thai,
        ma_nhom_list
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi cập nhật món ăn.',
      error: error.message
    });
  }
};

// 3. Xóa món ăn (DELETE /api/admin/items/:id)
const deleteItem = async (req, res) => {
  try {
    const itemId = req.params.id;

    // Kiểm tra món ăn có tồn tại không
    const [items] = await db.query('SELECT * FROM mon_an WHERE ma_mon_an = ?', [itemId]);
    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Món ăn không tồn tại!'
      });
    }

    // Xóa món ăn (các bảng phụ thuộc như tuy_chon_mon_an sẽ tự động xóa theo cấu hình ON DELETE CASCADE)
    await db.query('DELETE FROM mon_an WHERE ma_mon_an = ?', [itemId]);

    return res.status(200).json({
      success: true,
      message: 'Xóa món ăn thành công!'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi xóa món ăn.',
      error: error.message
    });
  }
};

// 4. Bật/Tắt trạng thái còn hàng / hết hàng của món ăn (PUT /api/admin/items/:id/toggle-status)
const toggleItemStatus = async (req, res) => {
  try {
    const itemId = req.params.id;
    const [items] = await db.query('SELECT ma_mon_an, ten_mon, trang_thai FROM mon_an WHERE ma_mon_an = ?', [itemId]);
    if (items.length === 0) {
      return res.status(404).json({ success: false, message: 'Món ăn không tồn tại!' });
    }

    const currentStatus = items[0].trang_thai;
    const newStatus = currentStatus === 'con_hang' ? 'het_hang' : 'con_hang';

    await db.query('UPDATE mon_an SET trang_thai = ? WHERE ma_mon_an = ?', [newStatus, itemId]);

    return res.status(200).json({
      success: true,
      message: `Đã đổi trạng thái món '${items[0].ten_mon}' thành '${newStatus === 'con_hang' ? 'Còn hàng' : 'Hết hàng'}'!`,
      data: { ma_mon_an: parseInt(itemId), trang_thai: newStatus }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi đổi trạng thái món.', error: error.message });
  }
};

// ============================================================================
// III. QUẢN LÝ VOUCHER & MÃ GIẢM GIÁ (CRUD VOUCHERS)
// ============================================================================

// 1. Lấy toàn bộ voucher (GET /api/admin/vouchers)
const getAdminVouchers = async (req, res) => {
  try {
    const [vouchers] = await db.query('SELECT * FROM ma_giam_gia ORDER BY ma_voucher DESC');
    return res.status(200).json({ success: true, data: vouchers });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tải voucher.', error: error.message });
  }
};

// 2. Tạo voucher mới (POST /api/admin/vouchers)
const createVoucher = async (req, res) => {
  try {
    const { 
      ma_code, 
      ten_voucher, 
      mo_ta = '', 
      loai_giam_gia = 'so_tien', 
      gia_tri_giam = 0, 
      giam_toi_da = 0, 
      don_hang_toi_thieu = 0, 
      so_luong_phat_hanh = 100,
      ngay_ket_thuc = '2026-12-31 23:59:59'
    } = req.body;

    if (!ma_code || !ten_voucher || !gia_tri_giam) {
      return res.status(400).json({ success: false, message: 'Mã code, Tên voucher và Giá trị giảm là bắt buộc!' });
    }

    // Kiểm tra trùng mã code
    const [existing] = await db.query('SELECT ma_voucher FROM ma_giam_gia WHERE ma_code = ?', [ma_code.toUpperCase().trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Mã voucher này đã tồn tại trên hệ thống!' });
    }

    const [result] = await db.query(`
      INSERT INTO ma_giam_gia (
        ma_code, ten_voucher, mo_ta, loai_giam_gia, gia_tri_giam, giam_toi_da, 
        don_hang_toi_thieu, so_luong_phat_hanh, so_luong_da_dung, ngay_bat_dau, ngay_ket_thuc, trang_thai
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), ?, 'hoat_dong')
    `, [
      ma_code.toUpperCase().trim(),
      ten_voucher.trim(),
      mo_ta,
      loai_giam_gia,
      parseFloat(gia_tri_giam),
      parseFloat(giam_toi_da || gia_tri_giam),
      parseFloat(don_hang_toi_thieu || 0),
      parseInt(so_luong_phat_hanh || 100),
      ngay_ket_thuc
    ]);

    return res.status(201).json({
      success: true,
      message: `Đã tạo mã giảm giá '${ma_code.toUpperCase().trim()}' thành công!`,
      data: { ma_voucher: result.insertId }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tạo voucher.', error: error.message });
  }
};

// 3. Xóa voucher (DELETE /api/admin/vouchers/:id)
const deleteVoucher = async (req, res) => {
  try {
    const voucherId = req.params.id;
    await db.query('DELETE FROM ma_giam_gia WHERE ma_voucher = ?', [voucherId]);
    return res.status(200).json({ success: true, message: 'Đã xóa voucher thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa voucher.', error: error.message });
  }
};

// 4. Bật/Tắt trạng thái voucher (PUT /api/admin/vouchers/:id/toggle)
const toggleVoucherStatus = async (req, res) => {
  try {
    const voucherId = req.params.id;
    const [vouchers] = await db.query('SELECT ma_voucher, trang_thai FROM ma_giam_gia WHERE ma_voucher = ?', [voucherId]);
    if (vouchers.length === 0) {
      return res.status(404).json({ success: false, message: 'Voucher không tồn tại!' });
    }
    const newStatus = vouchers[0].trang_thai === 'hoat_dong' ? 'tam_dung' : 'hoat_dong';
    await db.query('UPDATE ma_giam_gia SET trang_thai = ? WHERE ma_voucher = ?', [newStatus, voucherId]);
    return res.status(200).json({ success: true, message: `Đã đổi trạng thái voucher thành '${newStatus}'!` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi đổi trạng thái voucher.', error: error.message });
  }
};

// ============================================================================
// IV. QUẢN LÝ TÀI KHOẢN & NGƯỜI DÙNG (USERS & ROLES)
// ============================================================================

// 1. Lấy danh sách người dùng (GET /api/admin/users)
const getUsers = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.ma_nguoi_dung, u.ho_ten, u.email, u.so_dien_thoai, u.dia_chi, u.ma_vai_tro, u.trang_thai, u.ngay_tao,
             v.ten_vai_tro
      FROM nguoi_dung u
      JOIN vai_tro v ON u.ma_vai_tro = v.ma_vai_tro
      ORDER BY u.ma_nguoi_dung DESC
    `);
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách người dùng.', error: error.message });
  }
};

// 2. Tạo tài khoản mới (Nhân viên / Shipper / Khách) (POST /api/admin/users)
const createUser = async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { ho_ten, email, mat_khau = '123456', so_dien_thoai, dia_chi = '', ma_vai_tro = 2 } = req.body;

    if (!ho_ten || !so_dien_thoai) {
      return res.status(400).json({ success: false, message: 'Họ tên và Số điện thoại là bắt buộc!' });
    }

    const [existing] = await db.query('SELECT ma_nguoi_dung FROM nguoi_dung WHERE so_dien_thoai = ?', [so_dien_thoai.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Số điện thoại này đã được đăng ký trên hệ thống!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(mat_khau, salt);

    const [result] = await db.query(`
      INSERT INTO nguoi_dung (ho_ten, email, mat_khau, so_dien_thoai, dia_chi, ma_vai_tro, trang_thai)
      VALUES (?, ?, ?, ?, ?, ?, 'hoat_dong')
    `, [ho_ten.trim(), email ? email.trim() : null, hashedPassword, so_dien_thoai.trim(), dia_chi, parseInt(ma_vai_tro)]);

    return res.status(201).json({
      success: true,
      message: `Đã tạo tài khoản cho '${ho_ten}' thành công! (Mật khẩu mặc định: ${mat_khau})`,
      data: { ma_nguoi_dung: result.insertId }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tạo tài khoản.', error: error.message });
  }
};

// 3. Đổi vai trò tài khoản (PUT /api/admin/users/:id/role)
const updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { ma_vai_tro } = req.body;
    if (!ma_vai_tro) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn vai trò mới!' });
    }
    await db.query('UPDATE nguoi_dung SET ma_vai_tro = ? WHERE ma_nguoi_dung = ?', [parseInt(ma_vai_tro), userId]);
    return res.status(200).json({ success: true, message: 'Cập nhật quyền tài khoản thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật vai trò.', error: error.message });
  }
};

// ============================================================================
// V. BÁO CÁO THỐNG KÊ DOANH THU (DASHBOARD STATS)
// ============================================================================

const getDashboardStats = async (req, res) => {
  try {
    // Tổng doanh thu từ đơn đã giao thành công
    const [revenue] = await db.query('SELECT COALESCE(SUM(tong_thanh_toan), 0) as total_revenue FROM don_hang WHERE trang_thai_don_hang = "da_giao"');
    // Tổng số đơn theo trạng thái
    const [ordersCount] = await db.query('SELECT COUNT(*) as total_orders FROM don_hang');
    const [ordersPending] = await db.query('SELECT COUNT(*) as pending_orders FROM don_hang WHERE trang_thai_don_hang IN ("cho_xac_nhan", "dang_che_bien")');
    const [ordersDelivered] = await db.query('SELECT COUNT(*) as delivered_orders FROM don_hang WHERE trang_thai_don_hang = "da_giao"');
    // Tổng số món ăn
    const [foodsCount] = await db.query('SELECT COUNT(*) as total_foods FROM mon_an');
    // Tổng số người dùng theo vai trò
    const [usersStaff] = await db.query('SELECT COUNT(*) as total_staff FROM nguoi_dung WHERE ma_vai_tro = 2');
    const [usersShipper] = await db.query('SELECT COUNT(*) as total_shipper FROM nguoi_dung WHERE ma_vai_tro = 4');

    return res.status(200).json({
      success: true,
      data: {
        total_revenue: parseFloat(revenue[0].total_revenue || 0),
        total_orders: ordersCount[0].total_orders || 0,
        pending_orders: ordersPending[0].pending_orders || 0,
        delivered_orders: ordersDelivered[0].delivered_orders || 0,
        total_foods: foodsCount[0].total_foods || 0,
        total_staff: usersStaff[0].total_staff || 0,
        total_shipper: usersShipper[0].total_shipper || 0
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy thống kê dashboard.', error: error.message });
  }
};

// 6. Lấy danh sách nguyên liệu dinh dưỡng (GET /api/admin/ingredients)
const getIngredients = async (req, res) => {
  try {
    const [ingredients] = await db.query('SELECT * FROM nguyen_lieu ORDER BY ma_nguyen_lieu ASC');
    return res.status(200).json({ success: true, data: ingredients });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách nguyên liệu.', error: error.message });
  }
};

// 7. Lấy cấu hình địa chỉ mốc quán (GET /api/admin/store-landmark hoặc /api/store/landmark)
const getStoreLandmark = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM cau_hinh_quan WHERE id = 1');
    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          ten_quan: 'Cửa hàng FastFood BDU',
          dia_chi_quan: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
          vi_do: 10.9805,
          kinh_do: 106.6745,
          ban_kinh_phuc_vu_km: 3.0,
          gia_ship_moi_km: 5000
        }
      });
    }
    const row = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: row.id,
        ten_quan: row.ten_quan,
        dia_chi_quan: row.dia_chi_quan,
        vi_do: parseFloat(row.vi_do),
        kinh_do: parseFloat(row.kinh_do),
        ban_kinh_phuc_vu_km: parseFloat(row.ban_kinh_phuc_vu_km),
        gia_ship_moi_km: parseFloat(row.gia_ship_moi_km)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy cấu hình mốc quán.', error: error.message });
  }
};

// 8. Cập nhật cấu hình địa chỉ mốc quán (PUT /api/admin/store-landmark)
const updateStoreLandmark = async (req, res) => {
  try {
    const { ten_quan, dia_chi_quan, vi_do, kinh_do, ban_kinh_phuc_vu_km, gia_ship_moi_km } = req.body;
    if (!dia_chi_quan) {
      return res.status(400).json({ success: false, message: 'Địa chỉ mốc quán không được để trống!' });
    }
    const lat = parseFloat(vi_do) || 10.9805;
    const lng = parseFloat(kinh_do) || 106.6745;
    const radius = parseFloat(ban_kinh_phuc_vu_km) || 3.0;
    const pricePerKm = parseFloat(gia_ship_moi_km) || 5000;
    const name = ten_quan || 'Cửa hàng FastFood BDU';

    await db.query(`
      INSERT INTO cau_hinh_quan (id, ten_quan, dia_chi_quan, vi_do, kinh_do, ban_kinh_phuc_vu_km, gia_ship_moi_km)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ten_quan = VALUES(ten_quan),
        dia_chi_quan = VALUES(dia_chi_quan),
        vi_do = VALUES(vi_do),
        kinh_do = VALUES(kinh_do),
        ban_kinh_phuc_vu_km = VALUES(ban_kinh_phuc_vu_km),
        gia_ship_moi_km = VALUES(gia_ship_moi_km)
    `, [name, dia_chi_quan, lat, lng, radius, pricePerKm]);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật địa chỉ mốc quán và phạm vi giao hàng thành công!',
      data: {
        ten_quan: name,
        dia_chi_quan,
        vi_do: lat,
        kinh_do: lng,
        ban_kinh_phuc_vu_km: radius,
        gia_ship_moi_km: pricePerKm
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật cấu hình mốc quán.', error: error.message });
  }
};

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateItem,
  deleteItem,
  toggleItemStatus,
  getAdminVouchers,
  createVoucher,
  deleteVoucher,
  toggleVoucherStatus,
  getUsers,
  createUser,
  updateUserRole,
  getDashboardStats,
  getIngredients,
  getStoreLandmark,
  updateStoreLandmark
};
