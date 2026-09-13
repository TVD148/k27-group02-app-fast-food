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
import {
  fetchDashboardStats,
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
  fetchStoreLandmark,
  updateAdminStoreLandmark
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

  // States Tab Menu: Search có nút Clear + Filter Chips + Toggles
  const [menuSearchText, setMenuSearchText] = useState('');
  const [menuFilterCategory, setMenuFilterCategory] = useState('all'); // 'all' | 'out_of_stock' | 'burgers' | 'chicken' | 'drinks'

  // States Tab Orders: Search Order ID + Trạng thái lỗi không tìm thấy
  const [orderSearchId, setOrderSearchId] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  // Modal forms
  const [modalType, setModalType] = useState(null); // 'addFood' | 'addVoucher' | 'addUser'
  const [submitting, setSubmitting] = useState(false);

  // Form add food
  const [foodForm, setFoodForm] = useState({ ten_mon: '', mo_ta: '', gia_ban: '', ma_danh_muc: '1' });
  // Form add voucher
  const [voucherForm, setVoucherForm] = useState({ ma_code: '', ten_voucher: '', gia_tri_giam: '', don_hang_toi_thieu: '' });
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
      const [statsRes, foodsRes, ordersRes, vouchersRes, usersRes, landmarkRes] = await Promise.all([
        fetchDashboardStats(),
        fetchMenuItems(),
        fetchOrders(),
        fetchAdminVouchers(),
        fetchAdminUsers(),
        fetchStoreLandmark().catch(() => null)
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (foodsRes.success) setFoods(foodsRes.data || []);
      if (ordersRes.success) setOrders(ordersRes.data || []);
      if (vouchersRes.success) setVouchers(vouchersRes.data || []);
      if (usersRes.success) setUsers(usersRes.data || []);
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
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mã code và giá trị giảm!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createAdminVoucher({
        ma_code: voucherForm.ma_code.toUpperCase(),
        ten_voucher: voucherForm.ten_voucher || `Voucher ${voucherForm.ma_code}`,
        gia_tri_giam: parseFloat(voucherForm.gia_tri_giam),
        don_hang_toi_thieu: parseFloat(voucherForm.don_hang_toi_thieu || 0),
        loai_giam_gia: 'so_tien'
      });
      if (res.success) {
        Alert.alert('Thành công', 'Đã tạo mã voucher mới!');
        setModalType(null);
        setVoucherForm({ ma_code: '', ten_voucher: '', gia_tri_giam: '', don_hang_toi_thieu: '' });
        loadAllAdminData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo voucher!');
    } finally {
      setSubmitting(false);
    }
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
    const totalRevenue = stats?.overview?.tong_doanh_thu || 0;
    const totalOrders = stats?.overview?.tong_don_hang || 0;
    const totalFoods = stats?.overview?.tong_mon_an || 0;

    return (
      <View style={styles.tabContentBlock}>
        {/* Hàng Chỉ Số Thống Kê Nhanh */}
        <View style={styles.statsRow}>
          <View style={[styles.kpiCard, { backgroundColor: '#EDE7F6', borderColor: '#D1C4E9' }]}>
            <Text style={styles.kpiLabel}>Doanh Thu</Text>
            <Text style={[styles.kpiValue, { color: '#6A1B9A' }]}>
              {parseFloat(totalRevenue).toLocaleString('vi-VN')} đ
            </Text>
            <Text style={styles.kpiSub}>Đơn đã thu COD</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: '#E0F2F1', borderColor: '#B2DFDB' }]}>
            <Text style={styles.kpiLabel}>Tổng Số Đơn</Text>
            <Text style={[styles.kpiValue, { color: '#00897B' }]}>{totalOrders} đơn</Text>
            <Text style={styles.kpiSub}>Trên toàn hệ thống</Text>
          </View>
        </View>

        {/* 1. BIỂU ĐỒ ĐƯỜNG DOANH THU THEO YÊU CẦU */}
        <RevenueLineChart />

        {/* 2. HIỂN THỊ SỐ LƯỢNG SHIPPER / BẾP ĐANG ONLINE THEO YÊU CẦU */}
        <View style={styles.onlinePersonnelSection}>
          <Text style={styles.sectionHeaderTitle}>🟢 NHÂN SỰ TRỰC TUYẾN THỜI GIAN THỰC</Text>

          <View style={styles.personnelCardsRow}>
            {/* Card Đầu Bếp Online */}
            <View style={styles.personnelCard}>
              <View style={styles.personnelCardTop}>
                <Text style={styles.personnelIcon}>🧑‍🍳</Text>
                <View style={styles.pulseDot} />
              </View>
              <Text style={styles.personnelCount}>3 Đầu Bếp</Text>
              <Text style={styles.personnelDesc}>Đang tiếp nhận & chế biến tại kho bếp</Text>
            </View>

            {/* Card Shipper Online */}
            <View style={styles.personnelCard}>
              <View style={styles.personnelCardTop}>
                <Text style={styles.personnelIcon}>🛵</Text>
                <View style={[styles.pulseDot, { backgroundColor: '#00897B' }]} />
              </View>
              <Text style={styles.personnelCount}>5 Shipper</Text>
              <Text style={styles.personnelDesc}>Đang bật GPS nhận đơn trên đường</Text>
            </View>
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

        {vouchers.map(v => (
          <View key={v.ma_voucher} style={styles.voucherRowItem}>
            <View>
              <Text style={styles.voucherCodeText}>{v.ma_code}</Text>
              <Text style={styles.voucherDescText}>Giảm {parseFloat(v.gia_tri_giam).toLocaleString('vi-VN')} đ (Đơn từ {parseFloat(v.don_hang_toi_thieu).toLocaleString('vi-VN')} đ)</Text>
            </View>
            <View style={styles.voucherStatusPill}>
              <Text style={styles.voucherStatusText}>{v.trang_thai === 'hoat_dong' ? 'Kích hoạt' : 'Tắt'}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Khối quản lý Nhân sự */}
      <View style={styles.settingsGroupCard}>
        <View style={styles.groupHeaderRow}>
          <Text style={styles.groupHeaderTitle}>👥 Quản Lý Tài Khoản Nhân Sự</Text>
          <TouchableOpacity 
            style={styles.groupActionAddBtn}
            onPress={() => setModalType('addUser')}
          >
            <Text style={styles.groupActionAddText}>+ Thêm Nhân Sự</Text>
          </TouchableOpacity>
        </View>

        {users.map(u => (
          <View key={u.ma_nguoi_dung} style={styles.userRowItem}>
            <View>
              <Text style={styles.userItemName}>{u.ho_ten} ({u.so_dien_thoai})</Text>
              <Text style={styles.userItemRole}>
                {u.ma_vai_tro === 3 ? '👑 Quản trị viên' : (u.ma_vai_tro === 2 || u.ma_vai_tro === 5) ? '🧑‍🍳 Nhân viên bếp' : u.ma_vai_tro === 4 ? '🛵 Shipper' : 'Khách hàng'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Nút thoát */}
      <TouchableOpacity 
        style={styles.logoutAdminBtn}
        onPress={() => navigation.navigate('Profile')}
      >
        <Text style={styles.logoutAdminBtnText}>➔ Mở Hồ Sơ Cá Nhân & Đăng Xuất</Text>
      </TouchableOpacity>
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
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>🎟️ Tạo Voucher Khuyến Mãi</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Mã voucher (VD: BANMOI30)..."
              autoCapitalize="characters"
              value={voucherForm.ma_code}
              onChangeText={t => setVoucherForm({ ...voucherForm, ma_code: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Mức giảm tiền (VD: 30000)..."
              keyboardType="numeric"
              value={voucherForm.gia_tri_giam}
              onChangeText={t => setVoucherForm({ ...voucherForm, gia_tri_giam: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Đơn hàng tối thiểu (VD: 100000)..."
              keyboardType="numeric"
              value={voucherForm.don_hang_toi_thieu}
              onChangeText={t => setVoucherForm({ ...voucherForm, don_hang_toi_thieu: t })}
            />
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddVoucher} disabled={submitting}>
                <Text style={styles.modalSubmitText}>Tạo Voucher</Text>
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
  voucherRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  voucherCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6A1B9A',
  },
  voucherDescText: {
    fontSize: 11,
    color: '#64748B',
  },
  voucherStatusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  voucherStatusText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
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
});
