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

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateItem,
  deleteItem
};
