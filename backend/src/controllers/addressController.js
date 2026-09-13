const db = require('../config/db');

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Quy tắc tính tiền ship mới: dưới 1km là 5.000đ, từ 1km trở đi cứ 1km thêm 5k, 100m thêm 500đ
function calculateShippingFee(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return 5000;
  const d = parseFloat(distanceKm);
  if (isNaN(d) || d <= 0) return 5000;
  if (d <= 1.0) return 5000;
  const extraKm = d - 1.0;
  const extra100m = Math.ceil(Math.round(extraKm * 1000) / 100);
  return 5000 + extra100m * 500;
}

const getStoreConfig = async () => {
  try {
    const [landmarkRows] = await db.query('SELECT * FROM cau_hinh_quan WHERE id = 1');
    if (landmarkRows.length > 0) {
      const row = landmarkRows[0];
      return {
        ten_quan: row.ten_quan,
        dia_chi_quan: row.dia_chi_quan,
        vi_do: parseFloat(row.vi_do || 10.9805),
        kinh_do: parseFloat(row.kinh_do || 106.6745),
        ban_kinh_phuc_vu_km: parseFloat(row.ban_kinh_phuc_vu_km || 3.0),
        gia_ship_moi_km: parseFloat(row.gia_ship_moi_km || 5000)
      };
    }
  } catch (e) {
    console.log('Lỗi query cau_hinh_quan:', e.message);
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

// Helper định dạng dữ liệu trả về cho đồng bộ với Frontend kèm Khoảng cách tới quán & Tiền ship
const formatAddressItem = (row, storeLandmark = null) => {
  let khoangCachKm = null;
  let phiShipDuKien = 5000;
  let trongBanKinh = true;

  if (row.vi_do && row.kinh_do && storeLandmark) {
    khoangCachKm = calculateHaversineDistance(
      storeLandmark.vi_do,
      storeLandmark.kinh_do,
      parseFloat(row.vi_do),
      parseFloat(row.kinh_do)
    );
    phiShipDuKien = calculateShippingFee(khoangCachKm);
    trongBanKinh = khoangCachKm <= storeLandmark.ban_kinh_phuc_vu_km;
  }

  return {
    id: row.ma_dia_chi.toString(),
    ma_dia_chi: row.ma_dia_chi,
    name: row.ten_nguoi_nhan,
    phone: row.so_dien_thoai,
    label: row.nhan_dia_chi || 'Nhà riêng',
    icon: row.nhan_dia_chi === 'Nhà riêng' ? '🏠' : row.nhan_dia_chi === 'Văn phòng' ? '🏢' : '📍',
    address: row.dia_chi,
    detail: row.ghi_chu || '',
    coords: (row.vi_do && row.kinh_do) ? {
      lat: parseFloat(row.vi_do),
      lng: parseFloat(row.kinh_do)
    } : null,
    khoang_cach_km: khoangCachKm,
    phi_ship_du_kien: phiShipDuKien,
    trong_ban_kinh: trongBanKinh,
    isDefault: !!row.mac_dinh,
    created_at: row.ngay_tao
  };
};

// 1. LẤY DANH SÁCH ĐỊA CHỈ TRONG SỔ ĐỊA CHỈ CỦA NGƯỜI DÙNG (GET /api/address)
const getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const storeLandmark = await getStoreConfig();
    const [rows] = await db.query(
      'SELECT * FROM dia_chi_nguoi_dung WHERE ma_nguoi_dung = ? ORDER BY mac_dinh DESC, ngay_cap_nhat DESC',
      [userId]
    );

    const formattedList = rows.map(row => formatAddressItem(row, storeLandmark));

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách sổ địa chỉ thành công!',
      data: formattedList,
      store_landmark: storeLandmark
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy sổ địa chỉ.',
      error: error.message
    });
  }
};

// 2. THÊM ĐỊA CHỈ MỚI VÀO SỔ ĐỊA CHỈ (POST /api/address)
// Đồng thời tự động cập nhật vào cột dia_chi của bảng nguoi_dung nếu là địa chỉ mặc định
const createAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name, 
      phone, 
      label = 'Nhà riêng', 
      address, 
      detail = '', 
      coords, 
      isDefault 
    } = req.body;

    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanAddress = (address || '').trim();

    if (!cleanName || !cleanPhone || !cleanAddress) {
      return res.status(400).json({
        success: false,
        message: 'Tên người nhận, số điện thoại và địa chỉ đều là bắt buộc!'
      });
    }

    // Đếm số lượng địa chỉ hiện có của người dùng
    const [countRows] = await db.query(
      'SELECT COUNT(*) as total FROM dia_chi_nguoi_dung WHERE ma_nguoi_dung = ?',
      [userId]
    );
    const hasNoAddress = countRows[0].total === 0;
    const shouldBeDefault = isDefault || hasNoAddress ? 1 : 0;

    // Nếu là mặc định, reset các địa chỉ cũ về mac_dinh = 0
    if (shouldBeDefault === 1) {
      await db.query(
        'UPDATE dia_chi_nguoi_dung SET mac_dinh = 0 WHERE ma_nguoi_dung = ?',
        [userId]
      );
      // CẬP NHẬT TRỰC TIẾP VÀO CỘT dia_chi TRONG BẢNG nguoi_dung
      await db.query(
        'UPDATE nguoi_dung SET dia_chi = ? WHERE ma_nguoi_dung = ?',
        [cleanAddress, userId]
      );
    }

    const lat = coords?.lat ? parseFloat(coords.lat) : null;
    const lng = coords?.lng ? parseFloat(coords.lng) : null;

    const [insertResult] = await db.query(
      `INSERT INTO dia_chi_nguoi_dung 
        (ma_nguoi_dung, ten_nguoi_nhan, so_dien_thoai, nhan_dia_chi, dia_chi, ghi_chu, vi_do, kinh_do, mac_dinh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, cleanName, cleanPhone, label, cleanAddress, detail.trim(), lat, lng, shouldBeDefault]
    );

    const [newRows] = await db.query(
      'SELECT * FROM dia_chi_nguoi_dung WHERE ma_dia_chi = ?',
      [insertResult.insertId]
    );

    const storeLandmark = await getStoreConfig();
    return res.status(201).json({
      success: true,
      message: 'Đã thêm địa chỉ vào sổ địa chỉ thành công!',
      data: formatAddressItem(newRows[0], storeLandmark)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi thêm địa chỉ vào sổ địa chỉ.',
      error: error.message
    });
  }
};

// 3. CẬP NHẬT ĐỊA CHỈ (PUT /api/address/:id)
const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;
    const { 
      name, 
      phone, 
      label = 'Nhà riêng', 
      address, 
      detail = '', 
      coords, 
      isDefault 
    } = req.body;

    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanAddress = (address || '').trim();

    if (!cleanName || !cleanPhone || !cleanAddress) {
      return res.status(400).json({
        success: false,
        message: 'Tên người nhận, số điện thoại và địa chỉ đều là bắt buộc!'
      });
    }

    const [existing] = await db.query(
      'SELECT * FROM dia_chi_nguoi_dung WHERE ma_dia_chi = ? AND ma_nguoi_dung = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn!'
      });
    }

    const shouldBeDefault = isDefault ? 1 : existing[0].mac_dinh;

    if (shouldBeDefault === 1) {
      await db.query(
        'UPDATE dia_chi_nguoi_dung SET mac_dinh = 0 WHERE ma_nguoi_dung = ?',
        [userId]
      );
      // CẬP NHẬT TRỰC TIẾP VÀO CỘT dia_chi TRONG BẢNG nguoi_dung
      await db.query(
        'UPDATE nguoi_dung SET dia_chi = ? WHERE ma_nguoi_dung = ?',
        [cleanAddress, userId]
      );
    }

    const lat = coords?.lat ? parseFloat(coords.lat) : (existing[0].vi_do || null);
    const lng = coords?.lng ? parseFloat(coords.lng) : (existing[0].kinh_do || null);

    await db.query(
      `UPDATE dia_chi_nguoi_dung 
       SET ten_nguoi_nhan = ?, so_dien_thoai = ?, nhan_dia_chi = ?, dia_chi = ?, ghi_chu = ?, vi_do = ?, kinh_do = ?, mac_dinh = ?
       WHERE ma_dia_chi = ? AND ma_nguoi_dung = ?`,
      [cleanName, cleanPhone, label, cleanAddress, detail.trim(), lat, lng, shouldBeDefault, addressId, userId]
    );

    const [updatedRows] = await db.query(
      'SELECT * FROM dia_chi_nguoi_dung WHERE ma_dia_chi = ?',
      [addressId]
    );

    const storeLandmark = await getStoreConfig();
    return res.status(200).json({
      success: true,
      message: 'Cập nhật địa chỉ thành công!',
      data: formatAddressItem(updatedRows[0], storeLandmark)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật địa chỉ.',
      error: error.message
    });
  }
};

// 4. ĐẶT LÀM ĐỊA CHỈ MẶC ĐỊNH (PUT /api/address/:id/default)
// Đồng thời cập nhật vào cột dia_chi của bảng nguoi_dung
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    const [existing] = await db.query(
      'SELECT * FROM dia_chi_nguoi_dung WHERE ma_dia_chi = ? AND ma_nguoi_dung = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn!'
      });
    }

    const targetAddress = existing[0];

    // Reset toàn bộ về 0
    await db.query(
      'UPDATE dia_chi_nguoi_dung SET mac_dinh = 0 WHERE ma_nguoi_dung = ?',
      [userId]
    );

    // Đặt địa chỉ này làm mặc định
    await db.query(
      'UPDATE dia_chi_nguoi_dung SET mac_dinh = 1 WHERE ma_dia_chi = ?',
      [addressId]
    );

    // CẬP NHẬT TRỰC TIẾP VÀO CỘT dia_chi TRONG BẢNG nguoi_dung
    await db.query(
      'UPDATE nguoi_dung SET dia_chi = ? WHERE ma_nguoi_dung = ?',
      [targetAddress.dia_chi, userId]
    );

    const storeLandmark = await getStoreConfig();
    return res.status(200).json({
      success: true,
      message: 'Đã đặt địa chỉ làm mặc định!',
      data: {
        ...formatAddressItem(targetAddress, storeLandmark),
        isDefault: true
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi đặt địa chỉ mặc định.',
      error: error.message
    });
  }
};

// 5. XÓA ĐỊA CHỈ (DELETE /api/address/:id)
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;

    const [existing] = await db.query(
      'SELECT * FROM dia_chi_nguoi_dung WHERE ma_dia_chi = ? AND ma_nguoi_dung = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Địa chỉ không tồn tại hoặc không thuộc tài khoản của bạn!'
      });
    }

    const wasDefault = existing[0].mac_dinh === 1;

    await db.query(
      'DELETE FROM dia_chi_nguoi_dung WHERE ma_dia_chi = ? AND ma_nguoi_dung = ?',
      [addressId, userId]
    );

    // Nếu vừa xóa địa chỉ mặc định, tự động gán địa chỉ còn lại đầu tiên làm mặc định mới
    if (wasDefault) {
      const [remaining] = await db.query(
        'SELECT * FROM dia_chi_nguoi_dung WHERE ma_nguoi_dung = ? ORDER BY ngay_cap_nhat DESC LIMIT 1',
        [userId]
      );
      if (remaining.length > 0) {
        await db.query(
          'UPDATE dia_chi_nguoi_dung SET mac_dinh = 1 WHERE ma_dia_chi = ?',
          [remaining[0].ma_dia_chi]
        );
        // CẬP NHẬT ĐỊA CHỈ MẶC ĐỊNH MỚI VÀO BẢNG nguoi_dung
        await db.query(
          'UPDATE nguoi_dung SET dia_chi = ? WHERE ma_nguoi_dung = ?',
          [remaining[0].dia_chi, userId]
        );
      } else {
        // Hết địa chỉ -> Đặt lại dia_chi của nguoi_dung thành NULL
        await db.query(
          'UPDATE nguoi_dung SET dia_chi = NULL WHERE ma_nguoi_dung = ?',
          [userId]
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa địa chỉ thành công!'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa địa chỉ.',
      error: error.message
    });
  }
};

module.exports = {
  getAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress
};
