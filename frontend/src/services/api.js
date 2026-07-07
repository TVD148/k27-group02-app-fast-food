import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// CẤU HÌNH ĐƯỜNG DẪN API GỐC (BACKEND)
// Lưu ý:
// - Dùng 'http://localhost:5000' nếu chạy giả lập iOS.
// - Dùng 'http://10.0.2.2:5000' nếu chạy giả lập Android (Android emulator kết nối máy chủ localhost qua IP này).
// - Dùng IP mạng LAN của máy tính bạn (ví dụ: 'http://192.168.1.5:5000') nếu chạy Expo Go trên điện thoại thật.
// Có thể ghi đè bằng biến môi trường EXPO_PUBLIC_API_URL khi chạy expo.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.190.83:5000/api';

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

export default api;
