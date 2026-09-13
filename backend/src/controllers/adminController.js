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
    const { ten_mon, mo_ta, gia_ban, hinh_anh, ma_danh_muc, trang_thai, ma_nhom_list, nguyen_lieu_list } = req.body;

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

    // Nếu có truyền kèm danh sách nguyên liệu dinh dưỡng, lưu vào mon_an_nguyen_lieu
    if (nguyen_lieu_list && Array.isArray(nguyen_lieu_list) && nguyen_lieu_list.length > 0) {
      const ingQueries = nguyen_lieu_list.map(nl => {
        return db.query(
          'INSERT INTO mon_an_nguyen_lieu (ma_mon_an, ma_nguyen_lieu, so_luong_mac_dinh, co_the_tuy_bien, so_luong_toi_da) VALUES (?, ?, ?, ?, ?)',
          [
            newId, 
            nl.ma_nguyen_lieu, 
            nl.so_luong_mac_dinh !== undefined ? nl.so_luong_mac_dinh : 1, 
            nl.co_the_tuy_bien ? 1 : 0, 
            nl.so_luong_toi_da !== undefined ? nl.so_luong_toi_da : 3
          ]
        );
      });
      await Promise.all(ingQueries);
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
        ma_nhom_list,
        nguyen_lieu_list
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
    const { ten_mon, mo_ta, gia_ban, hinh_anh, ma_danh_muc, trang_thai, ma_nhom_list, nguyen_lieu_list } = req.body;

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

    // Đồng bộ lại danh sách nguyên liệu dinh dưỡng (nếu có gửi lên)
    if (nguyen_lieu_list && Array.isArray(nguyen_lieu_list)) {
      // Xóa công thức cũ
      await db.query('DELETE FROM mon_an_nguyen_lieu WHERE ma_mon_an = ?', [itemId]);

      // Thêm lại công thức mới
      if (nguyen_lieu_list.length > 0) {
        const ingQueries = nguyen_lieu_list.map(nl => {
          return db.query(
            'INSERT INTO mon_an_nguyen_lieu (ma_mon_an, ma_nguyen_lieu, so_luong_mac_dinh, co_the_tuy_bien, so_luong_toi_da) VALUES (?, ?, ?, ?, ?)',
            [
              itemId, 
              nl.ma_nguyen_lieu, 
              nl.so_luong_mac_dinh !== undefined ? nl.so_luong_mac_dinh : 1, 
              nl.co_the_tuy_bien ? 1 : 0, 
              nl.so_luong_toi_da !== undefined ? nl.so_luong_toi_da : 3
            ]
          );
        });
        await Promise.all(ingQueries);
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
        ma_nhom_list,
        nguyen_lieu_list
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
      trang_thai_moi: newStatus,
      data: { ma_mon_an: parseInt(itemId), trang_thai: newStatus, trang_thai_moi: newStatus }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi đổi trạng thái món.', error: error.message });
  }
};

// 5. Lấy chi tiết quản trị món ăn (Kèm nhóm kích cỡ/vị và định lượng dinh dưỡng) (GET /api/admin/items/:id/details)
const getItemAdminDetails = async (req, res) => {
  try {
    const itemId = req.params.id;
    const [items] = await db.query(
      `SELECT m.*, d.ten_danh_muc 
       FROM mon_an m 
       LEFT JOIN danh_muc d ON m.ma_danh_muc = d.ma_danh_muc 
       WHERE m.ma_mon_an = ?`,
      [itemId]
    );
    if (items.length === 0) {
      return res.status(404).json({ success: false, message: 'Món ăn không tồn tại!' });
    }

    const item = items[0];

    // Lấy danh sách nhóm tùy chọn đã gán cho món này
    const [assignedGroups] = await db.query(
      'SELECT ma_nhom FROM tuy_chon_mon_an WHERE ma_mon_an = ?',
      [itemId]
    );
    const ma_nhom_list = assignedGroups.map(g => g.ma_nhom);

    // Lấy công thức nguyên liệu dinh dưỡng cấu thành
    const [recipe] = await db.query(
      `SELECT 
        mnl.ma_mon_an_nguyen_lieu,
        mnl.ma_nguyen_lieu,
        nl.ten_nguyen_lieu,
        nl.don_vi_tinh,
        nl.calo,
        nl.protein,
        nl.carbs,
        nl.fat,
        nl.don_gia_thay_doi,
        mnl.so_luong_mac_dinh,
        mnl.co_the_tuy_bien,
        mnl.so_luong_toi_da
       FROM mon_an_nguyen_lieu mnl
       JOIN nguyen_lieu nl ON mnl.ma_nguyen_lieu = nl.ma_nguyen_lieu
       WHERE mnl.ma_mon_an = ?`,
      [itemId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...item,
        ma_nhom_list,
        nguyen_lieu_list: recipe
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết quản trị món ăn',
      error: error.message
    });
  }
};

// 6. Lấy danh sách các nhóm tùy chọn (Kích cỡ Size, Vị, Topping) (GET /api/admin/option-groups)
const getOptionGroups = async (req, res) => {
  try {
    const [groups] = await db.query('SELECT * FROM nhom_tuy_chon ORDER BY ma_nhom ASC');
    const [values] = await db.query('SELECT * FROM gia_tri_tuy_chon ORDER BY ma_nhom ASC, ma_gia_tri ASC');

    const result = groups.map(g => {
      return {
        ...g,
        la_bat_buoc: g.la_bat_buoc === 1,
        values: values.filter(v => v.ma_nhom === g.ma_nhom)
      };
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách nhóm tùy chọn',
      error: error.message
    });
  }
};

// 7. Tạo nhóm tùy chọn mới (POST /api/admin/option-groups)
const createOptionGroup = async (req, res) => {
  try {
    const { ten_nhom, la_bat_buoc = 0, chon_toi_da = 1, values = [] } = req.body;
    if (!ten_nhom) {
      return res.status(400).json({ success: false, message: 'Tên nhóm tùy chọn không được để trống!' });
    }

    const [groupResult] = await db.query(
      'INSERT INTO nhom_tuy_chon (ten_nhom, la_bat_buoc, chon_toi_da) VALUES (?, ?, ?)',
      [ten_nhom, la_bat_buoc ? 1 : 0, chon_toi_da || 1]
    );
    const newGroupId = groupResult.insertId;

    if (values && Array.isArray(values) && values.length > 0) {
      for (const val of values) {
        if (val.ten_gia_tri) {
          await db.query(
            'INSERT INTO gia_tri_tuy_chon (ma_nhom, ten_gia_tri, gia_tang_them) VALUES (?, ?, ?)',
            [newGroupId, val.ten_gia_tri, val.gia_tang_them || 0]
          );
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Tạo nhóm tùy chọn mới thành công!',
      data: { ma_nhom: newGroupId, ten_nhom }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo nhóm tùy chọn',
      error: error.message
    });
  }
};

// 8. Cập nhật nhóm tùy chọn (PUT /api/admin/option-groups/:id)
const updateOptionGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { ten_nhom, la_bat_buoc = 0, chon_toi_da = 1, values = [] } = req.body;
    if (!ten_nhom) {
      return res.status(400).json({ success: false, message: 'Tên nhóm tùy chọn không được để trống!' });
    }

    await db.query(
      'UPDATE nhom_tuy_chon SET ten_nhom = ?, la_bat_buoc = ?, chon_toi_da = ? WHERE ma_nhom = ?',
      [ten_nhom, la_bat_buoc ? 1 : 0, chon_toi_da || 1, groupId]
    );

    if (values && Array.isArray(values)) {
      await db.query('DELETE FROM gia_tri_tuy_chon WHERE ma_nhom = ?', [groupId]);
      for (const val of values) {
        if (val.ten_gia_tri) {
          await db.query(
            'INSERT INTO gia_tri_tuy_chon (ma_nhom, ten_gia_tri, gia_tang_them) VALUES (?, ?, ?)',
            [groupId, val.ten_gia_tri, val.gia_tang_them || 0]
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật nhóm tùy chọn thành công!'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật nhóm tùy chọn',
      error: error.message
    });
  }
};

// 9. Xóa nhóm tùy chọn (DELETE /api/admin/option-groups/:id)
const deleteOptionGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    await db.query('DELETE FROM gia_tri_tuy_chon WHERE ma_nhom = ?', [groupId]);
    await db.query('DELETE FROM tuy_chon_mon_an WHERE ma_nhom = ?', [groupId]);
    await db.query('DELETE FROM nhom_tuy_chon WHERE ma_nhom = ?', [groupId]);
    return res.status(200).json({
      success: true,
      message: 'Xóa nhóm tùy chọn thành công!'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa nhóm tùy chọn',
      error: error.message
    });
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
      loai_ap_dung = 'don_hang',
      gia_tri_giam = 0, 
      giam_toi_da = 0, 
      don_hang_toi_thieu = 0, 
      so_luong_phat_hanh = 100,
      ngay_ket_thuc = '2026-12-31 23:59:59'
    } = req.body;

    if (!ma_code || !gia_tri_giam) {
      return res.status(400).json({ success: false, message: 'Mã code và Giá trị giảm là bắt buộc!' });
    }

    const cleanCode = ma_code.toUpperCase().trim();
    const cleanLoaiApDung = loai_ap_dung === 'phi_ship' ? 'phi_ship' : 'don_hang';
    const cleanLoaiGiamGia = loai_giam_gia === 'phan_tram' ? 'phan_tram' : 'so_tien';
    const numGiaTri = parseFloat(gia_tri_giam);

    if (isNaN(numGiaTri) || numGiaTri <= 0) {
      return res.status(400).json({ success: false, message: 'Giá trị giảm phải là số lớn hơn 0!' });
    }

    if (cleanLoaiGiamGia === 'phan_tram' && (numGiaTri <= 0 || numGiaTri > 100)) {
      return res.status(400).json({ success: false, message: 'Mức giảm phần trăm phải nằm trong khoảng từ 1% đến 100%!' });
    }

    // Kiểm tra trùng mã code
    const [existing] = await db.query('SELECT ma_voucher FROM ma_giam_gia WHERE ma_code = ?', [cleanCode]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Mã voucher này đã tồn tại trên hệ thống!' });
    }

    const finalTenVoucher = (ten_voucher && ten_voucher.trim()) 
      ? ten_voucher.trim() 
      : (cleanLoaiApDung === 'phi_ship' 
          ? `Freeship ${cleanLoaiGiamGia === 'phan_tram' ? numGiaTri + '%' : numGiaTri.toLocaleString('vi-VN') + 'đ'}`
          : `Giảm giá ${cleanLoaiGiamGia === 'phan_tram' ? numGiaTri + '%' : numGiaTri.toLocaleString('vi-VN') + 'đ'}`);

    const finalMoTa = (mo_ta && mo_ta.trim())
      ? mo_ta.trim()
      : (cleanLoaiApDung === 'phi_ship'
          ? `Giảm ${cleanLoaiGiamGia === 'phan_tram' ? numGiaTri + '%' : numGiaTri.toLocaleString('vi-VN') + ' VNĐ'} phí vận chuyển cho đơn hàng từ ${parseFloat(don_hang_toi_thieu || 0).toLocaleString('vi-VN')} VNĐ`
          : `Giảm ${cleanLoaiGiamGia === 'phan_tram' ? numGiaTri + '%' : numGiaTri.toLocaleString('vi-VN') + ' VNĐ'} tiền món ăn cho đơn hàng từ ${parseFloat(don_hang_toi_thieu || 0).toLocaleString('vi-VN')} VNĐ`);

    const [result] = await db.query(`
      INSERT INTO ma_giam_gia (
        ma_code, ten_voucher, mo_ta, loai_giam_gia, loai_ap_dung, gia_tri_giam, giam_toi_da, 
        don_hang_toi_thieu, so_luong_phat_hanh, so_luong_da_dung, ngay_bat_dau, ngay_ket_thuc, trang_thai
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), ?, 'hoat_dong')
    `, [
      cleanCode,
      finalTenVoucher,
      finalMoTa,
      cleanLoaiGiamGia,
      cleanLoaiApDung,
      numGiaTri,
      parseFloat(giam_toi_da || (cleanLoaiGiamGia === 'so_tien' ? numGiaTri : 0)),
      parseFloat(don_hang_toi_thieu || 0),
      parseInt(so_luong_phat_hanh || 100),
      ngay_ket_thuc
    ]);

    return res.status(201).json({
      success: true,
      message: `Đã tạo mã giảm giá '${cleanCode}' (${cleanLoaiApDung === 'phi_ship' ? 'Giảm phí ship' : 'Giảm món ăn'}) thành công!`,
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

    const targetRole = parseInt(ma_vai_tro);
    // YÊU CẦU BẢO MẬT: Không thể cấp quyền Quản trị viên cho tài khoản khác
    if (targetRole === 3) {
      return res.status(403).json({
        success: false,
        message: 'Bảo mật hệ thống: Không thể tạo tài khoản với quyền Quản trị viên (Admin)!'
      });
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
    `, [ho_ten.trim(), email ? email.trim() : null, hashedPassword, so_dien_thoai.trim(), dia_chi, targetRole]);

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
// YÊU CẦU BẢO MẬT: Có thể điều chỉnh quyền của các tài khoản, KHÔNG THỂ cấp quyền quản trị cho các tài khoản khác
const updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { ma_vai_tro } = req.body;
    if (!ma_vai_tro) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn vai trò mới!' });
    }

    const targetRole = parseInt(ma_vai_tro);

    // 1. Ràng buộc: Tuyệt đối không cho phép cấp quyền Quản trị viên (Admin - 3)
    if (targetRole === 3) {
      return res.status(403).json({
        success: false,
        message: 'Bảo mật hệ thống: Không thể cấp quyền Quản trị viên (Admin) cho các tài khoản khác!'
      });
    }

    if (![1, 2, 4].includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: 'Vai trò không hợp lệ! Chỉ có thể chọn: Khách hàng (1), Nhân viên quán & bếp (2), hoặc Shipper (4).'
      });
    }

    // 2. Ràng buộc: Kiểm tra tài khoản đích, bảo vệ tài khoản Quản trị viên hiện có
    const [targetUser] = await db.query('SELECT ma_nguoi_dung, ho_ten, ma_vai_tro FROM nguoi_dung WHERE ma_nguoi_dung = ?', [userId]);
    if (targetUser.length === 0) {
      return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại!' });
    }

    if (targetUser[0].ma_vai_tro === 3) {
      return res.status(403).json({
        success: false,
        message: 'Bảo mật hệ thống: Không thể thay đổi quyền của tài khoản Quản trị viên!'
      });
    }

    await db.query('UPDATE nguoi_dung SET ma_vai_tro = ? WHERE ma_nguoi_dung = ?', [targetRole, userId]);

    const roleMap = {
      1: 'Khách hàng',
      2: 'Nhân viên quán & bếp',
      4: 'Tài xế Shipper'
    };

    return res.status(200).json({ 
      success: true, 
      message: `Đã đổi quyền của '${targetUser[0].ho_ten}' thành '${roleMap[targetRole]}' thành công!`,
      data: { ma_nguoi_dung: userId, ma_vai_tro: targetRole }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật vai trò.', error: error.message });
  }
};

// ============================================================================
// V. BÁO CÁO THỐNG KÊ DOANH THU & NHÂN SỰ TRỰC TUYẾN THẬT
// ============================================================================

// 5. Lấy danh sách nhân sự thực sự đang trực tuyến mở app (GET /api/admin/online-personnel)
const getOnlinePersonnel = async (req, res) => {
  try {
    // Lấy các nhân sự (Nhân viên bếp 2 hoặc Shipper 4) có hoạt động trong 5 phút qua
    // Hoặc Shipper đang bật chế độ trực tuyến trong 15 phút qua
    const [onlineUsers] = await db.query(`
      SELECT u.ma_nguoi_dung, u.ho_ten, u.email, u.so_dien_thoai, u.ma_vai_tro, u.trang_thai_shipper, u.lan_hoat_dong_cuoi,
             TIMESTAMPDIFF(SECOND, u.lan_hoat_dong_cuoi, NOW()) as seconds_since_active,
             v.ten_vai_tro
      FROM nguoi_dung u
      JOIN vai_tro v ON u.ma_vai_tro = v.ma_vai_tro
      WHERE u.ma_vai_tro IN (2, 4)
        AND u.lan_hoat_dong_cuoi IS NOT NULL
        AND (
          u.lan_hoat_dong_cuoi >= NOW() - INTERVAL 5 MINUTE
          OR (u.ma_vai_tro = 4 AND u.trang_thai_shipper = 'truc_tuyen' AND u.lan_hoat_dong_cuoi >= NOW() - INTERVAL 15 MINUTE)
        )
      ORDER BY u.lan_hoat_dong_cuoi DESC
    `);

    const onlineStaff = onlineUsers.filter(u => u.ma_vai_tro === 2);
    const onlineShippers = onlineUsers.filter(u => u.ma_vai_tro === 4);

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách nhân sự trực tuyến thành công!',
      data: {
        online_staff_count: onlineStaff.length,
        online_shipper_count: onlineShippers.length,
        online_staff: onlineStaff,
        online_shippers: onlineShippers,
        all_online: onlineUsers
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy nhân sự trực tuyến.', error: error.message });
  }
};

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
    
    // Đếm nhân sự THẬT SỰ TRỰC TUYẾN trong vòng 5 phút qua (không dùng dữ liệu giả)
    const [onlineStaffRows] = await db.query(`
      SELECT COUNT(*) as total_online_staff 
      FROM nguoi_dung 
      WHERE ma_vai_tro = 2 
        AND lan_hoat_dong_cuoi IS NOT NULL
        AND lan_hoat_dong_cuoi >= NOW() - INTERVAL 5 MINUTE
    `);

    const [onlineShipperRows] = await db.query(`
      SELECT COUNT(*) as total_online_shipper 
      FROM nguoi_dung 
      WHERE ma_vai_tro = 4 
        AND lan_hoat_dong_cuoi IS NOT NULL
        AND (
          lan_hoat_dong_cuoi >= NOW() - INTERVAL 5 MINUTE 
          OR (trang_thai_shipper = 'truc_tuyen' AND lan_hoat_dong_cuoi >= NOW() - INTERVAL 15 MINUTE)
        )
    `);

    const [usersStaffTotal] = await db.query('SELECT COUNT(*) as total_staff FROM nguoi_dung WHERE ma_vai_tro = 2');
    const [usersShipperTotal] = await db.query('SELECT COUNT(*) as total_shipper FROM nguoi_dung WHERE ma_vai_tro = 4');

    // Thống kê doanh thu theo các khung giờ (08h - 22h)
    const [hourlyRows] = await db.query(`
      SELECT 
        HOUR(ngay_dat) as gio,
        COALESCE(SUM(tong_thanh_toan), 0) as doanh_thu,
        COUNT(*) as so_don
      FROM don_hang
      WHERE trang_thai_don_hang = 'da_giao'
      GROUP BY HOUR(ngay_dat)
      ORDER BY gio ASC
    `);

    // Chuẩn bị 8 mốc giờ trong ngày để vẽ biểu đồ (bao quát cả ngày 24h)
    const defaultHours = [8, 10, 12, 14, 16, 18, 20, 22];
    const hourlyData = defaultHours.map((targetH, idx) => {
      const minH = idx === 0 ? 0 : defaultHours[idx - 1] + 1;
      const maxH = idx === defaultHours.length - 1 ? 23 : targetH;
      const matched = hourlyRows.filter(r => {
        const g = parseInt(r.gio);
        return g >= minH && g <= maxH;
      });
      const amount = matched.reduce((sum, r) => sum + parseFloat(r.doanh_thu || 0), 0);
      const orders = matched.reduce((sum, r) => sum + parseInt(r.so_don || 0), 0);
      return {
        hour: `${String(targetH).padStart(2, '0')}:00`,
        amount,
        orders
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        total_revenue: parseFloat(revenue[0].total_revenue || 0),
        total_orders: ordersCount[0].total_orders || 0,
        pending_orders: ordersPending[0].pending_orders || 0,
        delivered_orders: ordersDelivered[0].delivered_orders || 0,
        total_foods: foodsCount[0].total_foods || 0,
        // Dữ liệu biểu đồ theo giờ thực tế
        hourly_revenue: hourlyData,
        // Nhân sự thực sự trực tuyến
        online_staff_count: onlineStaffRows[0].total_online_staff || 0,
        online_shipper_count: onlineShipperRows[0].total_online_shipper || 0,
        // Tổng số đăng ký
        total_staff: usersStaffTotal[0].total_staff || 0,
        total_shipper: usersShipperTotal[0].total_shipper || 0
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy thống kê dashboard.', error: error.message });
  }
};

// 6. Quản lý nguyên liệu dinh dưỡng (GET/POST/PUT/DELETE /api/admin/ingredients)
const getIngredients = async (req, res) => {
  try {
    const [ingredients] = await db.query('SELECT * FROM nguyen_lieu ORDER BY ma_nguyen_lieu ASC');
    return res.status(200).json({ success: true, data: ingredients });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách nguyên liệu.', error: error.message });
  }
};

const createIngredient = async (req, res) => {
  try {
    const { ten_nguyen_lieu, don_vi_tinh, calo, protein, carbs, fat, don_gia_thay_doi } = req.body;
    if (!ten_nguyen_lieu || !ten_nguyen_lieu.trim()) {
      return res.status(400).json({ success: false, message: 'Tên nguyên liệu không được để trống!' });
    }

    const [result] = await db.query(
      `INSERT INTO nguyen_lieu (ten_nguyen_lieu, don_vi_tinh, calo, protein, carbs, fat, don_gia_thay_doi, trang_thai)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        ten_nguyen_lieu.trim(),
        don_vi_tinh ? don_vi_tinh.trim() : 'phần',
        parseFloat(calo) || 0,
        parseFloat(protein) || 0,
        parseFloat(carbs) || 0,
        parseFloat(fat) || 0,
        parseFloat(don_gia_thay_doi) || 0
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Tạo nguyên liệu mới thành công!',
      data: {
        ma_nguyen_lieu: result.insertId,
        ten_nguyen_lieu: ten_nguyen_lieu.trim(),
        don_vi_tinh: don_vi_tinh ? don_vi_tinh.trim() : 'phần',
        calo: parseFloat(calo) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        don_gia_thay_doi: parseFloat(don_gia_thay_doi) || 0,
        trang_thai: 1
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi tạo nguyên liệu mới.', error: error.message });
  }
};

const updateIngredient = async (req, res) => {
  try {
    const ingredientId = req.params.id;
    const { ten_nguyen_lieu, don_vi_tinh, calo, protein, carbs, fat, don_gia_thay_doi, trang_thai } = req.body;
    if (!ten_nguyen_lieu || !ten_nguyen_lieu.trim()) {
      return res.status(400).json({ success: false, message: 'Tên nguyên liệu không được để trống!' });
    }

    await db.query(
      `UPDATE nguyen_lieu 
       SET ten_nguyen_lieu = ?, don_vi_tinh = ?, calo = ?, protein = ?, carbs = ?, fat = ?, don_gia_thay_doi = ?, trang_thai = ?
       WHERE ma_nguyen_lieu = ?`,
      [
        ten_nguyen_lieu.trim(),
        don_vi_tinh ? don_vi_tinh.trim() : 'phần',
        parseFloat(calo) || 0,
        parseFloat(protein) || 0,
        parseFloat(carbs) || 0,
        parseFloat(fat) || 0,
        parseFloat(don_gia_thay_doi) || 0,
        trang_thai !== undefined ? trang_thai : 1,
        ingredientId
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin nguyên liệu thành công!',
      data: {
        ma_nguyen_lieu: parseInt(ingredientId),
        ten_nguyen_lieu: ten_nguyen_lieu.trim(),
        don_vi_tinh: don_vi_tinh ? don_vi_tinh.trim() : 'phần',
        calo: parseFloat(calo) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        don_gia_thay_doi: parseFloat(don_gia_thay_doi) || 0,
        trang_thai: trang_thai !== undefined ? trang_thai : 1
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật nguyên liệu.', error: error.message });
  }
};

const deleteIngredient = async (req, res) => {
  try {
    const ingredientId = req.params.id;
    await db.query('DELETE FROM mon_an_nguyen_lieu WHERE ma_nguyen_lieu = ?', [ingredientId]);
    await db.query('DELETE FROM nguyen_lieu WHERE ma_nguyen_lieu = ?', [ingredientId]);

    return res.status(200).json({
      success: true,
      message: 'Xóa nguyên liệu thành công!'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa nguyên liệu.', error: error.message });
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
  getItemAdminDetails,
  getOptionGroups,
  createOptionGroup,
  updateOptionGroup,
  deleteOptionGroup,
  getAdminVouchers,
  createVoucher,
  deleteVoucher,
  toggleVoucherStatus,
  getUsers,
  createUser,
  updateUserRole,
  getOnlinePersonnel,
  getDashboardStats,
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  getStoreLandmark,
  updateStoreLandmark
};

