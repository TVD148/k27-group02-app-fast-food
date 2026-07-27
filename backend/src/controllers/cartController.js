const db = require('../config/db');

// Helper: Lấy hoặc tạo giỏ hàng cho người dùng
const getOrCreateCartId = async (userId) => {
  const [existingCarts] = await db.query('SELECT ma_gio_hang FROM gio_hang WHERE ma_nguoi_dung = ?', [userId]);
  if (existingCarts.length > 0) {
    return existingCarts[0].ma_gio_hang;
  }
  const [result] = await db.query('INSERT INTO gio_hang (ma_nguoi_dung) VALUES (?)', [userId]);
  return result.insertId;
};

// 1. LẤY CHI TIẾT GIỎ HÀNG (GET /api/cart)
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartId = await getOrCreateCartId(userId);

    // Truy vấn danh sách món ăn trong giỏ hàng
    const [cartItems] = await db.query(`
      SELECT 
        ctgh.ma_chi_tiet_gio,
        ctgh.ma_gio_hang,
        ctgh.ma_mon_an,
        ctgh.so_luong,
        ctgh.tuy_chon_da_chon,
        ctgh.gia_tam_tinh,
        m.ten_mon,
        m.hinh_anh,
        m.gia_ban AS gia_goc,
        m.so_luong_ton,
        m.trang_thai AS trang_thai_mon
      FROM chi_tiet_gio_hang ctgh
      JOIN mon_an m ON ctgh.ma_mon_an = m.ma_mon_an
      WHERE ctgh.ma_gio_hang = ?
      ORDER BY ctgh.ma_chi_tiet_gio DESC
    `, [cartId]);

    // Xử lý đọc danh sách tên tùy chọn cho từng item trong giỏ
    let tongTienGioHang = 0;
    const formattedItems = await Promise.all(cartItems.map(async (item) => {
      tongTienGioHang += parseFloat(item.gia_tam_tinh);
      
      let selectedOptionIds = [];
      if (item.tuy_chon_da_chon) {
        selectedOptionIds = typeof item.tuy_chon_da_chon === 'string' 
          ? JSON.parse(item.tuy_chon_da_chon) 
          : item.tuy_chon_da_chon;
      }

      let optionDetails = [];
      if (Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0) {
        const [options] = await db.query(`
          SELECT gt.ma_gia_tri, gt.ten_gia_tri, gt.gia_tang_them, ntc.ten_nhom
          FROM gia_tri_tuy_chon gt
          JOIN nhom_tuy_chon ntc ON gt.ma_nhom = ntc.ma_nhom
          WHERE gt.ma_gia_tri IN (?)
        `, [selectedOptionIds]);
        
        optionDetails = options.map(opt => ({
          ma_gia_tri: opt.ma_gia_tri,
          ten_nhom: opt.ten_nhom,
          ten_gia_tri: opt.ten_gia_tri,
          gia_tang_them: parseFloat(opt.gia_tang_them)
        }));
      }

      return {
        ma_chi_tiet_gio: item.ma_chi_tiet_gio,
        ma_mon_an: item.ma_mon_an,
        ten_mon: item.ten_mon,
        hinh_anh: item.hinh_anh,
        gia_goc: parseFloat(item.gia_goc),
        so_luong: item.so_luong,
        so_luong_ton: item.so_luong_ton,
        trang_thai_mon: item.trang_thai_mon,
        tuy_chon_da_chon: optionDetails,
        tuy_chon_ids: selectedOptionIds,
        gia_tam_tinh: parseFloat(item.gia_tam_tinh)
      };
    }));

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin giỏ hàng thành công!',
      data: {
        ma_gio_hang: cartId,
        items: formattedItems,
        tong_so_luong: formattedItems.reduce((acc, curr) => acc + curr.so_luong, 0),
        tong_tien: tongTienGioHang
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy giỏ hàng.',
      error: error.message
    });
  }
};

// 2. THÊM MÓN VÀO GIỎ HÀNG (POST /api/cart/add)
const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ma_mon_an, so_luong = 1, tuy_chon_da_chon = [] } = req.body;

    if (!ma_mon_an || parseInt(so_luong) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã món ăn và số lượng lớn hơn 0!'
      });
    }

    // 1. Kiểm tra món ăn và tồn kho
    const [foods] = await db.query('SELECT * FROM mon_an WHERE ma_mon_an = ?', [ma_mon_an]);
    if (foods.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Món ăn không tồn tại trong thực đơn!'
      });
    }

    const food = foods[0];
    if (food.trang_thai === 'het_hang' || food.so_luong_ton < parseInt(so_luong)) {
      return res.status(400).json({
        success: false,
        message: `Món '${food.ten_mon}' đã hết hàng hoặc không đủ tồn kho (Còn lại: ${food.so_luong_ton})!`
      });
    }

    // 2. Lấy giỏ hàng của user
    const cartId = await getOrCreateCartId(userId);

    // 3. Tính đơn giá món kèm tùy chọn (Size, Topping)
    let extraCost = 0;
    const optionIds = Array.isArray(tuy_chon_da_chon) ? tuy_chon_da_chon.map(Number) : [];
    
    if (optionIds.length > 0) {
      const [options] = await db.query(
        'SELECT gia_tang_them FROM gia_tri_tuy_chon WHERE ma_gia_tri IN (?)',
        [optionIds]
      );
      extraCost = options.reduce((sum, opt) => sum + parseFloat(opt.gia_tang_them), 0);
    }

    const unitPrice = parseFloat(food.gia_ban) + extraCost;

    // Chuẩn hóa chuỗi JSON mảng tùy chọn đã sắp xếp để so sánh trùng lặp
    const sortedOptionJson = JSON.stringify(optionIds.sort((a, b) => a - b));

    // 4. Kiểm tra xem món ăn với ĐÚNG TÙY CHỌN này đã có trong giỏ chưa
    const [existingItems] = await db.query(
      'SELECT * FROM chi_tiet_gio_hang WHERE ma_gio_hang = ? AND ma_mon_an = ?',
      [cartId, ma_mon_an]
    );

    let matchingItem = null;
    for (const item of existingItems) {
      let existingOptions = [];
      if (item.tuy_chon_da_chon) {
        existingOptions = typeof item.tuy_chon_da_chon === 'string'
          ? JSON.parse(item.tuy_chon_da_chon)
          : item.tuy_chon_da_chon;
      }
      const existingSortedJson = JSON.stringify(existingOptions.map(Number).sort((a, b) => a - b));
      if (sortedOptionJson === existingSortedJson) {
        matchingItem = item;
        break;
      }
    }

    if (matchingItem) {
      // Đã có trùng món & option => Cập nhật tăng số lượng
      const newQuantity = matchingItem.so_luong + parseInt(so_luong);
      if (newQuantity > food.so_luong_ton) {
        return res.status(400).json({
          success: false,
          message: `Không thể thêm! Tổng số lượng trong giỏ (${newQuantity}) vượt quá tồn kho (${food.so_luong_ton}).`
        });
      }

      const newSubtotal = unitPrice * newQuantity;
      await db.query(
        'UPDATE chi_tiet_gio_hang SET so_luong = ?, gia_tam_tinh = ? WHERE ma_chi_tiet_gio = ?',
        [newQuantity, newSubtotal, matchingItem.ma_chi_tiet_gio]
      );
    } else {
      // Chưa có => Thêm dòng mới vào giỏ
      const subtotal = unitPrice * parseInt(so_luong);
      await db.query(
        'INSERT INTO chi_tiet_gio_hang (ma_gio_hang, ma_mon_an, so_luong, tuy_chon_da_chon, gia_tam_tinh) VALUES (?, ?, ?, ?, ?)',
        [cartId, ma_mon_an, parseInt(so_luong), sortedOptionJson, subtotal]
      );
    }

    return res.status(201).json({
      success: true,
      message: `Đã thêm '${food.ten_mon}' vào giỏ hàng thành công!`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi thêm món vào giỏ hàng.',
      error: error.message
    });
  }
};

// 3. CẬP NHẬT SỐ LƯỢNG MÓN TRONG GIỎ (PUT /api/cart/update/:id)
const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.id;
    const { so_luong } = req.body;

    if (so_luong === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp số lượng mới!'
      });
    }

    const newQty = parseInt(so_luong);

    // Kiểm tra chi tiết giỏ hàng có tồn tại và thuộc giỏ hàng của user không
    const [cartItems] = await db.query(`
      SELECT ctgh.*, m.gia_ban, m.so_luong_ton, m.ten_mon 
      FROM chi_tiet_gio_hang ctgh
      JOIN gio_hang gh ON ctgh.ma_gio_hang = gh.ma_gio_hang
      JOIN mon_an m ON ctgh.ma_mon_an = m.ma_mon_an
      WHERE ctgh.ma_chi_tiet_gio = ? AND gh.ma_nguoi_dung = ?
    `, [cartItemId, userId]);

    if (cartItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sản phẩm không tồn tại trong giỏ hàng của bạn!'
      });
    }

    const item = cartItems[0];

    // Nếu số lượng <= 0 thì tiến hành xóa món khỏi giỏ
    if (newQty <= 0) {
      await db.query('DELETE FROM chi_tiet_gio_hang WHERE ma_chi_tiet_gio = ?', [cartItemId]);
      return res.status(200).json({
        success: true,
        message: 'Đã xóa sản phẩm khỏi giỏ hàng!'
      });
    }

    // Kiểm tra tồn kho
    if (newQty > item.so_luong_ton) {
      return res.status(400).json({
        success: false,
        message: `Số lượng yêu cầu (${newQty}) vượt quá số lượng tồn kho của '${item.ten_mon}' (Còn: ${item.so_luong_ton})!`
      });
    }

    // Tính lại đơn giá đơn vị (gốc + tùy chọn)
    let extraCost = 0;
    if (item.tuy_chon_da_chon) {
      const optionIds = typeof item.tuy_chon_da_chon === 'string' 
        ? JSON.parse(item.tuy_chon_da_chon) 
        : item.tuy_chon_da_chon;

      if (Array.isArray(optionIds) && optionIds.length > 0) {
        const [options] = await db.query(
          'SELECT gia_tang_them FROM gia_tri_tuy_chon WHERE ma_gia_tri IN (?)',
          [optionIds]
        );
        extraCost = options.reduce((sum, opt) => sum + parseFloat(opt.gia_tang_them), 0);
      }
    }

    const unitPrice = parseFloat(item.gia_ban) + extraCost;
    const newSubtotal = unitPrice * newQty;

    await db.query(
      'UPDATE chi_tiet_gio_hang SET so_luong = ?, gia_tam_tinh = ? WHERE ma_chi_tiet_gio = ?',
      [newQty, newSubtotal, cartItemId]
    );

    return res.status(200).json({
      success: true,
      message: 'Cập nhật số lượng giỏ hàng thành công!'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi cập nhật giỏ hàng.',
      error: error.message
    });
  }
};

// 4. XÓA MÓN KHỎI GIỎ HÀNG (DELETE /api/cart/remove/:id)
const removeCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.id;

    const [result] = await db.query(`
      DELETE ctgh FROM chi_tiet_gio_hang ctgh
      JOIN gio_hang gh ON ctgh.ma_gio_hang = gh.ma_gio_hang
      WHERE ctgh.ma_chi_tiet_gio = ? AND gh.ma_nguoi_dung = ?
    `, [cartItemId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Món ăn không tồn tại trong giỏ hàng của bạn!'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa món ăn khỏi giỏ hàng thành công!'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi xóa món khỏi giỏ hàng.',
      error: error.message
    });
  }
};

// 5. LÀM SẠCH GIỎ HÀNG (DELETE /api/cart/clear)
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartId = await getOrCreateCartId(userId);

    await db.query('DELETE FROM chi_tiet_gio_hang WHERE ma_gio_hang = ?', [cartId]);

    return res.status(200).json({
      success: true,
      message: 'Đã làm sạch giỏ hàng thành công!'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi xóa toàn bộ giỏ hàng.',
      error: error.message
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart
};
