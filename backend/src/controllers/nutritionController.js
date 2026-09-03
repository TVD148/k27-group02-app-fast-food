const db = require('../config/db');

// 1. LẤY DANH SÁCH TOÀN BỘ NGUYÊN LIỆU & CHỈ SỐ DINH DƯỠNG
const getAllIngredients = async (req, res) => {
  try {
    const [ingredients] = await db.query(
      `SELECT ma_nguyen_lieu, ten_nguyen_lieu, don_vi_tinh, calo, protein, carbs, fat, don_gia_thay_doi, trang_thai 
       FROM nguyen_lieu 
       ORDER BY ma_nguyen_lieu ASC`
    );

    return res.status(200).json({
      success: true,
      message: 'Tải danh sách nguyên liệu và dinh dưỡng thành công',
      data: ingredients
    });
  } catch (error) {
    console.error('Lỗi getAllIngredients:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách nguyên liệu dinh dưỡng',
      error: error.message
    });
  }
};

// 2. LẤY CÔNG THỨC & DINH DƯỠNG MẶC ĐỊNH CỦA MỘT MÓN ĂN
const getItemDefaultNutrition = async (req, res) => {
  try {
    const { itemId } = req.params;

    // 2.1 Kiểm tra món ăn có tồn tại không
    const [foods] = await db.query('SELECT ma_mon_an, ten_mon, gia_ban FROM mon_an WHERE ma_mon_an = ?', [itemId]);
    if (foods.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy món ăn yêu cầu'
      });
    }
    const food = foods[0];

    // 2.2 Lấy danh sách nguyên liệu cấu thành món ăn
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

    // 2.3 Tính toán tổng dinh dưỡng mặc định của món
    let tong_calo = 0;
    let tong_protein = 0;
    let tong_carbs = 0;
    let tong_fat = 0;

    const items = recipe.map(item => {
      const qty = parseFloat(item.so_luong_mac_dinh);
      const calo = parseFloat(item.calo) * qty;
      const protein = parseFloat(item.protein) * qty;
      const carbs = parseFloat(item.carbs) * qty;
      const fat = parseFloat(item.fat) * qty;

      tong_calo += calo;
      tong_protein += protein;
      tong_carbs += carbs;
      tong_fat += fat;

      return {
        ...item,
        calo_thanh_tien: parseFloat(calo.toFixed(2)),
        protein_thanh_tien: parseFloat(protein.toFixed(2)),
        carbs_thanh_tien: parseFloat(carbs.toFixed(2)),
        fat_thanh_tien: parseFloat(fat.toFixed(2))
      };
    });

    return res.status(200).json({
      success: true,
      message: `Tải công thức dinh dưỡng cho món '${food.ten_mon}' thành công`,
      data: {
        ma_mon_an: food.ma_mon_an,
        ten_mon: food.ten_mon,
        gia_ban_goc: parseFloat(food.gia_ban),
        tong_dinh_duong_mac_dinh: {
          calo: parseFloat(tong_calo.toFixed(2)),
          protein: parseFloat(tong_protein.toFixed(2)),
          carbs: parseFloat(tong_carbs.toFixed(2)),
          fat: parseFloat(tong_fat.toFixed(2))
        },
        cong_thuc_nguyen_lieu: items
      }
    });
  } catch (error) {
    console.error('Lỗi getItemDefaultNutrition:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy công thức dinh dưỡng',
      error: error.message
    });
  }
};

// 3. TÍNH TOÁN ĐỘNG DINH DƯỠNG & GIÁ KHI KHÁCH TÙY BIẾN NGUYÊN LIỆU (KILLER FEATURE)
const calculateCustomNutrition = async (req, res) => {
  try {
    const { ma_mon_an, dieu_chinh_nguyen_lieu } = req.body;

    if (!ma_mon_an || !Array.isArray(dieu_chinh_nguyen_lieu)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ma_mon_an và mảng dieu_chinh_nguyen_lieu hợp lệ'
      });
    }

    // 3.1 Lấy thông tin món ăn
    const [foods] = await db.query('SELECT ma_mon_an, ten_mon, gia_ban FROM mon_an WHERE ma_mon_an = ?', [ma_mon_an]);
    if (foods.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy món ăn yêu cầu'
      });
    }
    const food = foods[0];
    const giaGoc = parseFloat(food.gia_ban);

    // 3.2 Lấy công thức mặc định và thông tin các nguyên liệu
    const [allIngredients] = await db.query('SELECT * FROM nguyen_lieu');
    const ingredientMap = new Map();
    allIngredients.forEach(nl => ingredientMap.set(nl.ma_nguyen_lieu, nl));

    const [defaultRecipe] = await db.query('SELECT * FROM mon_an_nguyen_lieu WHERE ma_mon_an = ?', [ma_mon_an]);
    const defaultRecipeMap = new Map();
    defaultRecipe.forEach(r => defaultRecipeMap.set(r.ma_nguyen_lieu, r));

    // 3.3 Khởi tạo map số lượng nguyên liệu thực tế sau khi khách tùy chỉnh
    const finalQuantityMap = new Map();

    // Nạp định lượng mặc định trước
    defaultRecipe.forEach(r => {
      finalQuantityMap.set(r.ma_nguyen_lieu, parseFloat(r.so_luong_mac_dinh));
    });

    // Cập nhật các tùy chỉnh từ phía khách hàng
    dieu_chinh_nguyen_lieu.forEach(item => {
      const maNL = parseInt(item.ma_nguyen_lieu);
      const qty = Math.max(0, parseFloat(item.so_luong));

      // Nếu nguyên liệu nằm trong công thức và có quy định tối đa
      const rule = defaultRecipeMap.get(maNL);
      if (rule) {
        if (rule.co_the_tuy_bien === 0 && qty !== parseFloat(rule.so_luong_mac_dinh)) {
          // Nguyên liệu cố định không được thay đổi
          return;
        }
        const maxQty = parseFloat(rule.so_luong_toi_da || 3);
        finalQuantityMap.set(maNL, Math.min(qty, maxQty));
      } else {
        // Nguyên liệu chọn thêm ngoài công thức mặc định
        finalQuantityMap.set(maNL, Math.min(qty, 3));
      }
    });

    // 3.4 Tính toán dinh dưỡng và giá phụ thu
    let tong_calo = 0;
    let tong_protein = 0;
    let tong_carbs = 0;
    let tong_fat = 0;
    let phu_thu_nguyen_lieu = 0;
    const chi_tiet_nguyen_lieu_tuy_bien = [];

    finalQuantityMap.forEach((soLuong, maNL) => {
      const nl = ingredientMap.get(maNL);
      if (!nl || soLuong <= 0) return;

      const calo = parseFloat(nl.calo) * soLuong;
      const protein = parseFloat(nl.protein) * soLuong;
      const carbs = parseFloat(nl.carbs) * soLuong;
      const fat = parseFloat(nl.fat) * soLuong;

      tong_calo += calo;
      tong_protein += protein;
      tong_carbs += carbs;
      tong_fat += fat;

      // Tính phụ thu nếu số lượng vượt quá mặc định
      const defRule = defaultRecipeMap.get(maNL);
      const defQty = defRule ? parseFloat(defRule.so_luong_mac_dinh) : 0;
      if (soLuong > defQty) {
        const extraQty = soLuong - defQty;
        phu_thu_nguyen_lieu += extraQty * parseFloat(nl.don_gia_thay_doi);
      }

      chi_tiet_nguyen_lieu_tuy_bien.push({
        ma_nguyen_lieu: nl.ma_nguyen_lieu,
        ten_nguyen_lieu: nl.ten_nguyen_lieu,
        don_vi_tinh: nl.don_vi_tinh,
        so_luong_mac_dinh: defQty,
        so_luong_tuy_chinh: soLuong,
        calo: parseFloat(calo.toFixed(2)),
        protein: parseFloat(protein.toFixed(2)),
        carbs: parseFloat(carbs.toFixed(2)),
        fat: parseFloat(fat.toFixed(2))
      });
    });

    const gia_sau_tuy_bien = giaGoc + phu_thu_nguyen_lieu;

    return res.status(200).json({
      success: true,
      message: 'Tính toán dinh dưỡng tùy biến thành công',
      data: {
        ma_mon_an: food.ma_mon_an,
        ten_mon: food.ten_mon,
        gia_ban_goc: giaGoc,
        phu_thu_nguyen_lieu: phu_thu_nguyen_lieu,
        gia_sau_tuy_bien: gia_sau_tuy_bien,
        dinh_duong_tong_hop: {
          calo: parseFloat(tong_calo.toFixed(2)),
          protein: parseFloat(tong_protein.toFixed(2)),
          carbs: parseFloat(tong_carbs.toFixed(2)),
          fat: parseFloat(tong_fat.toFixed(2))
        },
        chi_tiet_nguyen_lieu: chi_tiet_nguyen_lieu_tuy_bien
      }
    });
  } catch (error) {
    console.error('Lỗi calculateCustomNutrition:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tính toán dinh dưỡng tùy biến',
      error: error.message
    });
  }
};

module.exports = {
  getAllIngredients,
  getItemDefaultNutrition,
  calculateCustomNutrition
};
