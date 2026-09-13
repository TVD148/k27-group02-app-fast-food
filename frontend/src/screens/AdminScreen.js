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
  updateFoodItem,
  deleteFoodItem,
  toggleItemStatus,
  fetchItemAdminDetails,
  fetchCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  fetchAdminOptionGroups,
  createAdminOptionGroup,
  updateAdminOptionGroup,
  deleteAdminOptionGroup,
  fetchAdminIngredients,
  createAdminIngredient,
  updateAdminIngredient,
  deleteAdminIngredient,
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
  const maxAmount = Math.max(...data.map(d => d.amount), 50000);
  const chartHeight = 170;

  return (
    <View style={styles.chartWrapper}>
      <View style={styles.chartHeaderRow}>
        <Text style={styles.chartTitle}>📈 Biểu Đồ Hoạt Động Theo Giờ</Text>
        {selectedPoint ? (
          <View style={styles.tooltipBadge}>
            <Text style={styles.tooltipText}>
              {selectedPoint.hour}: {selectedPoint.orders ? `${selectedPoint.orders} đơn hàng` : 'Hoạt động'}
            </Text>
          </View>
        ) : (
          <Text style={styles.chartHint}>Chạm vào cột để xem giờ</Text>
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
            const hasRevenue = item.amount > 0;
            const pointHeight = hasRevenue
              ? Math.max(34, (item.amount / maxAmount) * (chartHeight - 48))
              : 8;
            const isSelected = selectedPoint?.hour === item.hour;

            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.7}
                onPress={() => setSelectedPoint(item)}
                style={styles.pointCol}
              >
                <View style={styles.verticalTrack}>
                  <View
                    style={[
                      styles.verticalFillBar,
                      { height: pointHeight },
                      hasRevenue && styles.verticalFillBarActive,
                      isSelected && styles.verticalFillBarSelected,
                    ]}
                  />
                  <View
                    style={[
                      styles.chartDot,
                      { bottom: pointHeight - 6 },
                      hasRevenue && styles.chartDotActive,
                      isSelected && styles.chartDotSelected,
                    ]}
                  />
                </View>
                <Text style={[styles.hourLabel, hasRevenue && styles.hourLabelHasData, isSelected && styles.hourLabelSelected]}>
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
  const [expandedSettingSection, setExpandedSettingSection] = useState('store');
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

  // Data lists bổ sung
  const [categories, setCategories] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  // Modal Category states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ ma_danh_muc: null, ten_danh_muc: '', mo_ta: '' });
  const [savingCategory, setSavingCategory] = useState(false);

  // Modal Option Group states (Kích cỡ & Vị)
  const [showOptionGroupModal, setShowOptionGroupModal] = useState(false);
  const [optionGroupForm, setOptionGroupForm] = useState({ 
    ma_nhom: null, 
    ten_nhom: '', 
    la_bat_buoc: false, 
    chon_toi_da: '1', 
    values: [] 
  });
  const [savingOptionGroup, setSavingOptionGroup] = useState(false);

  // Form tạo / sửa nhanh nhóm tùy chọn inline ngay trong Food Modal
  const [inlineOptionGroupForm, setInlineOptionGroupForm] = useState({
    visible: false,
    ma_nhom: null,
    ten_nhom: '',
    la_bat_buoc: false,
    chon_toi_da: '1',
    values: []
  });
  const [savingInlineOptionGroup, setSavingInlineOptionGroup] = useState(false);

  // Form tạo / sửa nhanh nguyên liệu dinh dưỡng inline
  const [inlineIngredientForm, setInlineIngredientForm] = useState({
    visible: false,
    ma_nguyen_lieu: null,
    ten_nguyen_lieu: '',
    don_vi_tinh: 'phần',
    calo: '100',
    protein: '5',
    carbs: '10',
    fat: '2',
    don_gia_thay_doi: '5000'
  });
  const [savingIngredient, setSavingIngredient] = useState(false);


  // Food item states (Thêm & Sửa món ăn đầy đủ)
  const [editingFoodId, setEditingFoodId] = useState(null);
  const [foodModalSubTab, setFoodModalSubTab] = useState('basic'); // 'basic' | 'options' | 'nutrition'
  const [loadingFoodDetails, setLoadingFoodDetails] = useState(false);
  const [foodForm, setFoodForm] = useState({ 
    ten_mon: '', 
    mo_ta: '', 
    gia_ban: '', 
    ma_danh_muc: '1',
    hinh_anh: '',
    ma_nhom_list: [],
    nguyen_lieu_list: []
  });

  // Modal forms
  const [modalType, setModalType] = useState(null); // 'addFood' | 'addVoucher' | 'addUser' | 'changeRole'
  const [submitting, setSubmitting] = useState(false);

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
    const interval = setInterval(() => {
      loadAdminDataSilently();
    }, 10000);
    const unsubscribe = navigation.addListener('focus', () => {
      loadAllAdminData();
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [navigation]);

  const loadAdminDataSilently = async () => {
    try {
      const [foodsRes, ordersRes, onlineRes] = await Promise.all([
        fetchMenuItems().catch(() => null),
        fetchOrders().catch(() => null),
        fetchOnlinePersonnel().catch(() => null)
      ]);
      if (foodsRes && foodsRes.success) setFoods(foodsRes.data || []);
      if (ordersRes && ordersRes.success) setOrders(ordersRes.data || []);
      if (onlineRes && onlineRes.success && onlineRes.data) setOnlinePersonnel(onlineRes.data);
    } catch (e) {}
  };

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const storedUser = await AsyncStorage.getItem('user_info');
      if (storedUser) setCurrentUser(JSON.parse(storedUser));

      const [statsRes, foodsRes, ordersRes, vouchersRes, usersRes, landmarkRes, onlineRes, categoriesRes, optionGroupsRes, ingredientsRes] = await Promise.all([
        fetchDashboardStats().catch(() => null),
        fetchMenuItems().catch(() => null),
        fetchOrders().catch(() => null),
        fetchAdminVouchers().catch(() => null),
        fetchAdminUsers().catch(() => null),
        fetchStoreLandmark().catch(() => null),
        fetchOnlinePersonnel().catch(() => null),
        fetchCategories().catch(() => null),
        fetchAdminOptionGroups().catch(() => null),
        fetchAdminIngredients().catch(() => null)
      ]);

      if (statsRes && statsRes.success) setStats(statsRes.data);
      if (foodsRes && foodsRes.success) setFoods(foodsRes.data || []);
      if (ordersRes && ordersRes.success) setOrders(ordersRes.data || []);
      if (vouchersRes && vouchersRes.success) setVouchers(vouchersRes.data || []);
      if (usersRes && usersRes.success) setUsers(usersRes.data || []);
      if (categoriesRes && categoriesRes.success) setCategories(categoriesRes.data || []);
      if (optionGroupsRes && optionGroupsRes.success) setOptionGroups(optionGroupsRes.data || []);
      if (ingredientsRes && ingredientsRes.success) setIngredients(ingredientsRes.data || []);
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
      if (res && res.success) {
        const newStatus = res.trang_thai_moi || res.data?.trang_thai || (currentStatus === 'con_hang' ? 'het_hang' : 'con_hang');
        setFoods(prev => prev.map(f => f.ma_mon_an === foodId ? { ...f, trang_thai: newStatus } : f));
        Alert.alert('Đã cập nhật', `${foodName}: ${newStatus === 'con_hang' ? 'Đã chuyển sang CÒN HÀNG ✅' : 'Đã chuyển sang HẾT HÀNG ❌'}`);
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể đổi trạng thái món!');
    }
  };

  // 2. Lọc thực đơn theo Search text + Filter Chips (Hỗ trợ danh mục động)
  const filteredFoods = useMemo(() => {
    return foods.filter(item => {
      const matchSearch = item.ten_mon.toLowerCase().includes(menuSearchText.trim().toLowerCase());
      if (!matchSearch) return false;

      if (menuFilterCategory === 'out_of_stock') {
        return item.trang_thai !== 'con_hang';
      }
      if (menuFilterCategory === 'all') {
        return true;
      }
      return String(item.ma_danh_muc) === String(menuFilterCategory);
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

  // =========================================================================
  // XỬ LÝ CRUD MÓN ĂN (FOOD ITEMS)
  // =========================================================================
  const handleOpenAddFood = () => {
    setEditingFoodId(null);
    setFoodModalSubTab('basic');
    setFoodForm({
      ten_mon: '',
      mo_ta: '',
      gia_ban: '',
      ma_danh_muc: categories.length > 0 ? String(categories[0].ma_danh_muc) : '1',
      hinh_anh: '',
      ma_nhom_list: [],
      nguyen_lieu_list: []
    });
    setModalType('addFood');
  };

  const handleOpenEditFood = async (item) => {
    setEditingFoodId(item.ma_mon_an);
    setFoodModalSubTab('basic');
    setLoadingFoodDetails(true);
    setModalType('addFood');
    try {
      const res = await fetchItemAdminDetails(item.ma_mon_an);
      if (res && res.success && res.data) {
        const d = res.data;
        setFoodForm({
          ten_mon: d.ten_mon || '',
          mo_ta: d.mo_ta || '',
          gia_ban: String(d.gia_ban || ''),
          ma_danh_muc: String(d.ma_danh_muc || '1'),
          hinh_anh: d.hinh_anh || '',
          ma_nhom_list: d.ma_nhom_list || [],
          nguyen_lieu_list: (d.nguyen_lieu_list || []).map(nl => ({
            ma_nguyen_lieu: nl.ma_nguyen_lieu,
            ten_nguyen_lieu: nl.ten_nguyen_lieu,
            don_vi_tinh: nl.don_vi_tinh,
            so_luong_mac_dinh: parseFloat(nl.so_luong_mac_dinh || 1),
            co_the_tuy_bien: nl.co_the_tuy_bien === 1 || nl.co_the_tuy_bien === true,
            so_luong_toi_da: parseFloat(nl.so_luong_toi_da || 3),
            calo: parseFloat(nl.calo || 0),
            protein: parseFloat(nl.protein || 0),
            carbs: parseFloat(nl.carbs || 0),
            fat: parseFloat(nl.fat || 0),
            don_gia_thay_doi: parseFloat(nl.don_gia_thay_doi || 0)
          }))
        });
      } else {
        setFoodForm({
          ten_mon: item.ten_mon,
          mo_ta: item.mo_ta || '',
          gia_ban: String(item.gia_ban),
          ma_danh_muc: String(item.ma_danh_muc || '1'),
          hinh_anh: item.hinh_anh || '',
          ma_nhom_list: [],
          nguyen_lieu_list: []
        });
      }
    } catch (err) {
      console.log('Lỗi tải chi tiết món ăn:', err.message);
      setFoodForm({
        ten_mon: item.ten_mon,
        mo_ta: item.mo_ta || '',
        gia_ban: String(item.gia_ban),
        ma_danh_muc: String(item.ma_danh_muc || '1'),
        hinh_anh: item.hinh_anh || '',
        ma_nhom_list: [],
        nguyen_lieu_list: []
      });
    } finally {
      setLoadingFoodDetails(false);
    }
  };

  const handleDeleteFood = (item) => {
    Alert.alert(
      'Xóa Món Ăn',
      `Bạn có chắc chắn muốn xóa món "${item.ten_mon}" khỏi thực đơn?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa Vĩnh Viễn',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteFoodItem(item.ma_mon_an);
              if (res.success) {
                Alert.alert('Thành công', `Đã xóa món "${item.ten_mon}"!`);
                loadAllAdminData();
              }
            } catch (err) {
              Alert.alert('Lỗi', err.message || 'Không thể xóa món ăn!');
            }
          }
        }
      ]
    );
  };

  const handleSaveFood = async () => {
    if (!foodForm.ten_mon.trim() || !foodForm.gia_ban) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên món và giá bán!');
      return;
    }
    const price = parseFloat(foodForm.gia_ban);
    if (isNaN(price) || price < 0) {
      Alert.alert('Lỗi', 'Giá bán phải là số hợp lệ >= 0!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ten_mon: foodForm.ten_mon.trim(),
        mo_ta: foodForm.mo_ta.trim(),
        gia_ban: price,
        ma_danh_muc: foodForm.ma_danh_muc ? parseInt(foodForm.ma_danh_muc) : null,
        hinh_anh: foodForm.hinh_anh.trim() || null,
        ma_nhom_list: foodForm.ma_nhom_list,
        nguyen_lieu_list: foodForm.nguyen_lieu_list.map(nl => ({
          ma_nguyen_lieu: nl.ma_nguyen_lieu,
          so_luong_mac_dinh: nl.so_luong_mac_dinh,
          co_the_tuy_bien: nl.co_the_tuy_bien ? 1 : 0,
          so_luong_toi_da: nl.so_luong_toi_da
        }))
      };

      if (editingFoodId) {
        const res = await updateFoodItem(editingFoodId, payload);
        if (res.success) {
          Alert.alert('Thành công 🎉', `Đã cập nhật món "${payload.ten_mon}"!`);
          setModalType(null);
          setEditingFoodId(null);
          loadAllAdminData();
        }
      } else {
        const res = await createFoodItem(payload);
        if (res.success) {
          Alert.alert('Thành công 🎉', `Đã thêm món "${payload.ten_mon}" vào thực đơn!`);
          setModalType(null);
          loadAllAdminData();
        }
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu món ăn!');
    } finally {
      setSubmitting(false);
    }
  };

  // Alias để tương thích an toàn nếu có component/cache gọi handleAddFood cũ
  const handleAddFood = handleSaveFood;

  // =========================================================================
  // XỬ LÝ CRUD DANH MỤC (CATEGORIES)
  // =========================================================================
  const handleOpenCategoryManager = () => {
    setCategoryForm({ ma_danh_muc: null, ten_danh_muc: '', mo_ta: '' });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.ten_danh_muc.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên danh mục!');
      return;
    }
    setSavingCategory(true);
    try {
      if (categoryForm.ma_danh_muc) {
        const res = await updateAdminCategory(categoryForm.ma_danh_muc, {
          ten_danh_muc: categoryForm.ten_danh_muc.trim(),
          mo_ta: categoryForm.mo_ta.trim()
        });
        if (res.success) {
          Alert.alert('Thành công', 'Đã cập nhật danh mục!');
          setCategoryForm({ ma_danh_muc: null, ten_danh_muc: '', mo_ta: '' });
          loadAllAdminData();
        }
      } else {
        const res = await createAdminCategory({
          ten_danh_muc: categoryForm.ten_danh_muc.trim(),
          mo_ta: categoryForm.mo_ta.trim()
        });
        if (res.success) {
          Alert.alert('Thành công', 'Đã tạo danh mục mới!');
          setCategoryForm({ ma_danh_muc: null, ten_danh_muc: '', mo_ta: '' });
          loadAllAdminData();
        }
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu danh mục!');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = (cat) => {
    Alert.alert(
      'Xóa Danh Mục',
      `Bạn có chắc muốn xóa danh mục "${cat.ten_danh_muc}"? Các món thuộc danh mục này sẽ được chuyển thành Không phân loại.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteAdminCategory(cat.ma_danh_muc);
              if (res.success) {
                Alert.alert('Thành công', 'Đã xóa danh mục!');
                loadAllAdminData();
              }
            } catch (err) {
              Alert.alert('Lỗi', err.message || 'Không thể xóa danh mục!');
            }
          }
        }
      ]
    );
  };

  // =========================================================================
  // XỬ LÝ CRUD NHÓM TÙY CHỌN (KÍCH CỠ & TÙY CHỌN VỊ)
  // =========================================================================
  const handleOpenOptionGroupManager = () => {
    setOptionGroupForm({ ma_nhom: null, ten_nhom: '', la_bat_buoc: false, chon_toi_da: '1', values: [] });
    setShowOptionGroupModal(true);
  };

  const handleSaveOptionGroup = async () => {
    if (!optionGroupForm.ten_nhom.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nhóm tùy chọn!');
      return;
    }
    setSavingOptionGroup(true);
    try {
      const payload = {
        ten_nhom: optionGroupForm.ten_nhom.trim(),
        la_bat_buoc: optionGroupForm.la_bat_buoc ? 1 : 0,
        chon_toi_da: parseInt(optionGroupForm.chon_toi_da) || 1,
        values: optionGroupForm.values
      };
      if (optionGroupForm.ma_nhom) {
        const res = await updateAdminOptionGroup(optionGroupForm.ma_nhom, payload);
        if (res.success) {
          Alert.alert('Thành công', 'Đã cập nhật nhóm tùy chọn!');
          setOptionGroupForm({ ma_nhom: null, ten_nhom: '', la_bat_buoc: false, chon_toi_da: '1', values: [] });
          loadAllAdminData();
        }
      } else {
        const res = await createAdminOptionGroup(payload);
        if (res.success) {
          Alert.alert('Thành công', 'Đã tạo nhóm tùy chọn mới!');
          setOptionGroupForm({ ma_nhom: null, ten_nhom: '', la_bat_buoc: false, chon_toi_da: '1', values: [] });
          loadAllAdminData();
        }
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu nhóm tùy chọn!');
    } finally {
      setSavingOptionGroup(false);
    }
  };

  const handleDeleteOptionGroup = (grp) => {
    Alert.alert(
      'Xóa Nhóm Tùy Chọn',
      `Bạn có chắc muốn xóa nhóm "${grp.ten_nhom}"? Các lựa chọn kích cỡ/vị liên quan sẽ bị xóa.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteAdminOptionGroup(grp.ma_nhom);
              if (res.success) {
                Alert.alert('Thành công', 'Đã xóa nhóm tùy chọn!');
                loadAllAdminData();
              }
            } catch (err) {
              Alert.alert('Lỗi', err.message || 'Không thể xóa nhóm tùy chọn!');
            }
          }
        }
      ]
    );
  };

  // =========================================================================
  // XỬ LÝ TÙY CHỌN INLINE & NGUYÊN LIỆU DINH DƯỠNG TRONG FORM MÓN ĂN
  // =========================================================================
  const handleSaveInlineOptionGroup = async () => {
    if (!inlineOptionGroupForm.ten_nhom.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nhóm tùy chọn!');
      return;
    }
    setSavingInlineOptionGroup(true);
    try {
      const payload = {
        ten_nhom: inlineOptionGroupForm.ten_nhom.trim(),
        la_bat_buoc: inlineOptionGroupForm.la_bat_buoc ? 1 : 0,
        chon_toi_da: parseInt(inlineOptionGroupForm.chon_toi_da) || 1,
        values: (inlineOptionGroupForm.values || []).filter(v => v.ten_gia_tri && v.ten_gia_tri.trim()).map(v => ({
          ten_gia_tri: v.ten_gia_tri.trim(),
          gia_tang_them: parseFloat(v.gia_tang_them) || 0
        }))
      };
      if (inlineOptionGroupForm.ma_nhom) {
        const res = await updateAdminOptionGroup(inlineOptionGroupForm.ma_nhom, payload);
        if (res.success) {
          Alert.alert('Thành công', `Đã cập nhật nhóm "${payload.ten_nhom}"!`);
          setInlineOptionGroupForm({ visible: false, ma_nhom: null, ten_nhom: '', la_bat_buoc: false, chon_toi_da: '1', values: [] });
          const updatedGroups = await fetchAdminOptionGroups().catch(() => null);
          if (updatedGroups && updatedGroups.success) setOptionGroups(updatedGroups.data || []);
        }
      } else {
        const res = await createAdminOptionGroup(payload);
        if (res.success) {
          Alert.alert('Thành công', `Đã tạo nhóm "${payload.ten_nhom}"!`);
          const newGroupId = res.data?.ma_nhom;
          if (newGroupId) {
            setFoodForm(prev => ({
              ...prev,
              ma_nhom_list: prev.ma_nhom_list.includes(newGroupId) ? prev.ma_nhom_list : [...prev.ma_nhom_list, newGroupId]
            }));
          }
          setInlineOptionGroupForm({ visible: false, ma_nhom: null, ten_nhom: '', la_bat_buoc: false, chon_toi_da: '1', values: [] });
          const updatedGroups = await fetchAdminOptionGroups().catch(() => null);
          if (updatedGroups && updatedGroups.success) setOptionGroups(updatedGroups.data || []);
        }
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu nhóm tùy chọn!');
    } finally {
      setSavingInlineOptionGroup(false);
    }
  };

  const handleSaveInlineIngredient = async () => {
    if (!inlineIngredientForm.ten_nguyen_lieu.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nguyên liệu!');
      return;
    }
    setSavingIngredient(true);
    try {
      const payload = {
        ten_nguyen_lieu: inlineIngredientForm.ten_nguyen_lieu.trim(),
        don_vi_tinh: inlineIngredientForm.don_vi_tinh.trim() || 'phần',
        calo: parseFloat(inlineIngredientForm.calo) || 0,
        protein: parseFloat(inlineIngredientForm.protein) || 0,
        carbs: parseFloat(inlineIngredientForm.carbs) || 0,
        fat: parseFloat(inlineIngredientForm.fat) || 0,
        don_gia_thay_doi: parseFloat(inlineIngredientForm.don_gia_thay_doi) || 0
      };

      if (inlineIngredientForm.ma_nguyen_lieu) {
        const res = await updateAdminIngredient(inlineIngredientForm.ma_nguyen_lieu, payload);
        if (res.success) {
          Alert.alert('Thành công', `Đã cập nhật nguyên liệu "${payload.ten_nguyen_lieu}"!`);
          setFoodForm(prev => ({
            ...prev,
            nguyen_lieu_list: prev.nguyen_lieu_list.map(nl =>
              nl.ma_nguyen_lieu === inlineIngredientForm.ma_nguyen_lieu
                ? { ...nl, ...payload }
                : nl
            )
          }));
          setInlineIngredientForm({ visible: false, ma_nguyen_lieu: null, ten_nguyen_lieu: '', don_vi_tinh: 'phần', calo: '100', protein: '5', carbs: '10', fat: '2', don_gia_thay_doi: '5000' });
          const updatedIngs = await fetchAdminIngredients().catch(() => null);
          if (updatedIngs && updatedIngs.success) setIngredients(updatedIngs.data || []);
        }
      } else {
        const res = await createAdminIngredient(payload);
        if (res.success) {
          Alert.alert('Thành công', `Đã tạo nguyên liệu "${payload.ten_nguyen_lieu}"!`);
          const newIng = res.data;
          if (newIng && newIng.ma_nguyen_lieu) {
            setFoodForm(prev => ({
              ...prev,
              nguyen_lieu_list: [
                ...prev.nguyen_lieu_list,
                {
                  ma_nguyen_lieu: newIng.ma_nguyen_lieu,
                  ten_nguyen_lieu: newIng.ten_nguyen_lieu,
                  don_vi_tinh: newIng.don_vi_tinh,
                  so_luong_mac_dinh: 1,
                  co_the_tuy_bien: true,
                  so_luong_toi_da: 3,
                  calo: newIng.calo,
                  protein: newIng.protein,
                  carbs: newIng.carbs,
                  fat: newIng.fat,
                  don_gia_thay_doi: newIng.don_gia_thay_doi
                }
              ]
            }));
          }
          setInlineIngredientForm({ visible: false, ma_nguyen_lieu: null, ten_nguyen_lieu: '', don_vi_tinh: 'phần', calo: '100', protein: '5', carbs: '10', fat: '2', don_gia_thay_doi: '5000' });
          const updatedIngs = await fetchAdminIngredients().catch(() => null);
          if (updatedIngs && updatedIngs.success) setIngredients(updatedIngs.data || []);
        }
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu nguyên liệu!');
    } finally {
      setSavingIngredient(false);
    }
  };

  const handleDeleteIngredient = (ing) => {
    Alert.alert(
      'Xóa Nguyên Liệu',
      `Bạn có chắc muốn xóa nguyên liệu "${ing.ten_nguyen_lieu}" khỏi toàn hệ thống?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteAdminIngredient(ing.ma_nguyen_lieu);
              if (res.success) {
                Alert.alert('Thành công', 'Đã xóa nguyên liệu!');
                setFoodForm(prev => ({
                  ...prev,
                  nguyen_lieu_list: prev.nguyen_lieu_list.filter(item => item.ma_nguyen_lieu !== ing.ma_nguyen_lieu)
                }));
                const updatedIngs = await fetchAdminIngredients().catch(() => null);
                if (updatedIngs && updatedIngs.success) setIngredients(updatedIngs.data || []);
              }
            } catch (err) {
              Alert.alert('Lỗi', err.message || 'Không thể xóa nguyên liệu!');
            }
          }
        }
      ]
    );
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
        <RevenueLineChart hourlyData={stats?.hourly_revenue || []} />

        {/* 2. HIỂN THỊ SỐ LƯỢNG SHIPPER / BẾP ĐANG ONLINE THẬT SỰ (KHÔNG DÙNG DỮ LIỆU GIẢ) */}
        <View style={styles.onlinePersonnelSection}>
          <View style={styles.onlineSectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>🟢 NHÂN SỰ TRỰC TUYẾN THỜI GIAN THỰC</Text>
            <View style={styles.liveIndicatorBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveIndicatorText}>Trực tuyến</Text>
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
            style={[styles.quickActionButton, { backgroundColor: '#0284C7' }]}
            onPress={() => setActiveBottomTab('users')}
          >
            <Text style={styles.quickActionBtnText}>👥 Quản Lý Tài Khoản</Text>
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
        {/* THANH CÔNG CỤ QUẢN TRỊ DANH MỤC & NHÓM KÍCH CỠ / VỊ */}
        <View style={styles.adminToolRow}>
          <TouchableOpacity 
            style={styles.adminToolBtn}
            onPress={handleOpenCategoryManager}
          >
            <Text style={styles.adminToolBtnText}>📁 Quản Lý Danh Mục ({categories.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.adminToolBtn, { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD' }]}
            onPress={handleOpenOptionGroupManager}
          >
            <Text style={[styles.adminToolBtnText, { color: '#6D28D9' }]}>⚙️ Kích Cỡ & Vị ({optionGroups.length})</Text>
          </TouchableOpacity>
        </View>

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

        {/* BỘ LỌC CHIPS (Lọc theo danh mục động tải từ database) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <TouchableOpacity
            style={[styles.chipItem, menuFilterCategory === 'all' && styles.chipItemActive]}
            onPress={() => setMenuFilterCategory('all')}
          >
            <Text style={[styles.chipText, menuFilterCategory === 'all' && styles.chipTextActive]}>
              Tất cả món
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chipItem, menuFilterCategory === 'out_of_stock' && styles.chipItemActive]}
            onPress={() => setMenuFilterCategory('out_of_stock')}
          >
            <Text style={[styles.chipText, menuFilterCategory === 'out_of_stock' && styles.chipTextActive]}>
              ⚠️ Tạm Hết Hàng
            </Text>
          </TouchableOpacity>

          {categories.map(cat => (
            <TouchableOpacity
              key={cat.ma_danh_muc}
              style={[styles.chipItem, menuFilterCategory === String(cat.ma_danh_muc) && styles.chipItemActive]}
              onPress={() => setMenuFilterCategory(String(cat.ma_danh_muc))}
            >
              <Text style={[styles.chipText, menuFilterCategory === String(cat.ma_danh_muc) && styles.chipTextActive]}>
                🏷️ {cat.ten_danh_muc}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Header danh sách & nút thêm món */}
        <View style={styles.listSectionHeader}>
          <Text style={styles.listSectionCount}>Tìm thấy {filteredFoods.length} món ăn</Text>
          <TouchableOpacity 
            style={styles.addNewItemBtn} 
            onPress={handleOpenAddFood}
          >
            <Text style={styles.addNewItemText}>+ Thêm Món Mới</Text>
          </TouchableOpacity>
        </View>

        {/* DANH SÁCH MÓN ĂN VỚI SỬA, XÓA VÀ SWITCH BẬT TẮT HẾT HÀNG */}
        <View style={styles.foodListWrapper}>
          {filteredFoods.map(item => {
            const isAvailable = item.trang_thai === 'con_hang';
            const catName = categories.find(c => c.ma_danh_muc === item.ma_danh_muc)?.ten_danh_muc || 'Chưa phân loại';

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

                  <View style={styles.foodCategoryBadge}>
                    <Text style={styles.foodCategoryBadgeText}>🏷️ {catName}</Text>
                  </View>

                  <Text style={styles.foodItemDesc} numberOfLines={2}>{item.mo_ta || 'Món ăn nhanh hấp dẫn'}</Text>
                  <Text style={styles.foodItemPrice}>{parseFloat(item.gia_ban).toLocaleString('vi-VN')} đ</Text>

                  {/* CỤM NÚT SỬA & XÓA MÓN ĂN */}
                  <View style={styles.foodActionButtonsRow}>
                    <TouchableOpacity 
                      style={styles.foodActionEditBtn}
                      onPress={() => handleOpenEditFood(item)}
                    >
                      <Text style={styles.foodActionEditText}>✏️ Sửa Món</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.foodActionDeleteBtn}
                      onPress={() => handleDeleteFood(item)}
                    >
                      <Text style={styles.foodActionDeleteText}>🗑️ Xóa</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* CỤM SWITCH/TOGGLE BÊN CẠNH MỖI MÓN */}
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
  // TAB 2: QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN (USERS & ROLES)
  // =========================================================================
  const renderUsersTab = () => (
    <View style={styles.tabContentBlock}>
      <View style={styles.settingsGroupCard}>
        <View style={styles.groupHeaderRow}>
          <Text style={[styles.groupHeaderTitle, { flex: 1, marginRight: 8 }]} numberOfLines={1}>
            👥 Phân Quyền Tài Khoản
          </Text>
          <TouchableOpacity 
            style={styles.groupActionAddBtn}
            onPress={() => setModalType('addUser')}
            activeOpacity={0.8}
          >
            <Text style={styles.groupActionAddText}>+ Thêm</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.landmarkDesc}>
          Danh sách tài khoản ({users.length})
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
    </View>
  );

  // =========================================================================
  // TAB 4: CÀI ĐẶT & HỆ THỐNG (SETTINGS) - TÀI KHOẢN, MỐC QUÁN & VOUCHERS
  // =========================================================================
  const renderSettingsTab = () => (
    <View style={styles.tabContentBlock}>
      {/* 1. KHỐI HỒ SƠ QUẢN TRỊ VIÊN ĐƯỢC ĐƯA LÊN ĐẦU TIÊN */}
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
          </View>
        </View>

        <View style={styles.adminInfoRowsContainer}>
          <Text style={styles.adminInfoRowText}>📞 SĐT đăng nhập: <Text style={{ fontWeight: '700', color: '#1F2937' }}>{currentUser?.so_dien_thoai || 'Chưa cập nhật'}</Text></Text>
          <Text style={styles.adminInfoRowText}>📧 Email liên hệ: <Text style={{ fontWeight: '700', color: '#1F2937' }}>{currentUser?.email || 'Chưa cập nhật'}</Text></Text>
        </View>
      </View>

      {/* 2. MỤC ĐỊA CHỈ MỐC QUÁN - BẤM VÀO MỚI XỔ XUỐNG */}
      <View style={styles.settingsGroupCard}>
        <TouchableOpacity
          style={styles.accordionHeaderBtn}
          onPress={() => setExpandedSettingSection(expandedSettingSection === 'store' ? null : 'store')}
          activeOpacity={0.7}
        >
          <Text style={styles.accordionTitleText}>🏬 Địa Chỉ Quán</Text>
          <View style={styles.accordionExpandBadge}>
            <Text style={styles.accordionExpandIcon}>
              {expandedSettingSection === 'store' ? '▲' : '▼'}
            </Text>
          </View>
        </TouchableOpacity>

        {expandedSettingSection === 'store' && (
          <View style={{ marginTop: 14 }}>
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
        )}
      </View>

      {/* 3. MỤC MÃ KHUYẾN MÃI - BẤM VÀO MỚI XỔ XUỐNG */}
      <View style={styles.settingsGroupCard}>
        <TouchableOpacity
          style={styles.accordionHeaderBtn}
          onPress={() => setExpandedSettingSection(expandedSettingSection === 'voucher' ? null : 'voucher')}
          activeOpacity={0.7}
        >
          <Text style={styles.accordionTitleText}>🎟️ Mã Khuyến Mãi</Text>
          <View style={styles.accordionExpandBadge}>
            <Text style={styles.accordionExpandIcon}>
              {expandedSettingSection === 'voucher' ? '▲' : '▼'}
            </Text>
          </View>
        </TouchableOpacity>

        {expandedSettingSection === 'voucher' && (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
              <TouchableOpacity 
                style={styles.groupActionAddBtn}
                onPress={() => setModalType('addVoucher')}
              >
                <Text style={styles.groupActionAddText}>+ Tạo Mã Mới</Text>
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
        )}
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
            {activeBottomTab === 'users' && renderUsersTab()}
            {activeBottomTab === 'menu' && renderMenuTab()}
            {activeBottomTab === 'settings' && renderSettingsTab()}
          </ScrollView>
        )}
      </View>

      {/* ========================================================================= */}
      {/* 4 BOTTOM TABS CHUẨN UX: Tổng quan, Tài khoản, Thực đơn, Cài đặt */}
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
          style={[styles.bottomTabItem, activeBottomTab === 'users' && styles.bottomTabActive]}
          onPress={() => setActiveBottomTab('users')}
        >
          <Text style={styles.bottomIcon}>👥</Text>
          <Text style={[styles.bottomTabLabel, activeBottomTab === 'users' && styles.bottomTabLabelActive]}>
            Tài khoản
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
      {/* MODAL THÊM / SỬA MÓN ĂN MỚI TOÀN DIỆN (3 TABS: CƠ BẢN, KÍCH CỠ/VỊ, DINH DƯỠNG) */}
      {/* ========================================================================= */}
      <Modal visible={modalType === 'addFood'} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '92%', paddingBottom: 16 }]}>
            <View style={styles.modalHeaderWithClose}>
              <Text style={styles.modalHeadingWithClose}>
                {editingFoodId ? '✏️ Chỉnh Sửa Món Ăn' : '🍔 Thêm Món Ăn Mới'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setModalType(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Sub-tabs chuyển đổi giữa 3 mục */}
            <View style={styles.foodModalSubTabsRow}>
              <TouchableOpacity
                style={[styles.foodModalSubTabBtn, foodModalSubTab === 'basic' && styles.foodModalSubTabBtnActive]}
                onPress={() => setFoodModalSubTab('basic')}
              >
                <Text numberOfLines={1} style={[styles.foodModalSubTabText, foodModalSubTab === 'basic' && styles.foodModalSubTabTextActive]}>
                  📝 Cơ bản
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.foodModalSubTabBtn, foodModalSubTab === 'options' && styles.foodModalSubTabBtnActive]}
                onPress={() => setFoodModalSubTab('options')}
              >
                <Text numberOfLines={1} style={[styles.foodModalSubTabText, foodModalSubTab === 'options' && styles.foodModalSubTabTextActive]}>
                  🥤 Kích cỡ & Vị
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.foodModalSubTabBtn, foodModalSubTab === 'nutrition' && styles.foodModalSubTabBtnActive]}
                onPress={() => setFoodModalSubTab('nutrition')}
              >
                <Text numberOfLines={1} style={[styles.foodModalSubTabText, foodModalSubTab === 'nutrition' && styles.foodModalSubTabTextActive]}>
                  🥗 Dinh dưỡng
                </Text>
              </TouchableOpacity>
            </View>

            {loadingFoodDetails ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#E11D48" />
                <Text style={{ marginTop: 10, color: '#64748B' }}>Đang tải cấu hình món ăn...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* ------------------------------------------------------------- */}
                {/* TAB 1: THÔNG TIN CƠ BẢN */}
                {/* ------------------------------------------------------------- */}
                {foodModalSubTab === 'basic' && (
                  <View style={{ paddingTop: 6 }}>
                    <Text style={styles.formFieldLabel}>Tên món ăn (*):</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="VD: Bánh bao truyền thống đặc biệt..."
                      value={foodForm.ten_mon}
                      onChangeText={t => setFoodForm({ ...foodForm, ten_mon: t })}
                    />

                    <Text style={styles.formFieldLabel}>Giá bán VNĐ (*):</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="VD: 35000..."
                      keyboardType="numeric"
                      value={foodForm.gia_ban}
                      onChangeText={t => setFoodForm({ ...foodForm, gia_ban: t })}
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={styles.formFieldLabel}>Thuộc Danh mục (*):</Text>
                      <TouchableOpacity onPress={handleOpenCategoryManager}>
                        <Text style={{ color: '#E11D48', fontWeight: '700', fontSize: 12 }}>+ Thêm Danh Mục Mới</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {categories.map(cat => {
                        const isSelected = String(foodForm.ma_danh_muc) === String(cat.ma_danh_muc);
                        return (
                          <TouchableOpacity
                            key={cat.ma_danh_muc}
                            style={[styles.categorySelectChip, isSelected && styles.categorySelectChipActive]}
                            onPress={() => setFoodForm({ ...foodForm, ma_danh_muc: String(cat.ma_danh_muc) })}
                          >
                            <Text style={[styles.categorySelectText, isSelected && styles.categorySelectTextActive]}>
                              {cat.ten_danh_muc}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <Text style={styles.formFieldLabel}>Mô tả món ăn:</Text>
                    <TextInput
                      style={[styles.modalInput, { height: 65 }]}
                      placeholder="Mô tả hương vị, thành phần nguyên liệu..."
                      multiline
                      value={foodForm.mo_ta}
                      onChangeText={t => setFoodForm({ ...foodForm, mo_ta: t })}
                    />

                    <Text style={styles.formFieldLabel}>Link ảnh món ăn (URL):</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="https://images.unsplash.com/..."
                      value={foodForm.hinh_anh}
                      onChangeText={t => setFoodForm({ ...foodForm, hinh_anh: t })}
                    />
                  </View>
                )}

                {/* ------------------------------------------------------------- */}
                {/* TAB 2: KÍCH CỠ & TÙY CHỌN VỊ (OPTION GROUPS) */}
                {/* ------------------------------------------------------------- */}
                {foodModalSubTab === 'options' && (
                  <View style={{ paddingTop: 6 }}>
                    <Text style={styles.tabSectionGuide}>
                      💡 Tùy biến kích cỡ, sốt, topping... cho món này hoặc tạo nhóm mới phù hợp:
                    </Text>

                    {/* Nút tác vụ nhanh: Tạo nhóm mới & Quản lý */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: '#E11D48', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                        onPress={() => {
                          setInlineOptionGroupForm({
                            visible: !inlineOptionGroupForm.visible,
                            ma_nhom: null,
                            ten_nhom: '',
                            la_bat_buoc: false,
                            chon_toi_da: '1',
                            values: [
                              { ten_gia_tri: 'Cỡ Vừa (M)', gia_tang_them: '0' },
                              { ten_gia_tri: 'Cỡ Lớn (L)', gia_tang_them: '5000' }
                            ]
                          });
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>
                          {inlineOptionGroupForm.visible ? '✕ Đóng Form' : '➕ Tạo Nhóm Tùy Chọn Mới'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, justifyContent: 'center' }]}
                        onPress={() => setShowOptionGroupModal(true)}
                      >
                        <Text style={{ color: '#334155', fontWeight: 'bold', fontSize: 12 }}>⚙️ Tất Cả Nhóm</Text>
                      </TouchableOpacity>
                    </View>

                    {/* FORM TẠO / SỬA NHÓM TÙY CHỌN TRỰC TIẾP (INLINE) */}
                    {inlineOptionGroupForm.visible && (
                      <View style={[styles.categoryFormBox, { borderColor: '#E11D48', backgroundColor: '#FFF5F5', marginBottom: 14 }]}>
                        <Text style={[styles.formSubHeading, { color: '#E11D48' }]}>
                          {inlineOptionGroupForm.ma_nhom ? '✏️ Sửa Nhóm Tùy Chọn' : '➕ Tạo Nhóm Mới (VD: Kích cỡ Bánh bao, Topping Bánh bao...)'}
                        </Text>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="Tên nhóm (VD: Kích cỡ Bánh bao, Topping Bánh bao...)"
                          value={inlineOptionGroupForm.ten_nhom}
                          onChangeText={t => setInlineOptionGroupForm({ ...inlineOptionGroupForm, ten_nhom: t })}
                        />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>Bắt buộc chọn (vd Size):</Text>
                          <Switch
                            value={inlineOptionGroupForm.la_bat_buoc}
                            trackColor={{ false: '#CBD5E1', true: '#FECDD3' }}
                            thumbColor={inlineOptionGroupForm.la_bat_buoc ? '#E11D48' : '#94A3B8'}
                            onValueChange={v => setInlineOptionGroupForm({ ...inlineOptionGroupForm, la_bat_buoc: v })}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                          <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>Số lượng chọn tối đa:</Text>
                          <TextInput
                            style={[styles.modalInput, { width: 60, height: 36, marginBottom: 0, textAlign: 'center' }]}
                            keyboardType="numeric"
                            value={String(inlineOptionGroupForm.chon_toi_da)}
                            onChangeText={t => setInlineOptionGroupForm({ ...inlineOptionGroupForm, chon_toi_da: t })}
                          />
                        </View>

                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6 }}>
                          Các lựa chọn con & Phụ thu VNĐ:
                        </Text>
                        {(inlineOptionGroupForm.values || []).map((val, vIdx) => (
                          <View key={vIdx} style={{ flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                            <TextInput
                              style={[styles.modalInput, { flex: 2, height: 36, marginBottom: 0, fontSize: 12 }]}
                              placeholder="Tên lựa chọn (VD: Trứng cút, Cỡ L...)"
                              value={val.ten_gia_tri}
                              onChangeText={t => {
                                const updated = [...inlineOptionGroupForm.values];
                                updated[vIdx].ten_gia_tri = t;
                                setInlineOptionGroupForm({ ...inlineOptionGroupForm, values: updated });
                              }}
                            />
                            <TextInput
                              style={[styles.modalInput, { flex: 1.2, height: 36, marginBottom: 0, fontSize: 12 }]}
                              placeholder="Phụ thu (VD: 5000)"
                              keyboardType="numeric"
                              value={String(val.gia_tang_them || '0')}
                              onChangeText={t => {
                                const updated = [...inlineOptionGroupForm.values];
                                updated[vIdx].gia_tang_them = t;
                                setInlineOptionGroupForm({ ...inlineOptionGroupForm, values: updated });
                              }}
                            />
                            <TouchableOpacity
                              onPress={() => {
                                setInlineOptionGroupForm({
                                  ...inlineOptionGroupForm,
                                  values: inlineOptionGroupForm.values.filter((_, i) => i !== vIdx)
                                });
                              }}
                            >
                              <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 14 }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}

                        <TouchableOpacity
                          style={{ paddingVertical: 6 }}
                          onPress={() => {
                            setInlineOptionGroupForm({
                              ...inlineOptionGroupForm,
                              values: [...inlineOptionGroupForm.values, { ten_gia_tri: '', gia_tang_them: '0' }]
                            });
                          }}
                        >
                          <Text style={{ color: '#E11D48', fontWeight: '700', fontSize: 12 }}>+ Thêm Lựa Chọn Con</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                          <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: '#E2E8F0' }]}
                            onPress={() => setInlineOptionGroupForm({ visible: false, ma_nhom: null, ten_nhom: '', la_bat_buoc: false, chon_toi_da: '1', values: [] })}
                          >
                            <Text style={{ color: '#475569', fontWeight: 'bold' }}>Hủy</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: '#E11D48' }]}
                            onPress={handleSaveInlineOptionGroup}
                            disabled={savingInlineOptionGroup}
                          >
                            {savingInlineOptionGroup ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                                {inlineOptionGroupForm.ma_nhom ? '💾 Cập Nhật Nhóm' : '+ Lưu & Áp Dụng Cho Món'}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Danh sách các nhóm tùy chọn */}
                    {optionGroups.length === 0 ? (
                      <Text style={{ color: '#94A3B8', fontStyle: 'italic', marginVertical: 15 }}>
                        Chưa có nhóm tùy chọn nào trong hệ thống. Nhấn nút phía trên để tạo!
                      </Text>
                    ) : (
                      optionGroups.map(grp => {
                        const isChecked = foodForm.ma_nhom_list.includes(grp.ma_nhom);
                        return (
                          <View key={grp.ma_nhom} style={[styles.optionGroupCard, isChecked && styles.optionGroupCardActive]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={styles.optionGroupCardTitle}>{grp.ten_nhom}</Text>
                                <Text style={styles.optionGroupCardSub}>
                                  {grp.la_bat_buoc ? '⚠️ Bắt buộc chọn' : 'Tùy chọn tự do'} • Tối đa {grp.chon_toi_da} lựa chọn
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity
                                  style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}
                                  onPress={() => {
                                    setInlineOptionGroupForm({
                                      visible: true,
                                      ma_nhom: grp.ma_nhom,
                                      ten_nhom: grp.ten_nhom,
                                      la_bat_buoc: !!grp.la_bat_buoc,
                                      chon_toi_da: String(grp.chon_toi_da),
                                      values: (grp.values || []).map(v => ({
                                        ma_gia_tri: v.ma_gia_tri,
                                        ten_gia_tri: v.ten_gia_tri,
                                        gia_tang_them: String(v.gia_tang_them || 0)
                                      }))
                                    });
                                  }}
                                >
                                  <Text style={{ color: '#1D4ED8', fontSize: 11, fontWeight: '700' }}>✏️ Sửa</Text>
                                </TouchableOpacity>
                                <Switch
                                  value={isChecked}
                                  trackColor={{ false: '#CBD5E1', true: '#FECDD3' }}
                                  thumbColor={isChecked ? '#E11D48' : '#94A3B8'}
                                  onValueChange={(val) => {
                                    if (val) {
                                      setFoodForm({
                                        ...foodForm,
                                        ma_nhom_list: [...foodForm.ma_nhom_list, grp.ma_nhom]
                                      });
                                    } else {
                                      setFoodForm({
                                        ...foodForm,
                                        ma_nhom_list: foodForm.ma_nhom_list.filter(id => id !== grp.ma_nhom)
                                      });
                                    }
                                  }}
                                />
                              </View>
                            </View>

                            {/* Danh sách lựa chọn con bên trong nhóm */}
                            <View style={styles.optionGroupValuesPreview}>
                              {(grp.values || []).map(val => (
                                <View key={val.ma_gia_tri} style={styles.optionValueTag}>
                                  <Text style={styles.optionValueTagText}>
                                    {val.ten_gia_tri} {parseFloat(val.gia_tang_them) > 0 ? `(+${parseFloat(val.gia_tang_them).toLocaleString('vi-VN')}đ)` : '(+0đ)'}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* ------------------------------------------------------------- */}
                {/* TAB 3: TÙY BIẾN DINH DƯỠNG (NUTRITION RECIPE) */}
                {/* ------------------------------------------------------------- */}
                {foodModalSubTab === 'nutrition' && (
                  <View style={{ paddingTop: 6 }}>
                    <Text style={styles.tabSectionGuide}>
                      🥗 Định lượng nguyên liệu và cho phép khách hàng tùy biến tăng/giảm/bỏ khi đặt:
                    </Text>

                    {/* Tổng quan dinh dưỡng của 1 khẩu phần mặc định */}
                    {(() => {
                      const totalCalo = foodForm.nguyen_lieu_list.reduce((s, i) => s + (i.calo || 0) * (i.so_luong_mac_dinh || 0), 0);
                      const totalProtein = foodForm.nguyen_lieu_list.reduce((s, i) => s + (i.protein || 0) * (i.so_luong_mac_dinh || 0), 0);
                      const totalCarbs = foodForm.nguyen_lieu_list.reduce((s, i) => s + (i.carbs || 0) * (i.so_luong_mac_dinh || 0), 0);
                      const totalFat = foodForm.nguyen_lieu_list.reduce((s, i) => s + (i.fat || 0) * (i.so_luong_mac_dinh || 0), 0);

                      return (
                        <View style={styles.nutritionSummaryBox}>
                          <Text style={styles.nutritionSummaryTitle}>📊 Ước tính 1 khẩu phần mặc định:</Text>
                          <View style={styles.nutritionSummaryRow}>
                            <Text style={styles.nutritionSummaryStat}>🔥 {Math.round(totalCalo)} kcal</Text>
                            <Text style={styles.nutritionSummaryStat}>🥩 Đạm: {Math.round(totalProtein)}g</Text>
                            <Text style={styles.nutritionSummaryStat}>🍞 Carb: {Math.round(totalCarbs)}g</Text>
                            <Text style={styles.nutritionSummaryStat}>🥑 Béo: {Math.round(totalFat)}g</Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Nút thêm nguyên liệu & Tạo mới */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8 }}>
                      <Text style={styles.formFieldLabel}>+ Thêm nguyên liệu vào món:</Text>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: '#059669', paddingVertical: 4, paddingHorizontal: 10 }]}
                        onPress={() => {
                          setInlineIngredientForm({
                            visible: !inlineIngredientForm.visible,
                            ma_nguyen_lieu: null,
                            ten_nguyen_lieu: '',
                            don_vi_tinh: 'phần',
                            calo: '100',
                            protein: '5',
                            carbs: '10',
                            fat: '2',
                            don_gia_thay_doi: '5000'
                          });
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 11 }}>
                          {inlineIngredientForm.visible ? '✕ Đóng Form' : '➕ Tạo Nguyên Liệu Mới'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* FORM TẠO / SỬA NGUYÊN LIỆU MỚI (INLINE) */}
                    {inlineIngredientForm.visible && (
                      <View style={[styles.categoryFormBox, { borderColor: '#10B981', backgroundColor: '#F0FDF4', marginBottom: 12 }]}>
                        <Text style={[styles.formSubHeading, { color: '#059669' }]}>
                          {inlineIngredientForm.ma_nguyen_lieu ? '✏️ Sửa Nguyên Liệu' : '🥗 Tạo Nguyên Liệu Mới (VD: Bột bánh bao, Trứng cút...)'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                          <TextInput
                            style={[styles.modalInput, { flex: 2, marginBottom: 0 }]}
                            placeholder="Tên nguyên liệu (*)"
                            value={inlineIngredientForm.ten_nguyen_lieu}
                            onChangeText={t => setInlineIngredientForm({ ...inlineIngredientForm, ten_nguyen_lieu: t })}
                          />
                          <TextInput
                            style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                            placeholder="Đơn vị (cái/g)"
                            value={inlineIngredientForm.don_vi_tinh}
                            onChangeText={t => setInlineIngredientForm({ ...inlineIngredientForm, don_vi_tinh: t })}
                          />
                        </View>

                        {/* 4 Chỉ số dinh dưỡng: Calo, Đạm, Carb, Béo */}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                          Chỉ số dinh dưỡng / 1 đơn vị:
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, color: '#64748B' }}>🔥 Calo (kcal)</Text>
                            <TextInput
                              style={[styles.modalInput, { height: 36, fontSize: 12, marginBottom: 0, textAlign: 'center' }]}
                              keyboardType="numeric"
                              value={String(inlineIngredientForm.calo)}
                              onChangeText={t => setInlineIngredientForm({ ...inlineIngredientForm, calo: t })}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, color: '#64748B' }}>🥩 Đạm (g)</Text>
                            <TextInput
                              style={[styles.modalInput, { height: 36, fontSize: 12, marginBottom: 0, textAlign: 'center' }]}
                              keyboardType="numeric"
                              value={String(inlineIngredientForm.protein)}
                              onChangeText={t => setInlineIngredientForm({ ...inlineIngredientForm, protein: t })}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, color: '#64748B' }}>🍞 Carb (g)</Text>
                            <TextInput
                              style={[styles.modalInput, { height: 36, fontSize: 12, marginBottom: 0, textAlign: 'center' }]}
                              keyboardType="numeric"
                              value={String(inlineIngredientForm.carbs)}
                              onChangeText={t => setInlineIngredientForm({ ...inlineIngredientForm, carbs: t })}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, color: '#64748B' }}>🥑 Béo (g)</Text>
                            <TextInput
                              style={[styles.modalInput, { height: 36, fontSize: 12, marginBottom: 0, textAlign: 'center' }]}
                              keyboardType="numeric"
                              value={String(inlineIngredientForm.fat)}
                              onChangeText={t => setInlineIngredientForm({ ...inlineIngredientForm, fat: t })}
                            />
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>Phụ thu khi khách thêm:</Text>
                          <TextInput
                            style={[styles.modalInput, { flex: 1, height: 36, fontSize: 12, marginBottom: 0 }]}
                            placeholder="VD: 5000đ"
                            keyboardType="numeric"
                            value={String(inlineIngredientForm.don_gia_thay_doi)}
                            onChangeText={t => setInlineIngredientForm({ ...inlineIngredientForm, don_gia_thay_doi: t })}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                          <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: '#E2E8F0' }]}
                            onPress={() => setInlineIngredientForm({ visible: false, ma_nguyen_lieu: null, ten_nguyen_lieu: '', don_vi_tinh: 'phần', calo: '100', protein: '5', carbs: '10', fat: '2', don_gia_thay_doi: '5000' })}
                          >
                            <Text style={{ color: '#475569', fontWeight: 'bold' }}>Hủy</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: '#059669' }]}
                            onPress={handleSaveInlineIngredient}
                            disabled={savingIngredient}
                          >
                            {savingIngredient ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                                {inlineIngredientForm.ma_nguyen_lieu ? '💾 Lưu Cập Nhật' : '➕ Lưu & Thêm Vào Món'}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Danh sách các nguyên liệu chưa thêm để chọn thêm */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {ingredients
                        .filter(ing => !foodForm.nguyen_lieu_list.some(item => item.ma_nguyen_lieu === ing.ma_nguyen_lieu))
                        .map(ing => (
                          <TouchableOpacity
                            key={ing.ma_nguyen_lieu}
                            style={styles.addIngChip}
                            onPress={() => {
                              setFoodForm({
                                ...foodForm,
                                nguyen_lieu_list: [
                                  ...foodForm.nguyen_lieu_list,
                                  {
                                    ma_nguyen_lieu: ing.ma_nguyen_lieu,
                                    ten_nguyen_lieu: ing.ten_nguyen_lieu,
                                    don_vi_tinh: ing.don_vi_tinh,
                                    so_luong_mac_dinh: 1,
                                    co_the_tuy_bien: true,
                                    so_luong_toi_da: 3,
                                    calo: parseFloat(ing.calo || 0),
                                    protein: parseFloat(ing.protein || 0),
                                    carbs: parseFloat(ing.carbs || 0),
                                    fat: parseFloat(ing.fat || 0),
                                    don_gia_thay_doi: parseFloat(ing.don_gia_thay_doi || 0)
                                  }
                                ]
                              });
                            }}
                          >
                            <Text style={styles.addIngChipText}>+ {ing.ten_nguyen_lieu}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Danh sách nguyên liệu đã cấu hình trong món */}
                    {foodForm.nguyen_lieu_list.map((nl, idx) => (
                      <View key={nl.ma_nguyen_lieu} style={styles.ingredientRowCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ingredientCardName}>
                              🌿 {nl.ten_nguyen_lieu} ({nl.don_vi_tinh})
                            </Text>
                            <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '600', marginTop: 2 }}>
                              🔥 {Math.round(nl.calo || 0)} kcal • 🥩 {Math.round(nl.protein || 0)}g • 🍞 {Math.round(nl.carbs || 0)}g • 🥑 {Math.round(nl.fat || 0)}g {parseFloat(nl.don_gia_thay_doi) > 0 ? `• +${parseFloat(nl.don_gia_thay_doi).toLocaleString('vi-VN')}đ` : ''}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <TouchableOpacity
                              style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}
                              onPress={() => {
                                setInlineIngredientForm({
                                  visible: true,
                                  ma_nguyen_lieu: nl.ma_nguyen_lieu,
                                  ten_nguyen_lieu: nl.ten_nguyen_lieu,
                                  don_vi_tinh: nl.don_vi_tinh || 'phần',
                                  calo: String(nl.calo || 0),
                                  protein: String(nl.protein || 0),
                                  carbs: String(nl.carbs || 0),
                                  fat: String(nl.fat || 0),
                                  don_gia_thay_doi: String(nl.don_gia_thay_doi || 0)
                                });
                              }}
                            >
                              <Text style={{ color: '#1D4ED8', fontSize: 11, fontWeight: '700' }}>✏️ Sửa</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setFoodForm({
                                  ...foodForm,
                                  nguyen_lieu_list: foodForm.nguyen_lieu_list.filter((_, i) => i !== idx)
                                });
                              }}
                            >
                              <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 13 }}>🗑️ Bỏ</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Định lượng mặc định */}
                        <View style={styles.ingControlRow}>
                          <Text style={styles.ingControlLabel}>Số lượng chuẩn:</Text>
                          <View style={styles.stepperRow}>
                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => {
                                const nextVal = Math.max(0, nl.so_luong_mac_dinh - 1);
                                const updated = [...foodForm.nguyen_lieu_list];
                                updated[idx].so_luong_mac_dinh = nextVal;
                                setFoodForm({ ...foodForm, nguyen_lieu_list: updated });
                              }}
                            >
                              <Text style={styles.stepperBtnText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.stepperValText}>{nl.so_luong_mac_dinh}</Text>
                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => {
                                const updated = [...foodForm.nguyen_lieu_list];
                                updated[idx].so_luong_mac_dinh = nl.so_luong_mac_dinh + 1;
                                setFoodForm({ ...foodForm, nguyen_lieu_list: updated });
                              }}
                            >
                              <Text style={styles.stepperBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Cho phép khách tùy biến */}
                        <View style={styles.ingControlRow}>
                          <Text style={styles.ingControlLabel}>Khách được tùy biến (bỏ/thêm):</Text>
                          <Switch
                            value={!!nl.co_the_tuy_bien}
                            trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                            thumbColor={nl.co_the_tuy_bien ? '#10B981' : '#94A3B8'}
                            onValueChange={(val) => {
                              const updated = [...foodForm.nguyen_lieu_list];
                              updated[idx].co_the_tuy_bien = val;
                              setFoodForm({ ...foodForm, nguyen_lieu_list: updated });
                            }}
                          />
                        </View>

                        {/* Tối đa khách được thêm */}
                        {nl.co_the_tuy_bien && (
                          <View style={styles.ingControlRow}>
                            <Text style={styles.ingControlLabel}>Tối đa khách được tăng:</Text>
                            <View style={styles.stepperRow}>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => {
                                  const nextVal = Math.max(1, nl.so_luong_toi_da - 1);
                                  const updated = [...foodForm.nguyen_lieu_list];
                                  updated[idx].so_luong_toi_da = nextVal;
                                  setFoodForm({ ...foodForm, nguyen_lieu_list: updated });
                                }}
                              >
                                <Text style={styles.stepperBtnText}>-</Text>
                              </TouchableOpacity>
                              <Text style={styles.stepperValText}>{nl.so_luong_toi_da}</Text>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => {
                                  const updated = [...foodForm.nguyen_lieu_list];
                                  updated[idx].so_luong_toi_da = nl.so_luong_toi_da + 1;
                                  setFoodForm({ ...foodForm, nguyen_lieu_list: updated });
                                }}
                              >
                                <Text style={styles.stepperBtnText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            {/* Footer Buttons */}
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSubmitBtn} 
                onPress={handleSaveFood} 
                disabled={submitting || loadingFoodDetails}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>{editingFoodId ? 'Cập Nhật Món' : 'Lưu Món Mới'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL QUẢN LÝ DANH MỤC MÓN ĂN (CRUD DANH MỤC) */}
      {/* ========================================================================= */}
      <Modal visible={showCategoryModal} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeaderWithClose}>
              <Text style={styles.modalHeadingWithClose}>📁 Quản Lý Danh Mục Món Ăn</Text>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setShowCategoryModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Form tạo mới hoặc chỉnh sửa danh mục */}
            <View style={styles.categoryFormBox}>
              <Text style={styles.formSubHeading}>
                {categoryForm.ma_danh_muc ? '✏️ Cập Nhật Danh Mục' : '+ Thêm Danh Mục Mới'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Tên danh mục (VD: Burgers, Trà Sữa...)"
                value={categoryForm.ten_danh_muc}
                onChangeText={t => setCategoryForm({ ...categoryForm, ten_danh_muc: t })}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Mô tả danh mục..."
                value={categoryForm.mo_ta}
                onChangeText={t => setCategoryForm({ ...categoryForm, mo_ta: t })}
              />
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                {categoryForm.ma_danh_muc && (
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: '#F1F5F9' }]}
                    onPress={() => setCategoryForm({ ma_danh_muc: null, ten_danh_muc: '', mo_ta: '' })}
                  >
                    <Text style={{ color: '#475569', fontWeight: 'bold' }}>Hủy sửa</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: '#E11D48' }]}
                  onPress={handleSaveCategory}
                  disabled={savingCategory}
                >
                  {savingCategory ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                      {categoryForm.ma_danh_muc ? '💾 Lưu Sửa' : '+ Tạo Mới'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Danh sách các danh mục hiện có */}
            <Text style={[styles.formFieldLabel, { marginTop: 12 }]}>
              Danh sách danh mục hiện có ({categories.length}):
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
              {categories.map(cat => (
                <View key={cat.ma_danh_muc} style={styles.categoryItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryItemTitle}>📁 {cat.ten_danh_muc}</Text>
                    <Text style={styles.categoryItemDesc} numberOfLines={1}>
                      {cat.mo_ta || 'Chưa có mô tả'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.miniActionEditBtn}
                      onPress={() => setCategoryForm({
                        ma_danh_muc: cat.ma_danh_muc,
                        ten_danh_muc: cat.ten_danh_muc,
                        mo_ta: cat.mo_ta || ''
                      })}
                    >
                      <Text style={styles.miniActionEditText}>Sửa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.miniActionDeleteBtn}
                      onPress={() => handleDeleteCategory(cat)}
                    >
                      <Text style={styles.miniActionDeleteText}>Xóa</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.modalCancelBtn, { marginTop: 14, width: '100%' }]}
              onPress={() => setShowCategoryModal(false)}
            >
              <Text style={styles.modalCancelText}>Đóng Cửa Sổ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL QUẢN LÝ NHÓM TÙY CHỌN (KÍCH CỠ & TÙY CHỌN VỊ) */}
      {/* ========================================================================= */}
      <Modal visible={showOptionGroupModal} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '92%' }]}>
            <View style={styles.modalHeaderWithClose}>
              <Text style={styles.modalHeadingWithClose}>⚙️ Quản Lý Kích Cỡ & Tùy Chọn Vị</Text>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setShowOptionGroupModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Form tạo mới hoặc cập nhật nhóm */}
            <View style={styles.categoryFormBox}>
              <Text style={styles.formSubHeading}>
                {optionGroupForm.ma_nhom ? '✏️ Sửa Nhóm Tùy Chọn' : '+ Tạo Nhóm Tùy Chọn Mới'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Tên nhóm (VD: Kích cỡ Size, Vị Gà rán...)"
                value={optionGroupForm.ten_nhom}
                onChangeText={t => setOptionGroupForm({ ...optionGroupForm, ten_nhom: t })}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '500' }}>Bắt buộc khách phải chọn:</Text>
                <Switch
                  value={optionGroupForm.la_bat_buoc}
                  trackColor={{ false: '#CBD5E1', true: '#FECDD3' }}
                  thumbColor={optionGroupForm.la_bat_buoc ? '#E11D48' : '#94A3B8'}
                  onValueChange={v => setOptionGroupForm({ ...optionGroupForm, la_bat_buoc: v })}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                <Text style={{ fontSize: 13, color: '#334155', fontWeight: '500' }}>Số lượng chọn tối đa:</Text>
                <TextInput
                  style={[styles.modalInput, { width: 60, height: 36, marginBottom: 0, textAlign: 'center' }]}
                  keyboardType="numeric"
                  value={String(optionGroupForm.chon_toi_da)}
                  onChangeText={t => setOptionGroupForm({ ...optionGroupForm, chon_toi_da: t })}
                />
              </View>

              {/* Danh sách lựa chọn con trong nhóm */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6 }}>
                Các lựa chọn con (Size S/M/L, Vị truyền thống, Sốt cay...):
              </Text>
              {(optionGroupForm.values || []).map((val, vIdx) => (
                <View key={vIdx} style={{ flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.modalInput, { flex: 2, height: 36, marginBottom: 0, fontSize: 12 }]}
                    placeholder="Tên lựa chọn (VD: Cỡ L)"
                    value={val.ten_gia_tri}
                    onChangeText={t => {
                      const updated = [...optionGroupForm.values];
                      updated[vIdx].ten_gia_tri = t;
                      setOptionGroupForm({ ...optionGroupForm, values: updated });
                    }}
                  />
                  <TextInput
                    style={[styles.modalInput, { flex: 1.2, height: 36, marginBottom: 0, fontSize: 12 }]}
                    placeholder="Phụ thu (VD: 5000)"
                    keyboardType="numeric"
                    value={String(val.gia_tang_them || '0')}
                    onChangeText={t => {
                      const updated = [...optionGroupForm.values];
                      updated[vIdx].gia_tang_them = t;
                      setOptionGroupForm({ ...optionGroupForm, values: updated });
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setOptionGroupForm({
                        ...optionGroupForm,
                        values: optionGroupForm.values.filter((_, i) => i !== vIdx)
                      });
                    }}
                  >
                    <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={{ paddingVertical: 6 }}
                onPress={() => {
                  setOptionGroupForm({
                    ...optionGroupForm,
                    values: [...optionGroupForm.values, { ten_gia_tri: '', gia_tang_them: 0 }]
                  });
                }}
              >
                <Text style={{ color: '#E11D48', fontWeight: '700', fontSize: 12 }}>+ Thêm Lựa Chọn Con</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                {optionGroupForm.ma_nhom && (
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: '#F1F5F9' }]}
                    onPress={() => setOptionGroupForm({ ma_nhom: null, ten_nhom: '', la_bat_buoc: false, chon_toi_da: '1', values: [] })}
                  >
                    <Text style={{ color: '#475569', fontWeight: 'bold' }}>Hủy sửa</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: '#7C3AED' }]}
                  onPress={handleSaveOptionGroup}
                  disabled={savingOptionGroup}
                >
                  {savingOptionGroup ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                      {optionGroupForm.ma_nhom ? '💾 Lưu Sửa' : '+ Tạo Nhóm'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Danh sách các nhóm hiện có */}
            <Text style={[styles.formFieldLabel, { marginTop: 12 }]}>
              Nhóm tùy chọn hiện có ({optionGroups.length}):
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
              {optionGroups.map(grp => (
                <View key={grp.ma_nhom} style={styles.categoryItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryItemTitle}>⚙️ {grp.ten_nhom}</Text>
                    <Text style={styles.categoryItemDesc}>
                      {grp.la_bat_buoc ? 'Bắt buộc' : 'Tùy chọn'} • Tối đa {grp.chon_toi_da} • {(grp.values || []).length} giá trị
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.miniActionEditBtn}
                      onPress={() => setOptionGroupForm({
                        ma_nhom: grp.ma_nhom,
                        ten_nhom: grp.ten_nhom,
                        la_bat_buoc: grp.la_bat_buoc,
                        chon_toi_da: String(grp.chon_toi_da),
                        values: (grp.values || []).map(v => ({ ten_gia_tri: v.ten_gia_tri, gia_tang_them: v.gia_tang_them }))
                      })}
                    >
                      <Text style={styles.miniActionEditText}>Sửa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.miniActionDeleteBtn}
                      onPress={() => handleDeleteOptionGroup(grp)}
                    >
                      <Text style={styles.miniActionDeleteText}>Xóa</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.modalCancelBtn, { marginTop: 14, width: '100%' }]}
              onPress={() => setShowOptionGroupModal(false)}
            >
              <Text style={styles.modalCancelText}>Đóng Cửa Sổ</Text>
            </TouchableOpacity>
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
                  desc: 'Nhận và giao đơn hàng cho khách'
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

            {/* CẢNH BÁO PHÂN QUYỀN */}
            <View style={styles.securityWarningBox}>
              <Text style={styles.securityWarningIcon}>🔒</Text>
              <Text style={styles.securityWarningText}>
                Không thể cấp quyền Quản trị viên (Admin) cho các tài khoản khác.
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 12,
    paddingBottom: 12,
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
  miniValTag: {
    marginBottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 5,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
  },
  miniValText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
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
  verticalFillBarActive: {
    backgroundColor: '#8B5CF6',
  },
  verticalFillBarSelected: {
    backgroundColor: '#6A1B9A',
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
  chartDotActive: {
    backgroundColor: '#6D28D9',
    borderColor: '#FFFFFF',
    width: 16,
    height: 16,
    borderRadius: 8,
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
  hourLabelHasData: {
    color: '#7C3AED',
    fontWeight: '800',
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
  accordionHeaderBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  accordionTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  accordionExpandBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE7F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  accordionExpandIcon: {
    fontSize: 12,
    color: '#6A1B9A',
    fontWeight: '900',
  },
  accordionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  accordionChevron: {
    fontSize: 14,
    color: '#6A1B9A',
    fontWeight: '800',
  },
  groupHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  groupActionAddBtn: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
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
    height: 46,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#64748B',
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#6A1B9A',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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

  // =========================================================================
  // STYLES QUẢN TRỊ THỰC ĐƠN, DANH MỤC, KÍCH CỠ & DINH DƯỠNG
  // =========================================================================
  modalHeaderWithClose: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeadingWithClose: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  modalCloseIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalCloseIconText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#64748B',
  },

  adminToolRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  adminToolBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminToolBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  foodCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginVertical: 4,
  },
  foodCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  foodActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  foodActionEditBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  foodActionEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E11D48',
  },
  foodActionDeleteBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  foodActionDeleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  // Sub-tabs in food modal
  foodModalSubTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  foodModalSubTabBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  foodModalSubTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  foodModalSubTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  foodModalSubTabTextActive: {
    color: '#E11D48',
    fontWeight: '800',
  },

  // Category select chip inside modal
  categorySelectChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  categorySelectChipActive: {
    backgroundColor: '#FFE4E6',
    borderColor: '#E11D48',
  },
  categorySelectText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  categorySelectTextActive: {
    color: '#E11D48',
    fontWeight: '800',
  },
  tabSectionGuide: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
  },

  // Option group cards in modal
  optionGroupCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  optionGroupCardActive: {
    borderColor: '#FECDD3',
    backgroundColor: '#FFF1F2',
  },
  optionGroupCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  optionGroupCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  optionGroupValuesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  optionValueTag: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  optionValueTagText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
  },

  // Nutrition summary & recipe builder
  nutritionSummaryBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  nutritionSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 6,
  },
  nutritionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  nutritionSummaryStat: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  addIngChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
  },
  addIngChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  ingredientRowCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  ingredientCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  ingControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  ingControlLabel: {
    fontSize: 12,
    color: '#475569',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#F1F5F9',
  },
  stepperBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  stepperValText: {
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },

  // Category and Option Group Managers
  categoryFormBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  formSubHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  categoryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  categoryItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoryItemDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  miniActionEditBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniActionEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  miniActionDeleteBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniActionDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E11D48',
  },
});
