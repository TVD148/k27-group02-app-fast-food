const db = require('../config/db');

// 1. LẤY TOÀN BỘ DANH MỤC (GET /api/menu/categories)
const getCategories = async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM danh_muc ORDER BY ma_danh_muc ASC');
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách danh mục thành công!',
      data: categories
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy danh mục.',
      error: error.message
    });
  }
};

// 2. LẤY DANH SÁCH MÓN ĂN - PHÂN TRANG, LỌC & TÌM KIẾM (GET /api/menu/items)
const getItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const categoryId = req.query.category_id;
    const search = req.query.search;

    let query = 'SELECT m.*, d.ten_danh_muc FROM mon_an m LEFT JOIN danh_muc d ON m.ma_danh_muc = d.ma_danh_muc WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM mon_an m WHERE 1=1';
    const params = [];
    const countParams = [];

    // Lọc theo Danh mục
    if (categoryId) {
      query += ' AND m.ma_danh_muc = ?';
      countQuery += ' AND m.ma_danh_muc = ?';
      params.push(categoryId);
      countParams.push(categoryId);
    }

    // Tìm kiếm theo tên món ăn
    if (search) {
      query += ' AND m.ten_mon LIKE ?';
      countQuery += ' AND m.ten_mon LIKE ?';
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    // Sắp xếp và giới hạn phân trang
    query += ' ORDER BY m.ma_mon_an DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Thực thi các câu lệnh truy vấn song song
    const [[items], [[{ total }]]] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams)
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách món ăn thành công!',
      pagination: {
        page,
        limit,
        total_items: total,
        total_pages: totalPages
      },
      data: items
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy danh sách món ăn.',
      error: error.message
    });
  }
};

// 3. LẤY CHI TIẾT MÓN ĂN KÈM TÙY CHỌN SIZE/TOPPING (GET /api/menu/items/:id)
const getItemDetail = async (req, res) => {
  try {
    const itemId = req.params.id;

    // 1. Truy vấn thông tin món ăn cơ bản
    const [items] = await db.query(
      'SELECT m.*, d.ten_danh_muc FROM mon_an m LEFT JOIN danh_muc d ON m.ma_danh_muc = d.ma_danh_muc WHERE m.ma_mon_an = ?',
      [itemId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Món ăn không tồn tại!'
      });
    }

    const item = items[0];

    // 2. Truy vấn các nhóm tùy chọn và giá trị đi kèm của món ăn này
    const [options] = await db.query(`
      SELECT 
        ntc.ma_nhom, 
        ntc.ten_nhom, 
        ntc.la_bat_buoc, 
        ntc.chon_toi_da,
        gt.ma_gia_tri,
        gt.ten_gia_tri,
        gt.gia_tang_them
      FROM tuy_chon_mon_an tcma
      JOIN nhom_tuy_chon ntc ON tcma.ma_nhom = ntc.ma_nhom
      LEFT JOIN gia_tri_tuy_chon gt ON ntc.ma_nhom = gt.ma_nhom
      WHERE tcma.ma_mon_an = ?
    `, [itemId]);

    // 3. Định dạng lại cấu trúc dữ liệu tùy chọn (gộp các giá trị vào đúng nhóm của nó)
    const optionGroupsMap = {};
    options.forEach(row => {
      if (!optionGroupsMap[row.ma_nhom]) {
        optionGroupsMap[row.ma_nhom] = {
          ma_nhom: row.ma_nhom,
          ten_nhom: row.ten_nhom,
          la_bat_buoc: row.la_bat_buoc === 1,
          chon_toi_da: row.chon_toi_da,
          values: []
        };
      }
      
      // Nếu có giá trị tùy chọn (không null), đẩy vào danh sách của nhóm đó
      if (row.ma_gia_tri) {
        optionGroupsMap[row.ma_nhom].values.push({
          ma_gia_tri: row.ma_gia_tri,
          ten_gia_tri: row.ten_gia_tri,
          gia_tang_them: parseFloat(row.gia_tang_them)
        });
      }
    });

    // Chuyển đối tượng map thành mảng
    const item_options = Object.values(optionGroupsMap);

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin chi tiết món ăn thành công!',
      data: {
        ...item,
        gia_ban: parseFloat(item.gia_ban),
        item_options
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy chi tiết món ăn.',
      error: error.message
    });
  }
};

module.exports = {
  getCategories,
  getItems,
  getItemDetail
};
