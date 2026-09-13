import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// CẤU HÌNH ĐƯỜNG DẪN API GỐC (BACKEND)
const ACTIVE_TUNNEL_URL = 'https://note-shame-sessions-opponents.trycloudflare.com/api';

const normalizeApiUrl = (url) => {
  if (!url) return '';
  let cleaned = String(url).trim().replace(/[\r\n\t]/g, '').replace(/\/+$/, '');
  if (!cleaned.endsWith('/api')) {
    cleaned = `${cleaned}/api`;
  }
  return cleaned;
};

const getBaseUrl = () => {
  // 1. Phát triển Web trên máy tính (localhost) kết nối trực tiếp
  if (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000/api';
  }

  // 2. Biến môi trường EXPO_PUBLIC_API_URL (loại bỏ nếu Metro bị cache link cũ đã tắt)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('enterprises-superintendent')) {
    return normalizeApiUrl(envUrl);
  }

  // 3. Tự động dùng đường hầm Cloudflare đang hoạt động
  return ACTIVE_TUNNEL_URL;
};

const BASE_URL = getBaseUrl();
console.log('📡 [API Config] Đang kết nối tới Backend tại:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor tự động đính kèm Token JWT vào Header của mọi request nếu có
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('user_token');
    if (token) {
      config.headers['Authorization'] = token; // Token lưu trữ dạng 'Bearer eyJ...'
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================================================
// I. CÁC API XÁC THỰC (AUTHENTICATION)
// ============================================================================

// Đăng ký tài khoản
export const registerUser = async (ho_ten, email, mat_khau, so_dien_thoai, dia_chi) => {
  try {
    const response = await api.post('/auth/register', {
      ho_ten,
      email: email || undefined,
      mat_khau,
      so_dien_thoai: so_dien_thoai || undefined,
      dia_chi: dia_chi || undefined,
    });
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Lỗi kết nối mạng!';
    throw new Error(errorMsg);
  }
};

// Đăng nhập tài khoản
export const loginUser = async (email_or_phone, mat_khau) => {
  try {
    const response = await api.post('/auth/login', {
      email_or_phone,
      mat_khau,
    });
    
    // Lưu token và thông tin user vào AsyncStorage
    if (response.data.success && response.data.data.token) {
      await AsyncStorage.setItem('user_token', response.data.data.token);
      await AsyncStorage.setItem('user_info', JSON.stringify(response.data.data.user));
    }
    
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Lỗi kết nối mạng!';
    throw new Error(errorMsg);
  }
};

// Lấy thông tin cá nhân
export const getUserProfile = async () => {
  try {
    const response = await api.get('/auth/profile');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối mạng!');
  }
};

// Cập nhật thông tin cá nhân (Họ tên, SĐT, Email)
export const updateUserProfile = async (ho_ten, so_dien_thoai, email) => {
  try {
    const response = await api.put('/auth/profile', {
      ho_ten,
      so_dien_thoai,
      email
    });
    if (response.data && response.data.success && response.data.data) {
      await AsyncStorage.setItem('user_info', JSON.stringify(response.data.data));
    }
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Lỗi cập nhật hồ sơ!';
    throw new Error(errorMsg);
  }
};

// Đăng xuất (Xóa thông tin lưu trữ trên máy)
export const logoutUser = async () => {
  await AsyncStorage.removeItem('user_token');
  await AsyncStorage.removeItem('user_info');
  await AsyncStorage.removeItem('default_address');
};

// ============================================================================
// I.b. CÁC API SỔ ĐỊA CHỈ (ADDRESS BOOK TRONG DATABASE)
// ============================================================================

// Lấy danh sách địa chỉ từ database
export const fetchUserAddresses = async () => {
  try {
    const response = await api.get('/address');
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Lỗi lấy sổ địa chỉ!';
    throw new Error(errorMsg);
  }
};

// Thêm địa chỉ mới vào database
export const addUserAddress = async (addressData) => {
  try {
    const response = await api.post('/address', addressData);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Lỗi thêm địa chỉ!';
    throw new Error(errorMsg);
  }
};

// Cập nhật địa chỉ trong database
export const updateUserAddress = async (id, addressData) => {
  try {
    const response = await api.put(`/address/${id}`, addressData);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Lỗi cập nhật địa chỉ!';
    throw new Error(errorMsg);
  }
};

// Đặt làm địa chỉ mặc định trong database
export const setDefaultUserAddress = async (id) => {
  try {
    const response = await api.put(`/address/${id}/default`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Lỗi chọn địa chỉ mặc định!';
    throw new Error(errorMsg);
  }
};

// Xóa địa chỉ khỏi database
export const deleteUserAddress = async (id) => {
  try {
    const response = await api.delete(`/address/${id}`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Lỗi xóa địa chỉ!';
    throw new Error(errorMsg);
  }
};

// ============================================================================
// II. CÁC API THỰC ĐƠN (MENU)
// ============================================================================

// Lấy danh sách danh mục
export const fetchCategories = async () => {
  try {
    const response = await api.get('/menu/categories');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối mạng!');
  }
};

// Lấy danh sách món ăn (hỗ trợ lọc theo category_id và tìm kiếm)
export const fetchItems = async (categoryId = '', search = '') => {
  try {
    let url = `/menu/items?limit=20`;
    if (categoryId) url += `&category_id=${categoryId}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối mạng!');
  }
};

// Lấy toàn bộ danh sách món ăn (dành cho Bếp và Admin)
export const fetchMenuItems = async () => {
  try {
    const response = await api.get('/menu/items?limit=100');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi tải danh mục món ăn!');
  }
};

// Lấy chi tiết món ăn (kèm size/topping)
export const fetchItemDetail = async (itemId) => {
  try {
    const response = await api.get(`/menu/items/${itemId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối mạng!');
  }
};

// ============================================================================
// III. CÁC API GIỎ HÀNG (CART API - SPRINT 2)
// ============================================================================

// Lấy thông tin chi tiết giỏ hàng
export const fetchCart = async () => {
  try {
    const response = await api.get('/cart');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// Thêm món vào giỏ hàng (hỗ trợ tùy biến dinh dưỡng)
export const addToCart = async (ma_mon_an, so_luong = 1, tuy_chon_da_chon = [], dinh_duong_tuy_bien = null) => {
  try {
    const payload = {
      ma_mon_an,
      so_luong,
      tuy_chon_da_chon
    };
    if (dinh_duong_tuy_bien) {
      payload.dinh_duong_tuy_bien = dinh_duong_tuy_bien;
    }
    const response = await api.post('/cart/add', payload);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// Cập nhật số lượng hoặc tùy biến dinh dưỡng món trong giỏ hàng
export const updateCartItem = async (ma_chi_tiet_gio, so_luong, dinh_duong_tuy_bien = null) => {
  try {
    const payload = {};
    if (so_luong !== undefined && so_luong !== null) payload.so_luong = so_luong;
    if (dinh_duong_tuy_bien) payload.dinh_duong_tuy_bien = dinh_duong_tuy_bien;
    const response = await api.put(`/cart/update/${ma_chi_tiet_gio}`, payload);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// Xóa 1 món khỏi giỏ hàng
export const removeCartItem = async (ma_chi_tiet_gio) => {
  try {
    const response = await api.delete(`/cart/remove/${ma_chi_tiet_gio}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// Làm sạch giỏ hàng
export const clearCart = async () => {
  try {
    const response = await api.delete('/cart/clear');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// ============================================================================
// IV. CÁC API ĐƠN HÀNG & TIẾN TRÌNH (ORDER & TRACKING API - SPRINT 2)
// ============================================================================

// Khởi tạo đơn hàng mới (Checkout, hỗ trợ Voucher ma_code & Tọa độ giao hàng)
export const createOrder = async (dia_chi_giao_hang, so_dien_thoai_nhan, ghi_chu, phuong_thuc_thanh_toan, ma_code = null, coords = null) => {
  try {
    const payload = {
      dia_chi_giao_hang,
      so_dien_thoai_nhan,
      ghi_chu,
      phuong_thuc_thanh_toan,
      ma_code: ma_code || undefined
    };
    if (coords && coords.lat && coords.lng) {
      payload.vi_do = coords.lat;
      payload.kinh_do = coords.lng;
    }
    const response = await api.post('/orders', payload);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// Lấy danh sách đơn hàng (hỗ trợ lọc theo trạng thái và ngày đặt)
export const fetchOrders = async (status = '', date = '') => {
  try {
    let url = '/orders';
    const queryParts = [];
    if (status) queryParts.push(`status=${encodeURIComponent(status)}`);
    if (date) queryParts.push(`date=${encodeURIComponent(date)}`);
    if (queryParts.length > 0) url += `?${queryParts.join('&')}`;
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// Lấy chi tiết đơn hàng & tiến trình timeline
export const fetchOrderDetail = async (orderId) => {
  try {
    const response = await api.get(`/orders/${orderId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// Cập nhật trạng thái đơn hàng (Hủy đơn hoặc chuyển tiến trình)
export const updateOrderStatus = async (orderId, trang_thai_moi, ghi_chu = '') => {
  try {
    const response = await api.put(`/orders/${orderId}/status`, {
      trang_thai_moi,
      ghi_chu
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// ============================================================================
// V. CÁC API SPRINT 3: DINH DƯỠNG (KILLER FEATURE), VOUCHER & VIETQR PAYMENT
// ============================================================================

// 1. Lấy danh sách toàn bộ nguyên liệu & chỉ số dinh dưỡng
export const fetchIngredients = async () => {
  try {
    const response = await api.get('/nutrition/ingredients');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể lấy danh sách nguyên liệu!');
  }
};

// 2. Lấy công thức & dinh dưỡng mặc định của món ăn
export const fetchItemNutrition = async (itemId) => {
  try {
    const response = await api.get(`/nutrition/item/${itemId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể lấy dinh dưỡng mặc định của món!');
  }
};

// 3. Tính toán động Calo, Protein, Carbs, Fat khi tùy biến món ăn (Killer Feature)
export const calculateNutrition = async (ma_mon_an, dieu_chinh_nguyen_lieu) => {
  try {
    const response = await api.post('/nutrition/calculate', {
      ma_mon_an,
      dieu_chinh_nguyen_lieu
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể tính toán dinh dưỡng tùy biến!');
  }
};

// 4. Lấy danh sách mã giảm giá đang hoạt động
export const fetchVouchers = async () => {
  try {
    const response = await api.get('/vouchers');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể lấy danh sách mã giảm giá!');
  }
};

// 5. Áp dụng mã giảm giá và tính toán số tiền giảm
export const applyVoucher = async (ma_code, tong_tien_hang, phi_giao_hang = 0) => {
  try {
    const response = await api.post('/vouchers/apply', {
      ma_code,
      tong_tien_hang,
      phi_giao_hang
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể áp dụng mã giảm giá!');
  }
};

// 6. Sinh mã VietQR chuyển khoản động
export const generateVietQR = async (ma_don_hang) => {
  try {
    const response = await api.post('/payments/vietqr/generate', {
      ma_don_hang
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể sinh mã VietQR!');
  }
};

// 7. Xác nhận giao dịch thanh toán thành công
export const confirmPayment = async (ma_don_hang, ma_giao_dich_cong = '', phuong_thuc = 'vietqr') => {
  try {
    const response = await api.post('/payments/confirm', {
      ma_don_hang,
      ma_giao_dich_cong,
      phuong_thuc
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể xác nhận thanh toán!');
  }
};

// 8. Lấy thông tin nhật ký thanh toán của đơn hàng
export const fetchPaymentDetail = async (orderId) => {
  try {
    const response = await api.get(`/payments/order/${orderId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể lấy nhật ký thanh toán!');
  }
};

// ============================================================================
// VI. CÁC API VẬN HÀNH CHO SHIPPER & BẾP (KITCHEN & DELIVERY)
// ============================================================================

// Shipper nhận đơn giao kèm tọa độ GPS
export const acceptOrderDelivery = async (orderId, coords = null) => {
  try {
    const payload = {};
    if (coords && coords.lat && coords.lng) {
      payload.vi_do = coords.lat;
      payload.kinh_do = coords.lng;
    }
    const response = await api.put(`/orders/${orderId}/accept-delivery`, payload);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể nhận đơn giao!');
  }
};

// Lấy thông tin địa chỉ mốc của quán & bán kính phục vụ
export const fetchStoreLandmark = async () => {
  try {
    const response = await api.get('/store/landmark');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể tải thông tin mốc quán!');
  }
};

// Cập nhật cấu hình địa chỉ mốc quán dành cho Admin
export const updateAdminStoreLandmark = async (landmarkData) => {
  try {
    const response = await api.put('/admin/store-landmark', landmarkData);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể cập nhật mốc quán!');
  }
};

// Lấy thống kê giao hàng của Shipper
export const fetchShipperStats = async () => {
  try {
    const response = await api.get('/orders/shipper/stats');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể lấy thống kê giao hàng!');
  }
};

// Bật/tắt trạng thái Còn hàng / Hết hàng của món ăn
export const toggleItemStatus = async (itemId) => {
  try {
    const response = await api.put(`/admin/items/${itemId}/toggle-status`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể đổi trạng thái món ăn!');
  }
};

// ============================================================================
// VII. CÁC API QUẢN TRỊ VIÊN (ADMIN DASHBOARD & CRUD)
// ============================================================================

// Lấy thống kê tổng quan doanh thu & đơn hàng
export const fetchDashboardStats = async () => {
  try {
    const response = await api.get('/admin/dashboard-stats');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể lấy thống kê quản trị!');
  }
};

// Lấy danh sách nhân sự thực sự trực tuyến (không dùng dữ liệu giả)
export const fetchOnlinePersonnel = async () => {
  try {
    const response = await api.get('/admin/online-personnel');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể tải danh sách nhân sự trực tuyến!');
  }
};

// CRUD Món ăn
export const createFoodItem = async (foodData) => {
  try {
    const response = await api.post('/admin/items', foodData);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể thêm món ăn mới!');
  }
};

export const updateFoodItem = async (itemId, foodData) => {
  try {
    const response = await api.put(`/admin/items/${itemId}`, foodData);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể cập nhật món ăn!');
  }
};

export const deleteFoodItem = async (itemId) => {
  try {
    const response = await api.delete(`/admin/items/${itemId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể xóa món ăn!');
  }
};

// Quản lý Voucher
export const fetchAdminVouchers = async () => {
  try {
    const response = await api.get('/admin/vouchers');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể tải danh sách voucher!');
  }
};

export const createAdminVoucher = async (voucherData) => {
  try {
    const response = await api.post('/admin/vouchers', voucherData);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể tạo mã voucher mới!');
  }
};

export const deleteAdminVoucher = async (voucherId) => {
  try {
    const response = await api.delete(`/admin/vouchers/${voucherId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể xóa voucher!');
  }
};

export const toggleAdminVoucher = async (voucherId) => {
  try {
    const response = await api.put(`/admin/vouchers/${voucherId}/toggle`);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể đổi trạng thái voucher!');
  }
};

// Quản lý Tài khoản người dùng & Nhân sự
export const fetchAdminUsers = async () => {
  try {
    const response = await api.get('/admin/users');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể tải danh sách người dùng!');
  }
};

export const createAdminUser = async (userData) => {
  try {
    const response = await api.post('/admin/users', userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể tạo tài khoản mới!');
  }
};

export const updateAdminUserRole = async (userId, ma_vai_tro) => {
  try {
    const response = await api.put(`/admin/users/${userId}/role`, { ma_vai_tro });
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể cập nhật quyền tài khoản!');
  }
};

// Danh sách nguyên liệu dinh dưỡng
export const fetchAdminIngredients = async () => {
  try {
    const response = await api.get('/admin/ingredients');
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Không thể tải danh sách nguyên liệu!');
  }
};

export default api;
