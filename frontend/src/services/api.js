import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// CẤU HÌNH ĐƯỜNG DẪN API GỐC (BACKEND)
// Tự động nhận diện IP máy tính đang phát Expo Metro Bundler để bạn đổi mạng Wi-Fi không cần sửa lại code!
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':').shift();
    if (ip) {
      return `http://${ip}:5000/api`;
    }
  }

  return 'http://192.168.1.5:5000/api';
};

const BASE_URL = getBaseUrl();

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
    throw error.response?.data || new Error('Lỗi kết nối mạng!');
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
    throw error.response?.data || new Error('Lỗi kết nối mạng!');
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

// Đăng xuất (Xóa thông tin lưu trữ trên máy)
export const logoutUser = async () => {
  await AsyncStorage.removeItem('user_token');
  await AsyncStorage.removeItem('user_info');
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

// Thêm món vào giỏ hàng
export const addToCart = async (ma_mon_an, so_luong = 1, tuy_chon_da_chon = []) => {
  try {
    const response = await api.post('/cart/add', {
      ma_mon_an,
      so_luong,
      tuy_chon_da_chon
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// Cập nhật số lượng món trong giỏ hàng
export const updateCartItem = async (ma_chi_tiet_gio, so_luong) => {
  try {
    const response = await api.put(`/cart/update/${ma_chi_tiet_gio}`, { so_luong });
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

// Khởi tạo đơn hàng mới (Checkout, hỗ trợ Voucher ma_code)
export const createOrder = async (dia_chi_giao_hang, so_dien_thoai_nhan, ghi_chu, phuong_thuc_thanh_toan, ma_code = null) => {
  try {
    const response = await api.post('/orders', {
      dia_chi_giao_hang,
      so_dien_thoai_nhan,
      ghi_chu,
      phuong_thuc_thanh_toan,
      ma_code: ma_code || undefined
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || new Error('Lỗi kết nối máy chủ!');
  }
};

// Lấy danh sách đơn hàng
export const fetchOrders = async (status = '') => {
  try {
    let url = '/orders';
    if (status) url += `?status=${status}`;
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
export const applyVoucher = async (ma_code, tong_tien_hang) => {
  try {
    const response = await api.post('/vouchers/apply', {
      ma_code,
      tong_tien_hang
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

export default api;
