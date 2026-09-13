import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
  Switch,
  Modal,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  fetchDashboardStats,
  fetchOnlinePersonnel,
  fetchMenuItems,
  createFoodItem,
  deleteFoodItem,
  toggleItemStatus,
  fetchOrders,
  updateOrderStatus,
  fetchAdminVouchers,
  createAdminVoucher,
  deleteAdminVoucher,
  toggleAdminVoucher,
  fetchAdminUsers,
  createAdminUser,
  updateAdminUserRole,
  fetchStoreLandmark,
  updateAdminStoreLandmark,
  updateUserProfile,
  logoutUser
} from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// COMPONENT: BIỂU ĐỒ ĐƯỜNG (LINE CHART) DOANH THU THUẦN REACT NATIVE
// ============================================================================
function RevenueLineChart({ hourlyData = [] }) {
  const [selectedPoint, setSelectedPoint] = useState(null);

  const defaultZeroHours = [
    { hour: '08:00', amount: 0 },
    { hour: '10:00', amount: 0 },
    { hour: '12:00', amount: 0 },
    { hour: '14:00', amount: 0 },
    { hour: '16:00', amount: 0 },
    { hour: '18:00', amount: 0 },
    { hour: '20:00', amount: 0 },
    { hour: '22:00', amount: 0 },
  ];

  const data = (hourlyData && hourlyData.length > 0) ? hourlyData : defaultZeroHours;
  const maxAmount = Math.max(...data.map(d => d.amount), 100000);
  const chartHeight = 160;

  return (
    <View style={styles.chartWrapper}>
      <View style={styles.chartHeaderRow}>
        <Text style={styles.chartTitle}>📈 Biểu Đồ Doanh Thu Theo Giờ Trong Ngày</Text>
        {selectedPoint ? (
          <View style={styles.tooltipBadge}>
            <Text style={styles.tooltipText}>
              {selectedPoint.hour}: {selectedPoint.amount.toLocaleString('vi-VN')} đ
            </Text>
          </View>
        ) : (
          <Text style={styles.chartHint}>Chạm vào điểm để xem</Text>
        )}
      </View>

      <View style={[styles.chartBody, { height: chartHeight }]}>
        {/* Đường lưới ngang (Grid lines) */}
        <View style={[styles.gridLine, { top: 0 }]} />
        <View style={[styles.gridLine, { top: chartHeight * 0.33 }]} />
        <View style={[styles.gridLine, { top: chartHeight * 0.66 }]} />
        <View style={[styles.gridLine, { bottom: 0 }]} />

        {/* Các cột mốc điểm dữ liệu kết nối */}
        <View style={styles.pointsRow}>
          {data.map((item, index) => {
            const pointHeight = Math.max(12, (item.amount / maxAmount) * (chartHeight - 30));
            const isSelected = selectedPoint?.hour === item.hour;

            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.7}
                onPress={() => setSelectedPoint(item)}
                style={styles.pointCol}
              >
                <View style={styles.verticalTrack}>
                  <View style={[styles.verticalFillBar, { height: pointHeight }]} />
                  <View
                    style={[
                      styles.chartDot,
                      { bottom: pointHeight - 6 },
                      isSelected && styles.chartDotSelected,
                    ]}
                  />
                </View>
                <Text style={[styles.hourLabel, isSelected && styles.hourLabelSelected]}>
                  {item.hour.split(':')[0]}h
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function AdminScreen({ navigation }) {
  // 4 Bottom Tabs chuẩn: 'dashboard' (Tổng quan), 'orders' (Đơn hàng), 'menu' (Thực đơn), 'settings' (Cài đặt)
  const [activeBottomTab, setActiveBottomTab] = useState('dashboard');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [stats, setStats] = useState(null);
  const [foods, setFoods] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    ho_ten: '',
    so_dien_thoai: '',
    email: ''
  });

  const handleOpenEditProfile = () => {
    setProfileForm({
      ho_ten: currentUser?.ho_ten || '',
      so_dien_thoai: currentUser?.so_dien_thoai || '',
      email: currentUser?.email || ''
    });
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.ho_ten.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ và tên');
      return;
    }
    if (!profileForm.so_dien_thoai.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await updateUserProfile(
        profileForm.ho_ten.trim(),
        profileForm.so_dien_thoai.trim(),
        profileForm.email.trim()
      );
      if (res && res.success) {
        Alert.alert('Thành công', 'Thông tin quản trị viên đã được cập nhật thành công!');
        const updated = {
          ...currentUser,
          ho_ten: profileForm.ho_ten.trim(),
          so_dien_thoai: profileForm.so_dien_thoai.trim(),
          email: profileForm.email.trim()
        };
        setCurrentUser(updated);
        await AsyncStorage.setItem('user_info', JSON.stringify(updated));
        setShowEditProfileModal(false);
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể cập nhật thông tin');
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Có lỗi xảy ra khi cập nhật thông tin');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Đăng Xuất Admin',
      'Bạn có chắc chắn muốn đăng xuất khỏi trang Quản trị viên?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng Xuất',
          style: 'destructive',
          onPress: async () => {
            setShowEditProfileModal(false);
            try {
              await logoutUser();
            } catch (e) {
              console.log('Lỗi đăng xuất:', e.message);
            }
            await AsyncStorage.multiRemove(['user_token', 'user_info', 'user_role']);
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  const [onlinePersonnel, setOnlinePersonnel] = useState({
    online_staff_count: 0,
    online_shipper_count: 0,
    online_staff: [],
    online_shippers: [],
    all_online: []
  });

  // Mốc quán & Bán kính phục vụ (Cột mốc 3km)
  const [storeLandmark, setStoreLandmark] = useState({
    ten_quan: 'Cửa hàng FastFood BDU',
    dia_chi_quan: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
    vi_do: '10.980500',
    kinh_do: '106.674500',
    ban_kinh_phuc_vu_km: '3.0',
    gia_ship_moi_km: '5000'
  });
  const [savingLandmark, setSavingLandmark] = useState(false);
  const [locatingGPS, setLocatingGPS] = useState(false);

  // States Tab Quản lý tài khoản & Phân quyền
  const [userSearchText, setUserSearchText] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all'); // 'all' | '1' | '2' | '4' | '3'
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [selectedNewRole, setSelectedNewRole] = useState(1);

  // States Tab Menu: Search có nút Clear + Filter Chips + Toggles
  const [menuSearchText, setMenuSearchText] = useState('');
  const [menuFilterCategory, setMenuFilterCategory] = useState('all'); // 'all' | 'out_of_stock' | 'burgers' | 'chicken' | 'drinks'

  // States Tab Orders: Search Order ID + Trạng thái lỗi không tìm thấy
  const [orderSearchId, setOrderSearchId] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  // Modal forms
  const [modalType, setModalType] = useState(null); // 'addFood' | 'addVoucher' | 'addUser' | 'changeRole'
  const [submitting, setSubmitting] = useState(false);

  // Form add food
  const [foodForm, setFoodForm] = useState({ ten_mon: '', mo_ta: '', gia_ban: '', ma_danh_muc: '1' });
  // Form add voucher
  const [voucherForm, setVoucherForm] = useState({ 
    ma_code: '', 
    ten_voucher: '', 
    mo_ta: '',
    loai_ap_dung: 'don_hang', // 'don_hang' | 'phi_ship'
    loai_giam_gia: 'so_tien', // 'so_tien' | 'phan_tram'
    gia_tri_giam: '', 
    giam_toi_da: '', 
    don_hang_toi_thieu: '',
    so_luong_phat_hanh: '100',
    so_ngay_hieu_luc: '30'
  });
  // Form add user
  const [userForm, setUserForm] = useState({ ho_ten: '', so_dien_thoai: '', email: '', mat_khau: '123456', ma_vai_tro: '2' });

  useEffect(() => {
    loadAllAdminData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadAllAdminData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const storedUser = await AsyncStorage.getItem('user_info');
      if (storedUser) setCurrentUser(JSON.parse(storedUser));

      const [statsRes, foodsRes, ordersRes, vouchersRes, usersRes, landmarkRes, onlineRes] = await Promise.all([
        fetchDashboardStats().catch(() => null),
        fetchMenuItems().catch(() => null),
        fetchOrders().catch(() => null),
        fetchAdminVouchers().catch(() => null),
        fetchAdminUsers().catch(() => null),
        fetchStoreLandmark().catch(() => null),
        fetchOnlinePersonnel().catch(() => null)
      ]);

      if (statsRes && statsRes.success) setStats(statsRes.data);
      if (foodsRes && foodsRes.success) setFoods(foodsRes.data || []);
      if (ordersRes && ordersRes.success) setOrders(ordersRes.data || []);
      if (vouchersRes && vouchersRes.success) setVouchers(vouchersRes.data || []);
      if (usersRes && usersRes.success) setUsers(usersRes.data || []);
      if (onlineRes && onlineRes.success && onlineRes.data) {
        setOnlinePersonnel(onlineRes.data);
      }
      if (landmarkRes && landmarkRes.success && landmarkRes.data) {
        setStoreLandmark({
          ten_quan: landmarkRes.data.ten_quan || 'Cửa hàng FastFood BDU',
          dia_chi_quan: landmarkRes.data.dia_chi_quan || '',
          vi_do: String(landmarkRes.data.vi_do || '10.9805'),
          kinh_do: String(landmarkRes.data.kinh_do || '106.6745'),
          ban_kinh_phuc_vu_km: String(landmarkRes.data.ban_kinh_phuc_vu_km || '3.0'),
          gia_ship_moi_km: String(landmarkRes.data.gia_ship_moi_km || '5000')
        });
      }
    } catch (err) {
      console.log('Lỗi tải dữ liệu Admin:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSaveStoreLandmark = async () => {
    if (!storeLandmark.dia_chi_quan.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ mốc của quán!');
      return;
    }
    setSavingLandmark(true);
    try {
      const res = await updateAdminStoreLandmark(storeLandmark);
      if (res.success) {
        Alert.alert('Thành công 🎉', 'Đã lưu mốc quán, tọa độ GPS và phạm vi giao hàng 3km!');
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu mốc quán!');
    } finally {
      setSavingLandmark(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllAdminData();
  };

  // Bật GPS để lấy chính xác tọa độ và địa chỉ quán
  const handleGetStoreGPSLocation = async () => {
    setLocatingGPS(true);
    try {
      let lat = null;
      let lng = null;

      // 1. Kiểm tra trên Mobile bằng expo-location
      if (Location && Location.requestForegroundPermissionsAsync) {
        if (Location.hasServicesEnabledAsync) {
          const enabled = await Location.hasServicesEnabledAsync();
          if (!enabled) {
            Alert.alert('Chưa bật GPS 📡', 'Vui lòng bật tính năng định vị vị trí (GPS) trên thiết bị để lấy tọa độ quán!');
            setLocatingGPS(false);
            return;
          }
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Chưa cấp quyền vị trí', 'Vui lòng cấp quyền truy cập vị trí để lấy tọa độ quán chính xác.');
          setLocatingGPS(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
        // 2. Web fallback
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      if (!lat || !lng) {
        Alert.alert('Lỗi định vị', 'Không thể lấy được tọa độ GPS từ thiết bị.');
        setLocatingGPS(false);
        return;
      }

      // Reverse geocoding để lấy địa chỉ quán chuẩn tiếng Việt
      let resolvedAddress = '';
      try {
        const bdcRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`
        );
        if (bdcRes.ok) {
          const bdcData = await bdcRes.json();
          const admin = bdcData.localityInfo?.administrative || [];
          const info = bdcData.localityInfo?.informative || [];

          let district = '';
          const districtObj = [...info, ...admin].find(i => {
            if (!i.name) return false;
            const n = i.name.toLowerCase();
            return (
              n.includes('quận') || n.includes('huyện') || n.includes('thị xã') ||
              n.includes('thủ đức') || n.includes('thủ dầu một') || n.includes('thu dau mot') ||
              n.includes('dĩ an') || n.includes('di an') || n.includes('thuận an') || n.includes('thuan an') ||
              n.includes('bến cát') || n.includes('tân uyên') ||
              (i.description && (i.description.includes('quận') || i.description.includes('huyện') || i.description.includes('thị xã') || i.description.includes('thành phố')))
            );
          });
          if (districtObj) {
            district = districtObj.name;
            const dLower = district.toLowerCase();
            if (dLower === 'thu dau mot') district = 'TP. Thủ Dầu Một';
            else if (dLower === 'di an') district = 'TP. Dĩ An';
            else if (dLower === 'thuan an') district = 'TP. Thuận An';
            else if (dLower === 'ben cat') district = 'TX. Bến Cát';
            else if (dLower === 'tan uyen') district = 'TX. Tân Uyên';
          }

          let province = '';
          const provObj = [...admin].find(i => {
            if (!i.name) return false;
            const n = i.name.toLowerCase();
            return n.includes('tỉnh') || n.includes('thành phố') || n.includes('bình dương') || n.includes('hồ chí minh') || n.includes('hà nội');
          });
          if (provObj) province = provObj.name;

          let ward = '';
          const wardObj = [...admin, ...info].find(i => {
            if (!i.name) return false;
            const n = i.name.toLowerCase();
            return n.includes('phường') || n.includes('xã') || n.includes('thị trấn');
          });
          if (wardObj) ward = wardObj.name;
          else if (bdcData.locality) {
            ward = bdcData.locality;
            if (!ward.toLowerCase().startsWith('phường') && !ward.toLowerCase().startsWith('xã')) {
              ward = 'Phường ' + ward;
            }
          }

          const parts = [];
          if (ward && !parts.includes(ward)) parts.push(ward);
          if (district && district !== ward && district !== province && !parts.includes(district)) parts.push(district);
          if (province) {
            const pStr = (province.includes('Tỉnh') || province.includes('Thành phố') || province.includes('TP.')) 
              ? province 
              : (province === 'Hồ Chí Minh' ? 'TP. Hồ Chí Minh' : 'Tỉnh ' + province);
            if (!parts.includes(pStr)) parts.push(pStr);
          }
          if (parts.length > 0) {
            resolvedAddress = parts.join(', ');
          }
        }
      } catch (err) {
        console.log('Lỗi geocode:', err);
      }

      const newAddress = resolvedAddress || `Tọa độ GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      setStoreLandmark(prev => ({
        ...prev,
        dia_chi_quan: newAddress,
        vi_do: lat.toFixed(6),
        kinh_do: lng.toFixed(6)
      }));

      Alert.alert(
        'Định vị GPS thành công! 📡',
        `Tọa độ: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nĐịa chỉ: ${newAddress}\n\nVui lòng bấm "💾 Lưu Địa Chỉ & Mốc Quán" để xác nhận lưu vào hệ thống.`
      );
    } catch (err) {
      Alert.alert('Lỗi bật GPS', err.message || 'Không thể lấy tọa độ vị trí hiện tại.');
    } finally {
      setLocatingGPS(false);
    }
  };

  // Mở modal phân quyền người dùng
  const handleOpenRoleModal = (user) => {
    if (user.ma_vai_tro === 3) {
      Alert.alert('Bảo mật hệ thống 🔒', 'Tài khoản Quản trị viên (Admin) không thể thay đổi vai trò!');
      return;
    }
    setRoleModalUser(user);
    setSelectedNewRole(user.ma_vai_tro || 1);
    setModalType('changeRole');
  };

  // Xác nhận đổi quyền tài khoản (Chặn tuyệt đối quyền Quản trị viên 3)
  const handleSaveUserRole = async () => {
    if (!roleModalUser) return;
    if (selectedNewRole === 3) {
      Alert.alert('Lỗi bảo mật ❌', 'Không thể cấp quyền Quản trị viên cho tài khoản khác!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateAdminUserRole(roleModalUser.ma_nguoi_dung, selectedNewRole);
      if (res.success) {
        Alert.alert('Thành công 🎉', res.message || 'Đã cập nhật vai trò người dùng thành công!');
        setModalType(null);
        setRoleModalUser(null);
        // Cập nhật danh sách người dùng trên giao diện ngay lập tức
        setUsers(prev => prev.map(u => u.ma_nguoi_dung === roleModalUser.ma_nguoi_dung ? { ...u, ma_vai_tro: selectedNewRole } : u));
        loadAllAdminData();
      }
    } catch (err) {
      Alert.alert('Lỗi phân quyền', err.message || 'Không thể cập nhật quyền tài khoản!');
    } finally {
      setSubmitting(false);
    }
  };

  // Lọc danh sách người dùng theo tên, SĐT, email & Tab vai trò
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = userSearchText.trim().toLowerCase();
      const matchSearch = !q ||
        (u.ho_ten && u.ho_ten.toLowerCase().includes(q)) ||
        (u.so_dien_thoai && u.so_dien_thoai.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));
      if (!matchSearch) return false;

      if (userRoleFilter === '1') return u.ma_vai_tro === 1;
      if (userRoleFilter === '2') return u.ma_vai_tro === 2;
      if (userRoleFilter === '4') return u.ma_vai_tro === 4;
      if (userRoleFilter === '3') return u.ma_vai_tro === 3;
      return true;
    });
  }, [users, userSearchText, userRoleFilter]);

  // 1. Toggle Switch Bật/Tắt Hết Hàng Món Ăn
  const handleToggleFoodStock = async (foodId, currentStatus, foodName) => {
    try {
      const res = await toggleItemStatus(foodId);
      if (res.success) {
        setFoods(prev => prev.map(f => f.ma_mon_an === foodId ? { ...f, trang_thai: res.trang_thai_moi } : f));
        Alert.alert('Đã cập nhật', `${foodName}: ${res.trang_thai_moi === 'con_hang' ? 'Đã chuyển sang CÒN HÀNG ✅' : 'Đã chuyển sang HẾT HÀNG ❌'}`);
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể đổi trạng thái món!');
    }
  };

  // 2. Lọc thực đơn theo Search text + Filter Chips
  const filteredFoods = useMemo(() => {
    return foods.filter(item => {
      const matchSearch = item.ten_mon.toLowerCase().includes(menuSearchText.trim().toLowerCase());
      if (!matchSearch) return false;

      if (menuFilterCategory === 'out_of_stock') {
        return item.trang_thai !== 'con_hang';
      }
      if (menuFilterCategory === 'burgers') {
        return item.ma_danh_muc === 1 || item.ten_mon.toLowerCase().includes('burger');
      }
      if (menuFilterCategory === 'chicken') {
        return item.ma_danh_muc === 2 || item.ten_mon.toLowerCase().includes('gà');
      }
      if (menuFilterCategory === 'drinks') {
        return item.ma_danh_muc === 3 || item.ten_mon.toLowerCase().includes('pepsi') || item.ten_mon.toLowerCase().includes('trà');
      }
      return true;
    });
  }, [foods, menuSearchText, menuFilterCategory]);

  // 3. Lọc danh sách đơn hàng theo mã đơn Order ID
  const { filteredOrders, orderNotFound } = useMemo(() => {
    const trimmed = orderSearchId.trim().replace('#', '');
    let result = orders;

    if (orderStatusFilter !== 'all') {
      result = result.filter(o => o.trang_thai_don_hang === orderStatusFilter);
    }

    if (trimmed) {
      const matches = result.filter(o => String(o.ma_don_hang).includes(trimmed));
      return {
        filteredOrders: matches,
        orderNotFound: matches.length === 0
      };
    }

    return {
      filteredOrders: result,
      orderNotFound: false
    };
  }, [orders, orderSearchId, orderStatusFilter]);

  // Thêm món ăn mới
  const handleAddFood = async () => {
    if (!foodForm.ten_mon || !foodForm.gia_ban) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên món và giá bán!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createFoodItem({
        ten_mon: foodForm.ten_mon,
        mo_ta: foodForm.mo_ta,
        gia_ban: parseFloat(foodForm.gia_ban),
        ma_danh_muc: parseInt(foodForm.ma_danh_muc),
      });
      if (res.success) {
        Alert.alert('Thành công', 'Đã thêm món mới vào thực đơn!');
        setModalType(null);
        setFoodForm({ ten_mon: '', mo_ta: '', gia_ban: '', ma_danh_muc: '1' });
        loadAllAdminData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo món!');
    } finally {
      setSubmitting(false);
    }
  };

  // Thêm voucher mới
  const handleAddVoucher = async () => {
    if (!voucherForm.ma_code || !voucherForm.gia_tri_giam) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mã voucher và mức giảm!');
      return;
    }
    const val = parseFloat(voucherForm.gia_tri_giam);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Giá trị không hợp lệ', 'Mức giảm phải là số lớn hơn 0!');
      return;
    }
    if (voucherForm.loai_giam_gia === 'phan_tram' && (val <= 0 || val > 100)) {
      Alert.alert('Phần trăm không hợp lệ', 'Mức giảm phần trăm phải từ 1% đến 100%!');
      return;
    }

    setSubmitting(true);
    try {
      const days = parseInt(voucherForm.so_ngay_hieu_luc || '30');
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (isNaN(days) ? 30 : days));
      const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');

      const res = await createAdminVoucher({
        ma_code: voucherForm.ma_code.toUpperCase().trim(),
        ten_voucher: voucherForm.ten_voucher.trim(),
        mo_ta: voucherForm.mo_ta.trim(),
        loai_ap_dung: voucherForm.loai_ap_dung,
        loai_giam_gia: voucherForm.loai_giam_gia,
        gia_tri_giam: val,
        giam_toi_da: voucherForm.giam_toi_da ? parseFloat(voucherForm.giam_toi_da) : (voucherForm.loai_giam_gia === 'so_tien' ? val : 0),
        don_hang_toi_thieu: parseFloat(voucherForm.don_hang_toi_thieu || 0),
        so_luong_phat_hanh: parseInt(voucherForm.so_luong_phat_hanh || 100),
        ngay_ket_thuc: endDateStr
      });
      if (res.success) {
        Alert.alert('Thành công 🎉', res.message || 'Đã tạo mã voucher mới!');
        setModalType(null);
        setVoucherForm({ 
          ma_code: '', 
          ten_voucher: '', 
          mo_ta: '',
          loai_ap_dung: 'don_hang',
          loai_giam_gia: 'so_tien',
          gia_tri_giam: '', 
          giam_toi_da: '', 
          don_hang_toi_thieu: '',
          so_luong_phat_hanh: '100',
          so_ngay_hieu_luc: '30'
        });
        loadAllAdminData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo voucher!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVoucher = async (voucherId) => {
    try {
      const res = await toggleAdminVoucher(voucherId);
      if (res.success) {
        Alert.alert('Thành công', res.message);
        loadAllAdminData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể đổi trạng thái voucher!');
    }
  };

  const handleDeleteVoucher = (voucherId, code) => {
    Alert.alert(
      'Xác nhận xóa voucher',
      `Bạn có chắc chắn muốn xóa mã voucher '${code}' khỏi hệ thống không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteAdminVoucher(voucherId);
              if (res.success) {
                Alert.alert('Đã xóa', 'Voucher đã được xóa thành công!');
                loadAllAdminData();
              }
            } catch (err) {
              Alert.alert('Lỗi', err.message || 'Không thể xóa voucher!');
            }
          }
        }
      ]
    );
  };

  // Thêm nhân sự mới
  const handleAddUser = async () => {
    if (!userForm.ho_ten || !userForm.so_dien_thoai) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên và số điện thoại!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createAdminUser({
        ...userForm,
        ma_vai_tro: parseInt(userForm.ma_vai_tro)
      });
      if (res.success) {
        Alert.alert('Thành công', 'Đã tạo tài khoản nhân sự mới!');
        setModalType(null);
        setUserForm({ ho_ten: '', so_dien_thoai: '', email: '', mat_khau: '123456', ma_vai_tro: '2' });
        loadAllAdminData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo tài khoản!');
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // TAB 1: TỔNG QUAN (DASHBOARD) - LINE CHART & NHÂN SỰ ONLINE
  // =========================================================================
  const renderDashboardTab = () => {
    const totalRevenue = stats?.total_revenue || stats?.overview?.tong_doanh_thu || 0;
    const totalOrders = stats?.total_orders || stats?.overview?.tong_don_hang || 0;
    const onlineStaffCount = onlinePersonnel?.online_staff_count ?? stats?.online_staff_count ?? 0;
    const onlineShipperCount = onlinePersonnel?.online_shipper_count ?? stats?.online_shipper_count ?? 0;
    const allOnlineList = onlinePersonnel?.all_online || [];

    return (
      <View style={styles.tabContentBlock}>
        {/* Hàng Chỉ Số Thống Kê Nhanh */}
        <View style={styles.statsRow}>
          <View style={[styles.kpiCard, { backgroundColor: '#EDE7F6', borderColor: '#D1C4E9' }]}>
            <Text style={styles.kpiLabel}>Doanh Thu</Text>
            <Text style={[styles.kpiValue, { color: '#6A1B9A' }]}>
              {parseFloat(totalRevenue).toLocaleString('vi-VN')} đ
            </Text>
            <Text style={styles.kpiSub}>Đơn đã giao thành công</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: '#E0F2F1', borderColor: '#B2DFDB' }]}>
            <Text style={styles.kpiLabel}>Tổng Số Đơn</Text>
            <Text style={[styles.kpiValue, { color: '#00897B' }]}>{totalOrders} đơn</Text>
            <Text style={styles.kpiSub}>Trên toàn hệ thống</Text>
          </View>
        </View>

        {/* 1. BIỂU ĐỒ ĐƯỜNG DOANH THU */}
        <RevenueLineChart />

        {/* 2. HIỂN THỊ SỐ LƯỢNG SHIPPER / BẾP ĐANG ONLINE THẬT SỰ (KHÔNG DÙNG DỮ LIỆU GIẢ) */}
        <View style={styles.onlinePersonnelSection}>
          <View style={styles.onlineSectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>🟢 NHÂN SỰ TRỰC TUYẾN THỜI GIAN THỰC</Text>
            <View style={styles.liveIndicatorBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveIndicatorText}>Dữ liệu thật 100%</Text>
            </View>
          </View>

          <View style={styles.personnelCardsRow}>
            {/* Card Đầu Bếp Online */}
            <View style={styles.personnelCard}>
              <View style={styles.personnelCardTop}>
                <Text style={styles.personnelIcon}>🧑‍🍳</Text>
                <View style={[styles.pulseDot, { backgroundColor: onlineStaffCount > 0 ? '#10B981' : '#94A3B8' }]} />
              </View>
              <Text style={styles.personnelCount}>{onlineStaffCount} Bếp / Quán</Text>
              <Text style={styles.personnelDesc}>
                {onlineStaffCount > 0 ? 'Đang mở app & sẵn sàng chế biến' : 'Hiện chưa có tài khoản Bếp mở app'}
              </Text>
            </View>

            {/* Card Shipper Online */}
            <View style={styles.personnelCard}>
              <View style={styles.personnelCardTop}>
                <Text style={styles.personnelIcon}>🛵</Text>
                <View style={[styles.pulseDot, { backgroundColor: onlineShipperCount > 0 ? '#00897B' : '#94A3B8' }]} />
              </View>
              <Text style={styles.personnelCount}>{onlineShipperCount} Shipper</Text>
              <Text style={styles.personnelDesc}>
                {onlineShipperCount > 0 ? 'Đang mở app & trực tuyến nhận đơn' : 'Hiện chưa có Shipper mở app'}
              </Text>
            </View>
          </View>

          {/* DANH SÁCH CHI TIẾT NHÂN SỰ ĐANG MỞ APP THỰC TẾ */}
          <View style={styles.onlineDetailContainer}>
            <Text style={styles.onlineDetailTitle}>📋 Danh sách nhân sự đang hoạt động:</Text>
            {allOnlineList.length > 0 ? (
              allOnlineList.map(u => {
                const isStaff = u.ma_vai_tro === 2;
                const activeTimeStr = u.seconds_since_active != null
                  ? (u.seconds_since_active < 60 ? 'Vừa thao tác xong' : `${Math.floor(u.seconds_since_active / 60)} phút trước`)
                  : 'Vừa hoạt động';

                return (
                  <View key={u.ma_nguoi_dung} style={styles.onlineUserCard}>
                    <View style={styles.onlineUserLeft}>
                      <Text style={styles.onlineUserAvatar}>{isStaff ? '🧑‍🍳' : '🛵'}</Text>
                      <View>
                        <Text style={styles.onlineUserName}>{u.ho_ten}</Text>
                        <Text style={styles.onlineUserSub}>📞 {u.so_dien_thoai || 'Chưa cập nhật SĐT'}</Text>
                      </View>
                    </View>
                    <View style={styles.onlineUserRight}>
                      <View style={[styles.roleMiniBadge, isStaff ? styles.roleBadgeKitchen : styles.roleBadgeShipper]}>
                        <Text style={[styles.roleMiniBadgeText, isStaff ? styles.roleTextKitchen : styles.roleTextShipper]}>
                          {isStaff ? 'Nhân viên quán & bếp' : 'Shipper'}
                        </Text>
                      </View>
                      <View style={styles.onlineStatusRow}>
                        <View style={styles.activeDotGreen} />
                        <Text style={styles.activeTimeText}>{activeTimeStr}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.noOnlineBox}>
                <Text style={styles.noOnlineEmoji}>💤</Text>
                <Text style={styles.noOnlineText}>Chưa có nhân sự nào mở ứng dụng</Text>
                <Text style={styles.noOnlineSub}>
                  Hệ thống tự động ghi nhận nhân sự trực tuyến thật khi tài khoản Bếp hoặc Shipper mở app (không dùng dữ liệu ảo).
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Nút thao tác nhanh */}
        <View style={styles.quickActionRow}>
          <TouchableOpacity 
            style={[styles.quickActionButton, { backgroundColor: '#6A1B9A' }]}
            onPress={() => setActiveBottomTab('menu')}
          >
            <Text style={styles.quickActionBtnText}>🍔 Quản Lý Thực Đơn</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.quickActionButton, { backgroundColor: '#D84315' }]}
            onPress={() => setActiveBottomTab('orders')}
          >
            <Text style={styles.quickActionBtnText}>📋 Quản Lý Đơn Hàng</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // =========================================================================
  // TAB 2: QUẢN LÝ THỰC ĐƠN (MENU MANAGEMENT) - SEARCH + TOGGLES/SWITCHES
  // =========================================================================
  const renderMenuTab = () => {
    return (
      <View style={styles.tabContentBlock}>
        {/* THANH TÌM KIẾM CHUẨN CÓ NÚT CLEAR TEXT ('✕') */}
        <View style={styles.searchBarContainer}>
          <Text style={styles.searchPrefixIcon}>🔍</Text>
          <TextInput
            style={styles.searchInputField}
            placeholder="Tìm tên món ăn trong thực đơn..."
            placeholderTextColor="#94A3B8"
            value={menuSearchText}
            onChangeText={setMenuSearchText}
          />
          {menuSearchText.length > 0 && (
            <TouchableOpacity 
              style={styles.clearTextBtn} 
              onPress={() => setMenuSearchText('')}
            >
              <Text style={styles.clearTextIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* BỘ LỌC CHIPS (Lọc món hết hàng, món theo danh mục) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {[
            { key: 'all', label: 'Tất cả món' },
            { key: 'out_of_stock', label: '⚠️ Tạm Hết Hàng' },
            { key: 'burgers', label: '🍔 Burgers' },
            { key: 'chicken', label: '🍗 Gà Rán' },
            { key: 'drinks', label: '🥤 Nước Uống' },
          ].map(chip => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chipItem, menuFilterCategory === chip.key && styles.chipItemActive]}
              onPress={() => setMenuFilterCategory(chip.key)}
            >
              <Text style={[styles.chipText, menuFilterCategory === chip.key && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Header danh sách & nút thêm món */}
        <View style={styles.listSectionHeader}>
          <Text style={styles.listSectionCount}>Tìm thấy {filteredFoods.length} món ăn</Text>
          <TouchableOpacity 
            style={styles.addNewItemBtn} 
            onPress={() => setModalType('addFood')}
          >
            <Text style={styles.addNewItemText}>+ Thêm Món Mới</Text>
          </TouchableOpacity>
        </View>

        {/* DANH SÁCH MÓN ĂN VỚI TOGGLE / SWITCH BẬT TẮT HẾT HÀNG NHANH */}
        <View style={styles.foodListWrapper}>
          {filteredFoods.map(item => {
            const isAvailable = item.trang_thai === 'con_hang';

            return (
              <View key={item.ma_mon_an} style={styles.foodItemRowCard}>
                <View style={styles.foodItemInfo}>
                  <View style={styles.foodTitleBadgeRow}>
                    <Text style={styles.foodItemTitle}>{item.ten_mon}</Text>
                    <View style={[styles.stockPill, isAvailable ? styles.stockPillGreen : styles.stockPillRed]}>
                      <Text style={[styles.stockPillText, isAvailable ? styles.textGreen : styles.textRed]}>
                        {isAvailable ? 'Còn hàng' : 'Hết hàng'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.foodItemDesc} numberOfLines={1}>{item.mo_ta || 'Món ăn fastfood'}</Text>
                  <Text style={styles.foodItemPrice}>{parseFloat(item.gia_ban).toLocaleString('vi-VN')} đ</Text>
                </View>

                {/* CỤM SWITCH/TOGGLE BÊN CẠNH MỖI MÓN THEO YÊU CẦU */}
                <View style={styles.switchControlCol}>
                  <Text style={styles.switchColLabel}>Tồn kho</Text>
                  <Switch
                    trackColor={{ false: '#FECACA', true: '#A7F3D0' }}
                    thumbColor={isAvailable ? '#10B981' : '#EF4444'}
                    ios_backgroundColor="#FECACA"
                    onValueChange={() => handleToggleFoodStock(item.ma_mon_an, item.trang_thai, item.ten_mon)}
                    value={isAvailable}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // =========================================================================
  // TAB 3: QUẢN LÝ ĐƠN HÀNG (ORDERS) - SEARCH ORDER ID + ERROR STATE
  // =========================================================================
  const renderOrdersTab = () => {
    return (
      <View style={styles.tabContentBlock}>
        {/* THANH TÌM KIẾM NHẬP MÃ ĐƠN HÀNG */}
        <View style={styles.searchBarContainer}>
          <Text style={styles.searchPrefixIcon}>#️⃣</Text>
          <TextInput
            style={styles.searchInputField}
            placeholder="Nhập mã đơn hàng cần tra cứu (VD: 1, 10, 15)..."
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={orderSearchId}
            onChangeText={setOrderSearchId}
          />
          {orderSearchId.length > 0 && (
            <TouchableOpacity 
              style={styles.clearTextBtn} 
              onPress={() => setOrderSearchId('')}
            >
              <Text style={styles.clearTextIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* LỌC TRẠNG THÁI ĐƠN */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'cho_xac_nhan', label: '🔔 Chờ xác nhận' },
            { key: 'dang_che_bien', label: '🍳 Bếp nấu' },
            { key: 'san_sang_giao', label: '📦 Sẵn sàng giao' },
            { key: 'dang_giao', label: '🛵 Đang giao' },
            { key: 'da_giao', label: '✅ Hoàn tất' },
          ].map(chip => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chipItem, orderStatusFilter === chip.key && styles.chipItemActive]}
              onPress={() => setOrderStatusFilter(chip.key)}
            >
              <Text style={[styles.chipText, orderStatusFilter === chip.key && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* TRẠNG THÁI LỖI: KHÔNG TÌM THẤY MÃ ĐƠN THEO YÊU CẦU */}
        {orderNotFound ? (
          <View style={styles.orderErrorStateBox}>
            <Text style={styles.orderErrorEmoji}>❌</Text>
            <Text style={styles.orderErrorTitle}>Không tìm thấy mã đơn "#{orderSearchId}"</Text>
            <Text style={styles.orderErrorSub}>
              Vui lòng kiểm tra lại số mã đơn hoặc xóa bộ lọc tìm kiếm để xem tất cả đơn hàng hiện có.
            </Text>
            <TouchableOpacity 
              style={styles.clearSearchBtn}
              onPress={() => setOrderSearchId('')}
            >
              <Text style={styles.clearSearchBtnText}>Xóa tìm kiếm mã đơn</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.orderListContainer}>
            {filteredOrders.map(order => (
              <View key={order.ma_don_hang} style={styles.adminOrderCard}>
                <View style={styles.adminOrderTopRow}>
                  <View style={styles.orderNumPill}>
                    <Text style={styles.orderNumText}>#{order.ma_don_hang}</Text>
                  </View>
                  <Text style={styles.adminOrderTime}>
                    {new Date(order.ngay_dat).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </Text>
                </View>

                <Text style={styles.adminOrderCustomer}>👤 Khách: {order.ten_khach_hang || 'Khách vãng lai'} {order.so_dien_thoai ? `• 📞 ${order.so_dien_thoai}` : ''}</Text>
                <Text style={styles.adminOrderAddress}>📍 {order.dia_chi_giao || order.dia_chi_giao_hang || 'Tại quán'}</Text>
                <Text style={styles.adminOrderTotal}>
                  Tổng tiền: {parseFloat(order.tong_tien || order.tong_thanh_toan || 0).toLocaleString('vi-VN')} đ • ({order.trang_thai_thanh_toan === 'da_thanh_toan' ? 'Đã thu tiền' : 'COD Chưa thu'})
                </Text>
                {order.khoang_cach_km ? (
                  <Text style={styles.adminOrderDist}>
                    📏 Khoảng cách: {order.khoang_cach_km} km • Tiền ship: {parseFloat(order.phi_giao_hang || 0).toLocaleString('vi-VN')} đ
                  </Text>
                ) : null}

                <View style={styles.adminOrderStatusRow}>
                  <Text style={styles.statusBadgeText}>
                    Trạng thái: {order.trang_thai_don_hang}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // =========================================================================
  // TAB 4: CÀI ĐẶT & HỆ THỐNG (SETTINGS) - VOUCHERS, NHÂN SỰ & MỐC QUÁN
  // =========================================================================
  const renderSettingsTab = () => (
    <View style={styles.tabContentBlock}>
      {/* Khối Cấu Hình Mốc Quán & Bán Kính Giao Hàng (Lấy địa chỉ quán làm mốc) */}
      <View style={styles.settingsGroupCard}>
        <View style={styles.groupHeaderRow}>
          <Text style={styles.groupHeaderTitle}>🏬 Địa Chỉ Mốc Quán (Cột Mốc)</Text>
          <View style={styles.landmarkTag}>
            <Text style={styles.landmarkTagText}>Bán kính: {storeLandmark.ban_kinh_phuc_vu_km}km</Text>
          </View>
        </View>

        <Text style={styles.landmarkDesc}>
          Cột mốc quán được dùng để giới hạn khách đặt hàng trong 3km, giới hạn shipper nhận đơn trong 3km, và tính phí ship 5.000đ/1km.
        </Text>

        {/* NÚT BẬT GPS LẤY VỊ TRÍ CHÍNH XÁC CỦA QUÁN */}
        <TouchableOpacity
          style={styles.gpsBannerBtn}
          onPress={handleGetStoreGPSLocation}
          disabled={locatingGPS}
          activeOpacity={0.8}
        >
          {locatingGPS ? (
            <View style={styles.gpsLocatingWrap}>
              <ActivityIndicator color="#6A1B9A" size="small" />
              <Text style={styles.gpsLocatingText}>Đang kết nối vệ tinh GPS & định vị địa chỉ quán...</Text>
            </View>
          ) : (
            <View style={styles.gpsBannerInner}>
              <Text style={styles.gpsBannerIcon}>📡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsBannerTitle}>Bật GPS Lấy Vị Trí Quán Hiện Tại</Text>
                <Text style={styles.gpsBannerSub}>Tự động nhận diện tọa độ GPS và tên địa chỉ chính xác của quán</Text>
              </View>
              <View style={styles.gpsActionPill}>
                <Text style={styles.gpsActionPillText}>Định vị</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.landmarkFieldLabel}>Tên quán / Nhà hàng:</Text>
        <TextInput
          style={styles.landmarkInput}
          value={storeLandmark.ten_quan}
          onChangeText={t => setStoreLandmark({ ...storeLandmark, ten_quan: t })}
          placeholder="Tên quán..."
        />

        <Text style={styles.landmarkFieldLabel}>Địa chỉ mốc quán:</Text>
        <TextInput
          style={[styles.landmarkInput, { height: 54 }]}
          multiline
          value={storeLandmark.dia_chi_quan}
          onChangeText={t => setStoreLandmark({ ...storeLandmark, dia_chi_quan: t })}
          placeholder="504 Đại lộ Bình Dương..."
        />

        <View style={styles.landmarkCoordsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.landmarkFieldLabel}>Vĩ độ (Latitude):</Text>
            <TextInput
              style={styles.landmarkInput}
              value={String(storeLandmark.vi_do)}
              keyboardType="numeric"
              onChangeText={t => setStoreLandmark({ ...storeLandmark, vi_do: t })}
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.landmarkFieldLabel}>Kinh độ (Longitude):</Text>
            <TextInput
              style={styles.landmarkInput}
              value={String(storeLandmark.kinh_do)}
              keyboardType="numeric"
              onChangeText={t => setStoreLandmark({ ...storeLandmark, kinh_do: t })}
            />
          </View>
        </View>

        <View style={styles.landmarkCoordsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.landmarkFieldLabel}>Bán kính phục vụ (km):</Text>
            <TextInput
              style={styles.landmarkInput}
              value={String(storeLandmark.ban_kinh_phuc_vu_km)}
              keyboardType="numeric"
              onChangeText={t => setStoreLandmark({ ...storeLandmark, ban_kinh_phuc_vu_km: t })}
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.landmarkFieldLabel}>Đơn giá ship/km (đ):</Text>
            <TextInput
              style={styles.landmarkInput}
              value={String(storeLandmark.gia_ship_moi_km)}
              keyboardType="numeric"
              onChangeText={t => setStoreLandmark({ ...storeLandmark, gia_ship_moi_km: t })}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.saveLandmarkBtn}
          onPress={handleSaveStoreLandmark}
          disabled={savingLandmark}
        >
          {savingLandmark ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.saveLandmarkBtnText}>💾 Lưu Địa Chỉ & Mốc Quán</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Khối quản lý Voucher */}
      <View style={styles.settingsGroupCard}>
        <View style={styles.groupHeaderRow}>
          <Text style={styles.groupHeaderTitle}>🎟️ Quản Lý Mã Khuyến Mãi (Voucher)</Text>
          <TouchableOpacity 
            style={styles.groupActionAddBtn}
            onPress={() => setModalType('addVoucher')}
          >
            <Text style={styles.groupActionAddText}>+ Tạo Mã</Text>
          </TouchableOpacity>
        </View>

        {vouchers.map(v => {
          const isFs = v.loai_ap_dung === 'phi_ship' || 
                       (v.ma_code && v.ma_code.toUpperCase().includes('SHIP')) || 
                       (v.ten_voucher && v.ten_voucher.toLowerCase().includes('vận chuyển'));
          const isPercent = v.loai_giam_gia === 'phan_tram';
          const discountDesc = isPercent
            ? `Giảm ${parseFloat(v.gia_tri_giam)}%${v.giam_toi_da ? ` (Tối đa ${parseFloat(v.giam_toi_da).toLocaleString('vi-VN')} đ)` : ''}`
            : `Giảm ${parseFloat(v.gia_tri_giam).toLocaleString('vi-VN')} đ`;
          const minOrderText = `Đơn từ ${parseFloat(v.don_hang_toi_thieu || 0).toLocaleString('vi-VN')} đ`;
          const usageText = `Đã dùng: ${v.so_luong_da_dung || 0}/${v.so_luong_phat_hanh || 100}`;

          return (
            <View key={v.ma_voucher} style={styles.voucherRowCard}>
              <View style={styles.voucherRowLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={styles.voucherCodeText}>{v.ma_code}</Text>
                  <View style={[styles.voucherTypeBadgeAdmin, isFs ? styles.voucherTypeBadgeFs : styles.voucherTypeBadgeFood]}>
                    <Text style={[styles.voucherTypeBadgeAdminText, isFs ? styles.voucherTypeFsText : styles.voucherTypeFoodText]}>
                      {isFs ? '🚚 Giảm phí ship' : '🍔 Giảm tiền món'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.voucherNameTextAdmin}>{v.ten_voucher}</Text>
                <Text style={styles.voucherDescTextAdmin}>
                  {discountDesc} • {minOrderText} • {usageText}
                </Text>
              </View>

              <View style={styles.voucherRowActions}>
                <TouchableOpacity 
                  style={[styles.voucherStatusPillBtn, v.trang_thai === 'hoat_dong' ? styles.statusPillActive : styles.statusPillInactive]}
                  onPress={() => handleToggleVoucher(v.ma_voucher)}
                >
                  <Text style={[styles.voucherStatusPillText, v.trang_thai === 'hoat_dong' ? styles.statusTextActive : styles.statusTextInactive]}>
                    {v.trang_thai === 'hoat_dong' ? 'Bật' : 'Tắt'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.voucherDeleteBtn}
                  onPress={() => handleDeleteVoucher(v.ma_voucher, v.ma_code)}
                >
                  <Text style={styles.voucherDeleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Khối Quản Lý Tài Khoản Toàn Bộ Người Dùng & Điều Chỉnh Quyền */}
      <View style={styles.settingsGroupCard}>
        <View style={styles.groupHeaderRow}>
          <Text style={styles.groupHeaderTitle}>👥 Quản Lý Người Dùng & Phân Quyền</Text>
          <TouchableOpacity 
            style={styles.groupActionAddBtn}
            onPress={() => setModalType('addUser')}
          >
            <Text style={styles.groupActionAddText}>+ Thêm Tài Khoản</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.landmarkDesc}>
          Quản lý toàn bộ {users.length} tài khoản trong hệ thống. Bạn có thể điều chỉnh vai trò sang Khách hàng, Bếp & Quán, hoặc Shipper.
        </Text>

        {/* Ô tìm kiếm tài khoản */}
        <View style={styles.userSearchBar}>
          <Text style={styles.userSearchIcon}>🔍</Text>
          <TextInput
            style={styles.userSearchInput}
            placeholder="Tìm theo tên, SĐT hoặc email..."
            placeholderTextColor="#94A3B8"
            value={userSearchText}
            onChangeText={setUserSearchText}
          />
          {userSearchText.length > 0 && (
            <TouchableOpacity onPress={() => setUserSearchText('')}>
              <Text style={styles.clearTextIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips cho vai trò */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.userRoleChipsScroll}>
          {[
            { key: 'all', label: `Tất cả (${users.length})` },
            { key: '1', label: `👤 Khách (${users.filter(u => u.ma_vai_tro === 1).length})` },
            { key: '2', label: `🧑‍🍳 Bếp/Quán (${users.filter(u => u.ma_vai_tro === 2).length})` },
            { key: '4', label: `🛵 Shipper (${users.filter(u => u.ma_vai_tro === 4).length})` },
            { key: '3', label: `👑 Admin (${users.filter(u => u.ma_vai_tro === 3).length})` },
          ].map(chip => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.userChipItem, userRoleFilter === chip.key && styles.userChipActive]}
              onPress={() => setUserRoleFilter(chip.key)}
            >
              <Text style={[styles.userChipText, userRoleFilter === chip.key && styles.userChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Danh sách người dùng */}
        {filteredUsers.length === 0 ? (
          <View style={styles.noUserFoundBox}>
            <Text style={styles.noUserFoundText}>Không tìm thấy tài khoản nào khớp với bộ lọc</Text>
          </View>
        ) : (
          filteredUsers.map(u => {
            const isAdminUser = u.ma_vai_tro === 3;
            const isKitchen = u.ma_vai_tro === 2;
            const isShipper = u.ma_vai_tro === 4;

            let roleName = 'Khách hàng';
            let roleBadgeStyle = styles.badgeCustomer;
            let roleTextStyle = styles.badgeTextCustomer;

            if (isAdminUser) {
              roleName = 'Quản trị viên';
              roleBadgeStyle = styles.badgeAdmin;
              roleTextStyle = styles.badgeTextAdmin;
            } else if (isKitchen) {
              roleName = 'Nhân viên quán & bếp';
              roleBadgeStyle = styles.badgeKitchen;
              roleTextStyle = styles.badgeTextKitchen;
            } else if (isShipper) {
              roleName = 'Tài xế Shipper';
              roleBadgeStyle = styles.badgeShipper;
              roleTextStyle = styles.badgeTextShipper;
            }

            return (
              <View key={u.ma_nguoi_dung} style={styles.userCardItem}>
                <View style={styles.userCardMain}>
                  <View style={styles.userCardAvatar}>
                    <Text style={styles.userAvatarEmoji}>
                      {isAdminUser ? '👑' : isKitchen ? '🧑‍🍳' : isShipper ? '🛵' : '👤'}
                    </Text>
                  </View>
                  <View style={styles.userCardDetails}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userItemName}>{u.ho_ten}</Text>
                      <View style={[styles.roleBadgeBox, roleBadgeStyle]}>
                        <Text style={[styles.roleBadgeLabel, roleTextStyle]}>{roleName}</Text>
                      </View>
                    </View>
                    <Text style={styles.userItemContact}>
                      📞 {u.so_dien_thoai || 'Không có SĐT'} {u.email ? `• ✉️ ${u.email}` : ''}
                    </Text>
                    {u.lan_hoat_dong_cuoi && (
                      <Text style={styles.userLastActive}>
                        Hoạt động: {new Date(u.lan_hoat_dong_cuoi).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Nút hành động phân quyền */}
                <View style={styles.userCardActionRow}>
                  {isAdminUser ? (
                    <View style={styles.adminProtectedTag}>
                      <Text style={styles.adminProtectedText}>🔒 Quản trị viên (Cố định - Không thể chuyển giao)</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.changeRoleBtn}
                      onPress={() => handleOpenRoleModal(u)}
                    >
                      <Text style={styles.changeRoleBtnText}>⚙️ Phân Quyền</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* KHỐI HỒ SƠ QUẢN TRỊ VIÊN & ĐĂNG XUẤT TRỰC TIẾP */}
      <View style={styles.adminProfileCard}>
        <View style={styles.adminProfileHeaderRow}>
          <TouchableOpacity 
            style={styles.adminAvatarWrap}
            onPress={handleOpenEditProfile}
            activeOpacity={0.8}
          >
            <Text style={styles.adminAvatarEmoji}>👑</Text>
            <View style={styles.avatarEditPencilBadge}>
              <Text style={styles.avatarEditPencilIcon}>✏️</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.adminProfileName}>{currentUser?.ho_ten || 'Quản Trị Viên Hệ Thống'}</Text>
            <View style={styles.adminRoleBadge}>
              <Text style={styles.adminRoleBadgeText}>👑 QUẢN TRỊ VIÊN CẤP CAO (ADMIN)</Text>
            </View>
            <Text style={styles.avatarHintTap}>Chạm avatar để sửa thông tin & đăng xuất</Text>
          </View>
        </View>

        <View style={styles.adminInfoRowsContainer}>
          <Text style={styles.adminInfoRowText}>📞 SĐT đăng nhập: <Text style={{ fontWeight: '700', color: '#1F2937' }}>{currentUser?.so_dien_thoai || 'Chưa cập nhật'}</Text></Text>
          <Text style={styles.adminInfoRowText}>📧 Email liên hệ: <Text style={{ fontWeight: '700', color: '#1F2937' }}>{currentUser?.email || 'Chưa cập nhật'}</Text></Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4A148C" />

      {/* Top Header Admin */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.adminHeaderTitle}>👑 FASTFOOD ADMIN PORTAL</Text>
          <Text style={styles.adminHeaderSubtitle}>Bảng Quản Trị Trung Tâm Hệ Thống</Text>
        </View>
        <TouchableOpacity style={styles.refreshTopBtn} onPress={handleRefresh}>
          <Text style={styles.refreshTopText}>🔄 Cập nhật</Text>
        </TouchableOpacity>
      </View>

      {/* Thân trang theo 4 Tab */}
      <View style={styles.bodyWrap}>
        {loading && !refreshing ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#6A1B9A" />
            <Text style={styles.loaderText}>Đang tải trung tâm điều hành...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6A1B9A']} />}
            contentContainerStyle={styles.scrollContainer}
          >
            {activeBottomTab === 'dashboard' && renderDashboardTab()}
            {activeBottomTab === 'menu' && renderMenuTab()}
            {activeBottomTab === 'orders' && renderOrdersTab()}
            {activeBottomTab === 'settings' && renderSettingsTab()}
          </ScrollView>
        )}
      </View>

      {/* ========================================================================= */}
      {/* 4 BOTTOM TABS CHUẨN UX: Tổng quan, Đơn hàng, Thực đơn, Cài đặt */}
      {/* ========================================================================= */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'dashboard' && styles.bottomTabActive]}
          onPress={() => setActiveBottomTab('dashboard')}
        >
          <Text style={styles.bottomIcon}>📊</Text>
          <Text style={[styles.bottomTabLabel, activeBottomTab === 'dashboard' && styles.bottomTabLabelActive]}>
            Tổng quan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'orders' && styles.bottomTabActive]}
          onPress={() => setActiveBottomTab('orders')}
        >
          <Text style={styles.bottomIcon}>📋</Text>
          <Text style={[styles.bottomTabLabel, activeBottomTab === 'orders' && styles.bottomTabLabelActive]}>
            Đơn hàng
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'menu' && styles.bottomTabActive]}
          onPress={() => setActiveBottomTab('menu')}
        >
          <Text style={styles.bottomIcon}>🍔</Text>
          <Text style={[styles.bottomTabLabel, activeBottomTab === 'menu' && styles.bottomTabLabelActive]}>
            Thực đơn
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'settings' && styles.bottomTabActive]}
          onPress={() => setActiveBottomTab('settings')}
        >
          <Text style={styles.bottomIcon}>⚙️</Text>
          <Text style={[styles.bottomTabLabel, activeBottomTab === 'settings' && styles.bottomTabLabelActive]}>
            Cài đặt
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* MODAL THÊM MÓN ĂN MỚI */}
      {/* ========================================================================= */}
      <Modal visible={modalType === 'addFood'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>🍔 Thêm Món Ăn Mới</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tên món ăn (VD: Burger Gà Cay)..."
              value={foodForm.ten_mon}
              onChangeText={t => setFoodForm({ ...foodForm, ten_mon: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Giá bán (VD: 45000)..."
              keyboardType="numeric"
              value={foodForm.gia_ban}
              onChangeText={t => setFoodForm({ ...foodForm, gia_ban: t })}
            />
            <TextInput
              style={[styles.modalInput, { height: 60 }]}
              placeholder="Mô tả món ăn..."
              multiline
              value={foodForm.mo_ta}
              onChangeText={t => setFoodForm({ ...foodForm, mo_ta: t })}
            />
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddFood} disabled={submitting}>
                <Text style={styles.modalSubmitText}>Lưu Món</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL TẠO VOUCHER MỚI */}
      {/* ========================================================================= */}
      <Modal visible={modalType === 'addVoucher'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <Text style={styles.modalHeading}>🎟️ Tạo Voucher Khuyến Mãi Mới</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {/* 1. Chọn mục tiêu ưu đãi */}
              <Text style={styles.formFieldLabel}>Mục tiêu áp dụng:</Text>
              <View style={styles.segmentedRow}>
                <TouchableOpacity 
                  style={[styles.segmentedBtn, voucherForm.loai_ap_dung === 'don_hang' && styles.segmentedBtnActive]}
                  onPress={() => setVoucherForm({ ...voucherForm, loai_ap_dung: 'don_hang' })}
                >
                  <Text style={[styles.segmentedBtnText, voucherForm.loai_ap_dung === 'don_hang' && styles.segmentedBtnTextActive]}>
                    🍔 Tiền món ăn
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.segmentedBtn, voucherForm.loai_ap_dung === 'phi_ship' && styles.segmentedBtnActive]}
                  onPress={() => setVoucherForm({ ...voucherForm, loai_ap_dung: 'phi_ship' })}
                >
                  <Text style={[styles.segmentedBtnText, voucherForm.loai_ap_dung === 'phi_ship' && styles.segmentedBtnTextActive]}>
                    🚚 Phí ship (Freeship)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 2. Chọn hình thức giảm giá */}
              <Text style={styles.formFieldLabel}>Hình thức giảm giá:</Text>
              <View style={styles.segmentedRow}>
                <TouchableOpacity 
                  style={[styles.segmentedBtn, voucherForm.loai_giam_gia === 'so_tien' && styles.segmentedBtnActive]}
                  onPress={() => setVoucherForm({ ...voucherForm, loai_giam_gia: 'so_tien' })}
                >
                  <Text style={[styles.segmentedBtnText, voucherForm.loai_giam_gia === 'so_tien' && styles.segmentedBtnTextActive]}>
                    💵 Số tiền (VNĐ)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.segmentedBtn, voucherForm.loai_giam_gia === 'phan_tram' && styles.segmentedBtnActive]}
                  onPress={() => setVoucherForm({ ...voucherForm, loai_giam_gia: 'phan_tram' })}
                >
                  <Text style={[styles.segmentedBtnText, voucherForm.loai_giam_gia === 'phan_tram' && styles.segmentedBtnTextActive]}>
                    📊 Phần trăm (%)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 3. Mã code & Tên voucher */}
              <Text style={styles.formFieldLabel}>Mã Voucher (Code):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: FREESHIP15, FAST30..."
                autoCapitalize="characters"
                value={voucherForm.ma_code}
                onChangeText={t => setVoucherForm({ ...voucherForm, ma_code: t.toUpperCase() })}
              />

              <Text style={styles.formFieldLabel}>Tên Voucher hiển thị:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: Miễn Phí Vận Chuyển 15K..."
                value={voucherForm.ten_voucher}
                onChangeText={t => setVoucherForm({ ...voucherForm, ten_voucher: t })}
              />

              {/* 4. Mức giảm & Giảm tối đa */}
              <Text style={styles.formFieldLabel}>
                {voucherForm.loai_giam_gia === 'phan_tram' ? 'Mức giảm (%) (từ 1% - 100%):' : 'Mức giảm tiền (VNĐ):'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={voucherForm.loai_giam_gia === 'phan_tram' ? 'VD: 30' : 'VD: 15000'}
                keyboardType="numeric"
                value={voucherForm.gia_tri_giam}
                onChangeText={t => setVoucherForm({ ...voucherForm, gia_tri_giam: t })}
              />

              {voucherForm.loai_giam_gia === 'phan_tram' && (
                <>
                  <Text style={styles.formFieldLabel}>Giảm tối đa (VNĐ, để trống nếu không giới hạn):</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="VD: 40000..."
                    keyboardType="numeric"
                    value={voucherForm.giam_toi_da}
                    onChangeText={t => setVoucherForm({ ...voucherForm, giam_toi_da: t })}
                  />
                </>
              )}

              {/* 5. Đơn hàng tối thiểu & Số lượng */}
              <Text style={styles.formFieldLabel}>Đơn hàng tối thiểu (VNĐ):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: 50000 (0 nếu không yêu cầu)..."
                keyboardType="numeric"
                value={voucherForm.don_hang_toi_thieu}
                onChangeText={t => setVoucherForm({ ...voucherForm, don_hang_toi_thieu: t })}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formFieldLabel}>Số lượng phát hành:</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="VD: 100"
                    keyboardType="numeric"
                    value={voucherForm.so_luong_phat_hanh}
                    onChangeText={t => setVoucherForm({ ...voucherForm, so_luong_phat_hanh: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formFieldLabel}>Hiệu lực (số ngày):</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="VD: 30"
                    keyboardType="numeric"
                    value={voucherForm.so_ngay_hieu_luc}
                    onChangeText={t => setVoucherForm({ ...voucherForm, so_ngay_hieu_luc: t })}
                  />
                </View>
              </View>

              <Text style={styles.formFieldLabel}>Mô tả chi tiết voucher:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: Giảm 15k phí ship cho đơn từ 50k..."
                value={voucherForm.mo_ta}
                onChangeText={t => setVoucherForm({ ...voucherForm, mo_ta: t })}
              />
            </ScrollView>

            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddVoucher} disabled={submitting}>
                <Text style={styles.modalSubmitText}>
                  {submitting ? 'Đang tạo...' : 'Tạo Voucher'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL THÊM NHÂN SỰ MỚI */}
      {/* ========================================================================= */}
      <Modal visible={modalType === 'addUser'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>👥 Thêm Tài Khoản Nhân Sự</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Họ và tên..."
              value={userForm.ho_ten}
              onChangeText={t => setUserForm({ ...userForm, ho_ten: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Số điện thoại đăng nhập..."
              keyboardType="phone-pad"
              value={userForm.so_dien_thoai}
              onChangeText={t => setUserForm({ ...userForm, so_dien_thoai: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Email liên hệ..."
              keyboardType="email-address"
              value={userForm.email}
              onChangeText={t => setUserForm({ ...userForm, email: t })}
            />

            {/* Chọn vai trò */}
            <View style={styles.rolePickerRow}>
              <TouchableOpacity
                style={[styles.rolePickBtn, userForm.ma_vai_tro === '2' && styles.rolePickActive]}
                onPress={() => setUserForm({ ...userForm, ma_vai_tro: '2' })}
              >
                <Text style={[styles.rolePickText, userForm.ma_vai_tro === '2' && styles.rolePickTextActive]}>
                  🧑‍🍳 Bếp / Quán
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rolePickBtn, userForm.ma_vai_tro === '4' && styles.rolePickActive]}
                onPress={() => setUserForm({ ...userForm, ma_vai_tro: '4' })}
              >
                <Text style={[styles.rolePickText, userForm.ma_vai_tro === '4' && styles.rolePickTextActive]}>
                  🛵 Shipper
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddUser} disabled={submitting}>
                <Text style={styles.modalSubmitText}>Tạo Tài Khoản</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL ĐIỀU CHỈNH VAI TRÒ / PHÂN QUYỀN (KHÔNG CHO PHÉP CẤP ADMIN) */}
      {/* ========================================================================= */}
      <Modal visible={modalType === 'changeRole'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeading}>⚙️ Phân Quyền Tài Khoản</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {roleModalUser && (
              <View style={styles.targetUserInfoBox}>
                <Text style={styles.targetUserName}>👤 {roleModalUser.ho_ten}</Text>
                <Text style={styles.targetUserSub}>
                  SĐT: {roleModalUser.so_dien_thoai || 'Chưa có'} • Email: {roleModalUser.email || 'Chưa có'}
                </Text>
                <Text style={styles.targetUserSub}>
                  Vai trò hiện tại:{' '}
                  <Text style={{ fontWeight: '700', color: '#6A1B9A' }}>
                    {roleModalUser.ma_vai_tro === 2
                      ? '🧑‍🍳 Nhân viên quán & bếp'
                      : roleModalUser.ma_vai_tro === 4
                      ? '🛵 Tài xế Shipper'
                      : '👤 Khách hàng'}
                  </Text>
                </Text>
              </View>
            )}

            <Text style={styles.selectRoleHeading}>Chọn vai trò muốn phân quyền:</Text>

            {/* Các tùy chọn vai trò: 1, 2, 4 (TUYỆT ĐỐI KHÔNG CÓ 3) */}
            <View style={styles.roleOptionsList}>
              {[
                {
                  id: 1,
                  icon: '👤',
                  title: 'Khách Hàng',
                  desc: 'Đặt món ăn, lưu sổ địa chỉ, nhận hàng và đánh giá đơn'
                },
                {
                  id: 2,
                  icon: '🧑‍🍳',
                  title: 'Nhân Viên Quán & Bếp',
                  desc: 'Xem đơn hàng cần nấu, chuyển trạng thái chế biến & báo sẵn sàng giao'
                },
                {
                  id: 4,
                  icon: '🛵',
                  title: 'Tài Xế Shipper',
                  desc: 'Bật trực tuyến GPS nhận đơn giao trong bán kính 3km của quán'
                }
              ].map(r => {
                const isSelected = selectedNewRole === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleOptionCard, isSelected && styles.roleOptionCardSelected]}
                    onPress={() => setSelectedNewRole(r.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.roleOptionIcon}>{r.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleOptionTitle, isSelected && styles.roleOptionTitleSelected]}>
                        {r.title}
                      </Text>
                      <Text style={styles.roleOptionDesc}>{r.desc}</Text>
                    </View>
                    <View style={[styles.roleRadioCircle, isSelected && styles.roleRadioCircleSelected]}>
                      {isSelected && <View style={styles.roleRadioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* CẢNH BÁO BẢO MẬT: KHÔNG THỂ CẤP QUYỀN QUẢN TRỊ VIÊN */}
            <View style={styles.securityWarningBox}>
              <Text style={styles.securityWarningIcon}>🔒</Text>
              <Text style={styles.securityWarningText}>
                Quy định bảo mật hệ thống: Không thể cấp quyền Quản trị viên (Admin) cho các tài khoản khác.
              </Text>
            </View>

            <View style={styles.modalBtnGroup}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalType(null)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Hủy Bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSaveUserRole}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Lưu Thay Đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL THAY ĐỔI THÔNG TIN QUẢN TRỊ VIÊN (ADMIN) */}
      {/* ========================================================================= */}
      <Modal
        visible={showEditProfileModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeading}>👤 Tài Khoản & Thông Tin Admin</Text>
              <TouchableOpacity onPress={() => setShowEditProfileModal(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.formFieldLabel}>Họ và tên *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nhập họ và tên..."
                value={profileForm.ho_ten}
                onChangeText={(t) => setProfileForm({ ...profileForm, ho_ten: t })}
              />

              <Text style={styles.formFieldLabel}>Số điện thoại *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nhập số điện thoại..."
                keyboardType="phone-pad"
                value={profileForm.so_dien_thoai}
                onChangeText={(t) => setProfileForm({ ...profileForm, so_dien_thoai: t })}
              />

              <Text style={styles.formFieldLabel}>Email</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nhập địa chỉ email..."
                keyboardType="email-address"
                autoCapitalize="none"
                value={profileForm.email}
                onChangeText={(t) => setProfileForm({ ...profileForm, email: t })}
              />

              <View style={styles.modalBtnGroup}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowEditProfileModal(false)}
                  disabled={savingProfile}
                >
                  <Text style={styles.modalCancelText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>💾 Lưu Thay Đổi</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* NÚT ĐĂNG XUẤT NẰM TRONG POPUP AVATAR */}
              <View style={styles.modalLogoutDivider} />
              <TouchableOpacity
                style={styles.modalLogoutBtn}
                onPress={handleLogout}
              >
                <Text style={styles.modalLogoutBtnText}>🚪 Đăng Xuất Admin</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#3B0764',
  },
  topHeader: {
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#4A148C',
  },
  adminHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  adminHeaderSubtitle: {
    color: '#E1BEE7',
    fontSize: 12,
    marginTop: 2,
  },
  refreshTopBtn: {
    backgroundColor: '#4A148C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshTopText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bodyWrap: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    padding: 14,
    paddingBottom: 24,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  tabContentBlock: {
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: '#64748B',
  },
  chartWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  chartHint: {
    fontSize: 11,
    color: '#94A3B8',
  },
  tooltipBadge: {
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  chartBody: {
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100%',
    zIndex: 2,
  },
  pointCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  verticalTrack: {
    width: 20,
    height: '80%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  verticalFillBar: {
    width: 8,
    backgroundColor: '#E9D5FF',
    borderRadius: 4,
  },
  chartDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#9333EA',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chartDotSelected: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#6A1B9A',
    borderColor: '#F3E8FF',
  },
  hourLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
  },
  hourLabelSelected: {
    color: '#6A1B9A',
    fontWeight: '800',
  },
  onlinePersonnelSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 12,
  },
  personnelCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  personnelCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  personnelCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  personnelIcon: {
    fontSize: 22,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  personnelCount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  personnelDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  quickActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minHeight: 48,
  },
  searchPrefixIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInputField: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 10,
  },
  clearTextBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  clearTextIcon: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '900',
  },
  chipScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  chipItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  chipItemActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  chipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listSectionCount: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  addNewItemBtn: {
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addNewItemText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  foodListWrapper: {
    gap: 10,
  },
  foodItemRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  foodItemInfo: {
    flex: 1,
    paddingRight: 10,
  },
  foodTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  foodItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  stockPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockPillGreen: {
    backgroundColor: '#DCFCE7',
  },
  stockPillRed: {
    backgroundColor: '#FEE2E2',
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textGreen: {
    color: '#15803D',
  },
  textRed: {
    color: '#DC2626',
  },
  foodItemDesc: {
    fontSize: 12,
    color: '#64748B',
  },
  foodItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
    marginTop: 4,
  },
  switchControlCol: {
    alignItems: 'center',
    minWidth: 60,
  },
  switchColLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  orderErrorStateBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    marginVertical: 10,
  },
  orderErrorEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  orderErrorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 4,
  },
  orderErrorSub: {
    fontSize: 13,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  clearSearchBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  clearSearchBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  orderListContainer: {
    gap: 10,
  },
  adminOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adminOrderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderNumPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderNumText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  adminOrderTime: {
    fontSize: 12,
    color: '#64748B',
  },
  adminOrderCustomer: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  adminOrderAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  adminOrderTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
    marginTop: 4,
  },
  adminOrderStatusRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  settingsGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  groupHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  groupActionAddBtn: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  groupActionAddText: {
    color: '#6A1B9A',
    fontWeight: '700',
    fontSize: 12,
  },
  voucherRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  voucherRowLeft: {
    flex: 1,
    marginRight: 10,
  },
  voucherCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6A1B9A',
  },
  voucherTypeBadgeAdmin: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  voucherTypeBadgeFs: {
    backgroundColor: '#E0F2FE',
  },
  voucherTypeBadgeFood: {
    backgroundColor: '#FEF3C7',
  },
  voucherTypeBadgeAdminText: {
    fontSize: 10,
    fontWeight: '700',
  },
  voucherTypeFsText: {
    color: '#0369A1',
  },
  voucherTypeFoodText: {
    color: '#B45309',
  },
  voucherNameTextAdmin: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  voucherDescTextAdmin: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  voucherRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voucherStatusPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusPillInactive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  voucherStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#15803D',
  },
  statusTextInactive: {
    color: '#64748B',
  },
  voucherDeleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  voucherDeleteIcon: {
    fontSize: 14,
  },
  formFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentedBtnActive: {
    backgroundColor: '#EDE7F6',
    borderColor: '#6A1B9A',
  },
  segmentedBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentedBtnTextActive: {
    color: '#6A1B9A',
    fontWeight: '800',
  },
  userRowItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  userItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  userItemRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  logoutAdminBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 6,
  },
  logoutAdminBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  bottomNavContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  bottomTabActive: {
    borderTopWidth: 3,
    borderTopColor: '#6A1B9A',
  },
  bottomIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  bottomTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  bottomTabLabelActive: {
    color: '#6A1B9A',
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  rolePickBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rolePickActive: {
    backgroundColor: '#EDE7F6',
    borderColor: '#6A1B9A',
  },
  rolePickText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  rolePickTextActive: {
    color: '#6A1B9A',
    fontWeight: '800',
  },
  modalBtnGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#64748B',
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: '#6A1B9A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  landmarkTag: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  landmarkTagText: {
    color: '#6A1B9A',
    fontSize: 11,
    fontWeight: '700',
  },
  landmarkDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  landmarkFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6,
  },
  landmarkInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 6,
  },
  landmarkCoordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveLandmarkBtn: {
    backgroundColor: '#6A1B9A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveLandmarkBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  adminOrderDist: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  // Real-time Online Personnel Styles
  onlineSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  onlineDetailContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  onlineDetailTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 10,
  },
  onlineUserCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  onlineUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  onlineUserAvatar: {
    fontSize: 22,
  },
  onlineUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  onlineUserSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  onlineUserRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  roleMiniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeKitchen: {
    backgroundColor: '#EDE7F6',
  },
  roleBadgeShipper: {
    backgroundColor: '#E0F2F1',
  },
  roleMiniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleTextKitchen: {
    color: '#6A1B9A',
  },
  roleTextShipper: {
    color: '#00897B',
  },
  onlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeTimeText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  noOnlineBox: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  noOnlineEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  noOnlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  noOnlineSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  // GPS Banner Button Styles
  gpsBannerBtn: {
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  gpsBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gpsBannerIcon: {
    fontSize: 24,
  },
  gpsBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#581C87',
  },
  gpsBannerSub: {
    fontSize: 11,
    color: '#7E22CE',
    marginTop: 2,
    lineHeight: 15,
  },
  gpsActionPill: {
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsActionPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  gpsLocatingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  gpsLocatingText: {
    fontSize: 12,
    color: '#6A1B9A',
    fontWeight: '700',
  },
  // User Management & Filter Styles
  userSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  userSearchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  userSearchInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    color: '#1E293B',
  },
  userRoleChipsScroll: {
    marginBottom: 12,
  },
  userChipItem: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userChipActive: {
    backgroundColor: '#EDE7F6',
    borderColor: '#6A1B9A',
  },
  userChipText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  userChipTextActive: {
    color: '#6A1B9A',
    fontWeight: '800',
  },
  userCardItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE7F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarEmoji: {
    fontSize: 20,
  },
  userCardDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleBadgeBox: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeCustomer: {
    backgroundColor: '#F1F5F9',
  },
  badgeTextCustomer: {
    color: '#475569',
  },
  badgeKitchen: {
    backgroundColor: '#EDE7F6',
  },
  badgeTextKitchen: {
    color: '#6A1B9A',
  },
  badgeShipper: {
    backgroundColor: '#E0F2F1',
  },
  badgeTextShipper: {
    color: '#00897B',
  },
  badgeAdmin: {
    backgroundColor: '#FEF3C7',
  },
  badgeTextAdmin: {
    color: '#B45309',
  },
  roleBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  userItemContact: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  userLastActive: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  userCardActionRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'flex-end',
  },
  adminProtectedTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  adminProtectedText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '700',
  },
  changeRoleBtn: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1C4E9',
  },
  changeRoleBtnText: {
    fontSize: 12,
    color: '#6A1B9A',
    fontWeight: '700',
  },
  noUserFoundBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noUserFoundText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  // Modal Change Role Styles
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalCloseIcon: {
    fontSize: 18,
    color: '#94A3B8',
    padding: 4,
  },
  targetUserInfoBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  targetUserName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  targetUserSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectRoleHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  roleOptionsList: {
    gap: 8,
    marginBottom: 14,
  },
  roleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  roleOptionCardSelected: {
    backgroundColor: '#FAF5FF',
    borderColor: '#6A1B9A',
  },
  roleOptionIcon: {
    fontSize: 22,
  },
  roleOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  roleOptionTitleSelected: {
    color: '#6A1B9A',
    fontWeight: '800',
  },
  roleOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  roleRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleRadioCircleSelected: {
    borderColor: '#6A1B9A',
  },
  roleRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6A1B9A',
  },
  securityWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  securityWarningIcon: {
    fontSize: 16,
  },
  securityWarningText: {
    fontSize: 11,
    color: '#B91C1C',
    flex: 1,
    lineHeight: 16,
    fontWeight: '600',
  },
  adminProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  adminProfileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9333EA',
  },
  adminAvatarEmoji: {
    fontSize: 26,
  },
  adminProfileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  adminRoleBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  adminRoleBadgeText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '800',
  },
  adminInfoRowsContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 6,
  },
  adminInfoRowText: {
    fontSize: 13,
    color: '#6B7280',
  },
  adminActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  adminEditProfileBtn: {
    flex: 1,
    backgroundColor: '#6A1B9A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminEditProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  adminDirectLogoutBtn: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminDirectLogoutBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
  },
  avatarEditPencilBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#6A1B9A',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarEditPencilIcon: {
    fontSize: 11,
  },
  avatarHintTap: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600',
    marginTop: 4,
  },
  modalLogoutDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 18,
    marginBottom: 12,
  },
  modalLogoutBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLogoutBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
  },
});
