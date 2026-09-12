import React, { useState, useEffect } from 'react';
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
  Modal
} from 'react-native';
import {
  fetchDashboardStats,
  fetchMenuItems,
  createFoodItem,
  deleteFoodItem,
  fetchAdminVouchers,
  createAdminVoucher,
  deleteAdminVoucher,
  toggleAdminVoucher,
  fetchAdminUsers,
  createAdminUser,
  updateAdminUserRole
} from '../services/api';

export default function AdminScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'foods' | 'vouchers' | 'users'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [stats, setStats] = useState(null);
  const [foods, setFoods] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [users, setUsers] = useState([]);

  // Modal states
  const [modalType, setModalType] = useState(null); // 'addFood' | 'addVoucher' | 'addUser'
  const [submitting, setSubmitting] = useState(false);

  // Form states - Add Food
  const [foodForm, setFoodForm] = useState({
    ten_mon: '',
    mo_ta: '',
    gia_ban: '',
    ma_danh_muc: '1',
  });

  // Form states - Add Voucher
  const [voucherForm, setVoucherForm] = useState({
    ma_code: '',
    ten_voucher: '',
    mo_ta: '',
    loai_giam_gia: 'so_tien',
    gia_tri_giam: '',
    don_hang_toi_thieu: '',
  });

  // Form states - Add User
  const [userForm, setUserForm] = useState({
    ho_ten: '',
    so_dien_thoai: '',
    email: '',
    mat_khau: '123456',
    ma_vai_tro: '2', // 2: Staff, 4: Shipper
  });

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
      const [statsRes, foodsRes, vouchersRes, usersRes] = await Promise.all([
        fetchDashboardStats(),
        fetchMenuItems(),
        fetchAdminVouchers(),
        fetchAdminUsers()
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (foodsRes.success) setFoods(foodsRes.data || []);
      if (vouchersRes.success) setVouchers(vouchersRes.data || []);
      if (usersRes.success) setUsers(usersRes.data || []);
    } catch (err) {
      console.log('Lỗi tải dữ liệu Admin:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllAdminData();
  };

  // --- THAO TÁC MÓN ĂN ---
  const handleCreateFood = async () => {
    if (!foodForm.ten_mon.trim() || !foodForm.gia_ban) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên món và giá bán!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createFoodItem({
        ten_mon: foodForm.ten_mon.trim(),
        mo_ta: foodForm.mo_ta.trim(),
        gia_ban: parseFloat(foodForm.gia_ban),
        ma_danh_muc: parseInt(foodForm.ma_danh_muc),
        trang_thai: 'con_hang'
      });
      if (res.success) {
        Alert.alert('Thành công 🎉', `Đã thêm món '${foodForm.ten_mon}' vào thực đơn!`);
        setModalType(null);
        setFoodForm({ ten_mon: '', mo_ta: '', gia_ban: '', ma_danh_muc: '1' });
        loadAllAdminData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo món ăn mới!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFood = (itemId, foodName) => {
    Alert.alert('Xác nhận xóa món', `Bạn có chắc muốn xóa vĩnh viễn món '${foodName}' khỏi thực đơn?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa vĩnh viễn',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteFoodItem(itemId);
            if (res.success) {
              Alert.alert('Đã xóa', res.message);
              loadAllAdminData();
            }
          } catch (err) {
            Alert.alert('Lỗi', err.message || 'Không thể xóa món ăn!');
          }
        }
      }
    ]);
  };

  // --- THAO TÁC VOUCHER ---
  const handleCreateVoucher = async () => {
    if (!voucherForm.ma_code.trim() || !voucherForm.ten_voucher.trim() || !voucherForm.gia_tri_giam) {
      Alert.alert('Lỗi', 'Vui lòng nhập Mã code, Tên voucher và Giá trị giảm!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createAdminVoucher({
        ma_code: voucherForm.ma_code.trim().toUpperCase(),
        ten_voucher: voucherForm.ten_voucher.trim(),
        mo_ta: voucherForm.mo_ta.trim(),
        loai_giam_gia: voucherForm.loai_giam_gia,
        gia_tri_giam: parseFloat(voucherForm.gia_tri_giam),
        don_hang_toi_thieu: parseFloat(voucherForm.don_hang_toi_thieu || 0),
        so_luong_phat_hanh: 200,
        ngay_ket_thuc: '2026-12-31 23:59:59'
      });
      if (res.success) {
        Alert.alert('Thành công 🎉', `Đã tạo voucher '${voucherForm.ma_code}'!`);
        setModalType(null);
        setVoucherForm({ ma_code: '', ten_voucher: '', mo_ta: '', loai_giam_gia: 'so_tien', gia_tri_giam: '', don_hang_toi_thieu: '' });
        loadAllAdminData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo voucher!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVoucher = (voucherId, code) => {
    Alert.alert('Xóa Voucher', `Bạn có chắc muốn xóa mã giảm giá '${code}'?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteAdminVoucher(voucherId);
            if (res.success) {
              loadAllAdminData();
            }
          } catch (err) {
            Alert.alert('Lỗi', err.message);
          }
        }
      }
    ]);
  };

  const handleToggleVoucher = async (voucherId) => {
    try {
      const res = await toggleAdminVoucher(voucherId);
      if (res.success) {
        loadAllAdminData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message);
    }
  };

  // --- THAO TÁC NGƯỜI DÙNG & NHÂN SỰ ---
  const handleCreateUser = async () => {
    if (!userForm.ho_ten.trim() || !userForm.so_dien_thoai.trim()) {
      Alert.alert('Lỗi', 'Họ tên và Số điện thoại là bắt buộc!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createAdminUser({
        ho_ten: userForm.ho_ten.trim(),
        so_dien_thoai: userForm.so_dien_thoai.trim(),
        email: userForm.email.trim(),
        mat_khau: userForm.mat_khau || '123456',
        ma_vai_tro: parseInt(userForm.ma_vai_tro)
      });
      if (res.success) {
        Alert.alert('Thành công 🎉', res.message);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Admin Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>👑 FastFood Admin Portal</Text>
          <Text style={styles.headerSubtitle}>Quản trị viên toàn quyền hệ thống</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.profileBtnText}>Hồ sơ 👤</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {[
          { key: 'dashboard', label: '📊 Tổng Quan' },
          { key: 'foods', label: '🍔 Món Ăn' },
          { key: 'vouchers', label: '🎁 Voucher' },
          { key: 'users', label: '👥 Nhân Sự' }
        ].map(t => (
          <TouchableOpacity 
            key={t.key}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4A148C" />
          <Text style={styles.loadingText}>Đang tải dữ liệu quản trị...</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4A148C']} />}
        >
          {/* TAB 1: TỔNG QUAN DOANH THU & VẬN HÀNH */}
          {activeTab === 'dashboard' && (
            <View>
              <View style={styles.revenueCard}>
                <Text style={styles.revenueLabel}>💰 Tổng Doanh Thu Bán Hàng</Text>
                <Text style={styles.revenueAmount}>{stats?.total_revenue?.toLocaleString('vi-VN')} đ</Text>
                <Text style={styles.revenueSub}>Tính trên các đơn hàng đã giao thành công và thu tiền</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statsCard}>
                  <Text style={styles.statsNumber}>{stats?.total_orders || 0}</Text>
                  <Text style={styles.statsTitle}>Tổng số đơn hàng</Text>
                </View>
                <View style={styles.statsCard}>
                  <Text style={[styles.statsNumber, { color: '#E65100' }]}>{stats?.pending_orders || 0}</Text>
                  <Text style={styles.statsTitle}>Đang chế biến/Chờ</Text>
                </View>
                <View style={styles.statsCard}>
                  <Text style={[styles.statsNumber, { color: '#2E7D32' }]}>{stats?.delivered_orders || 0}</Text>
                  <Text style={styles.statsTitle}>Giao thành công</Text>
                </View>
                <View style={styles.statsCard}>
                  <Text style={[styles.statsNumber, { color: '#1565C0' }]}>{stats?.total_foods || 0}</Text>
                  <Text style={styles.statsTitle}>Món ăn thực đơn</Text>
                </View>
              </View>

              <View style={styles.staffSummaryCard}>
                <Text style={styles.staffSummaryTitle}>Đội ngũ vận hành:</Text>
                <Text style={styles.staffSummaryLine}>• Nhân viên bếp: <Text style={styles.bold}>{stats?.total_staff || 0}</Text> nhân sự</Text>
                <Text style={styles.staffSummaryLine}>• Tài xế giao hàng (Shipper): <Text style={styles.bold}>{stats?.total_shipper || 0}</Text> shipper</Text>
              </View>
            </View>
          )}

          {/* TAB 2: QUẢN LÝ MÓN ĂN & TÙY BIẾN */}
          {activeTab === 'foods' && (
            <View>
              <View style={styles.actionHeaderRow}>
                <Text style={styles.sectionTitle}>Danh sách món ăn ({foods.length})</Text>
                <TouchableOpacity 
                  style={styles.addBtn}
                  onPress={() => setModalType('addFood')}
                >
                  <Text style={styles.addBtnText}>+ Thêm món mới</Text>
                </TouchableOpacity>
              </View>

              {foods.map(item => (
                <View key={item.ma_mon_an} style={styles.itemCard}>
                  <View style={styles.itemEmojiBox}>
                    <Text style={{ fontSize: 28 }}>🍔</Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.ten_mon}</Text>
                    <Text style={styles.itemPrice}>{parseFloat(item.gia_ban).toLocaleString('vi-VN')} đ</Text>
                    <Text style={styles.itemDesc} numberOfLines={1}>{item.mo_ta || 'Không có mô tả'}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.deleteIconBtn}
                    onPress={() => handleDeleteFood(item.ma_mon_an, item.ten_mon)}
                  >
                    <Text style={styles.deleteIconText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: QUẢN LÝ VOUCHER & MÃ GIẢM GIÁ */}
          {activeTab === 'vouchers' && (
            <View>
              <View style={styles.actionHeaderRow}>
                <Text style={styles.sectionTitle}>Mã giảm giá & Khuyến mãi ({vouchers.length})</Text>
                <TouchableOpacity 
                  style={[styles.addBtn, { backgroundColor: '#E65100' }]}
                  onPress={() => setModalType('addVoucher')}
                >
                  <Text style={styles.addBtnText}>+ Tạo Voucher</Text>
                </TouchableOpacity>
              </View>

              {vouchers.map(v => {
                const isActive = v.trang_thai === 'hoat_dong';
                return (
                  <View key={v.ma_voucher} style={styles.voucherCard}>
                    <View style={styles.voucherLeft}>
                      <View style={styles.voucherBadge}>
                        <Text style={styles.voucherCodeText}>{v.ma_code}</Text>
                      </View>
                      <Text style={styles.voucherTitle}>{v.ten_voucher}</Text>
                      <Text style={styles.voucherDetail}>
                        Giảm: <Text style={styles.bold}>{v.loai_giam_gia === 'phan_tram' ? `${v.gia_tri_giam}%` : `${parseFloat(v.gia_tri_giam).toLocaleString('vi-VN')} đ`}</Text> • Đơn tối thiểu: {parseFloat(v.don_hang_toi_thieu || 0).toLocaleString('vi-VN')} đ
                      </Text>
                    </View>

                    <View style={styles.voucherActions}>
                      <TouchableOpacity 
                        style={[styles.statusToggleBtn, isActive ? styles.statusActive : styles.statusInactive]}
                        onPress={() => handleToggleVoucher(v.ma_voucher)}
                      >
                        <Text style={styles.statusToggleText}>{isActive ? 'Đang bật' : 'Tạm dừng'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.voucherDeleteBtn}
                        onPress={() => handleDeleteVoucher(v.ma_voucher, v.ma_code)}
                      >
                        <Text style={styles.voucherDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* TAB 4: QUẢN LÝ NHÂN SỰ (NHÂN VIÊN & SHIPPER) */}
          {activeTab === 'users' && (
            <View>
              <View style={styles.actionHeaderRow}>
                <Text style={styles.sectionTitle}>Tài khoản người dùng ({users.length})</Text>
                <TouchableOpacity 
                  style={[styles.addBtn, { backgroundColor: '#1565C0' }]}
                  onPress={() => setModalType('addUser')}
                >
                  <Text style={styles.addBtnText}>+ Thêm Nhân Sự</Text>
                </TouchableOpacity>
              </View>

              {users.map(u => {
                let roleColor = '#78909C';
                let roleLabel = 'Khách hàng';
                if (u.ma_vai_tro === 2 || u.ma_vai_tro === 5) { roleColor = '#D84315'; roleLabel = '🧑‍🍳 Bếp / Quán'; }
                else if (u.ma_vai_tro === 4) { roleColor = '#00897B'; roleLabel = '🛵 Shipper'; }
                else if (u.ma_vai_tro === 3) { roleColor = '#6A1B9A'; roleLabel = '👑 Quản trị viên'; }

                return (
                  <View key={u.ma_nguoi_dung} style={styles.userCard}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.ho_ten} {u.so_dien_thoai ? `(${u.so_dien_thoai})` : ''}</Text>
                      <Text style={styles.userEmail}>{u.email || 'Chưa cập nhật email'}</Text>
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
                      <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* MODAL THÊM MÓN ĂN MỚI */}
      <Modal visible={modalType === 'addFood'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🍔 Thêm Món Ăn Mới</Text>
            
            <Text style={styles.inputLabel}>Tên món ăn *</Text>
            <TextInput 
              style={styles.input}
              placeholder="VD: Burger Cá Hồi Nauy..."
              value={foodForm.ten_mon}
              onChangeText={t => setFoodForm({ ...foodForm, ten_mon: t })}
            />

            <Text style={styles.inputLabel}>Giá bán (VNĐ) *</Text>
            <TextInput 
              style={styles.input}
              placeholder="VD: 59000"
              keyboardType="numeric"
              value={foodForm.gia_ban}
              onChangeText={t => setFoodForm({ ...foodForm, gia_ban: t })}
            />

            <Text style={styles.inputLabel}>Mô tả món ăn</Text>
            <TextInput 
              style={[styles.input, { height: 60 }]}
              placeholder="Thành phần chính, hương vị..."
              multiline
              value={foodForm.mo_ta}
              onChangeText={t => setFoodForm({ ...foodForm, mo_ta: t })}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSubmitBtn, submitting && styles.btnDisabled]} 
                onPress={handleCreateFood}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSubmitText}>Lưu món</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL TẠO VOUCHER */}
      <Modal visible={modalType === 'addVoucher'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎁 Tạo Mã Voucher Mới</Text>

            <Text style={styles.inputLabel}>Mã Code (viết hoa) *</Text>
            <TextInput 
              style={styles.input}
              placeholder="VD: SALE50, TET2026..."
              autoCapitalize="characters"
              value={voucherForm.ma_code}
              onChangeText={t => setVoucherForm({ ...voucherForm, ma_code: t })}
            />

            <Text style={styles.inputLabel}>Tên Voucher *</Text>
            <TextInput 
              style={styles.input}
              placeholder="VD: Giảm 30K đơn đầu tiên"
              value={voucherForm.ten_voucher}
              onChangeText={t => setVoucherForm({ ...voucherForm, ten_voucher: t })}
            />

            <Text style={styles.inputLabel}>Số tiền giảm (VNĐ) *</Text>
            <TextInput 
              style={styles.input}
              placeholder="VD: 30000"
              keyboardType="numeric"
              value={voucherForm.gia_tri_giam}
              onChangeText={t => setVoucherForm({ ...voucherForm, gia_tri_giam: t })}
            />

            <Text style={styles.inputLabel}>Đơn hàng tối thiểu (VNĐ)</Text>
            <TextInput 
              style={styles.input}
              placeholder="VD: 100000"
              keyboardType="numeric"
              value={voucherForm.don_hang_toi_thieu}
              onChangeText={t => setVoucherForm({ ...voucherForm, don_hang_toi_thieu: t })}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSubmitBtn, { backgroundColor: '#E65100' }, submitting && styles.btnDisabled]} 
                onPress={handleCreateVoucher}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSubmitText}>Tạo Voucher</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL THÊM NHÂN SỰ */}
      <Modal visible={modalType === 'addUser'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>👥 Thêm Tài Khoản Nhân Sự</Text>

            <Text style={styles.inputLabel}>Họ và tên *</Text>
            <TextInput 
              style={styles.input}
              placeholder="VD: Nguyễn Văn Tài Xế"
              value={userForm.ho_ten}
              onChangeText={t => setUserForm({ ...userForm, ho_ten: t })}
            />

            <Text style={styles.inputLabel}>Số điện thoại đăng nhập *</Text>
            <TextInput 
              style={styles.input}
              placeholder="VD: 0945678901"
              keyboardType="phone-pad"
              value={userForm.so_dien_thoai}
              onChangeText={t => setUserForm({ ...userForm, so_dien_thoai: t })}
            />

            <Text style={styles.inputLabel}>Vai trò tài khoản *</Text>
            <View style={styles.rolePickerRow}>
              <TouchableOpacity 
                style={[styles.roleChoiceBtn, userForm.ma_vai_tro === '2' && styles.roleChoiceActive]}
                onPress={() => setUserForm({ ...userForm, ma_vai_tro: '2' })}
              >
                <Text style={[styles.roleChoiceText, userForm.ma_vai_tro === '2' && styles.roleChoiceTextActive]}>🧑‍🍳 Nhân viên Bếp</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.roleChoiceBtn, userForm.ma_vai_tro === '4' && styles.roleChoiceActive]}
                onPress={() => setUserForm({ ...userForm, ma_vai_tro: '4' })}
              >
                <Text style={[styles.roleChoiceText, userForm.ma_vai_tro === '4' && styles.roleChoiceTextActive]}>🛵 Shipper Giao Hàng</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordHintText}>* Mật khẩu khởi tạo mặc định: 123456</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSubmitBtn, { backgroundColor: '#1565C0' }, submitting && styles.btnDisabled]} 
                onPress={handleCreateUser}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSubmitText}>Tạo Tài Khoản</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4A148C',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#E1BEE7',
    marginTop: 2,
  },
  profileBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  profileBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    elevation: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#4A148C',
  },
  tabText: {
    fontSize: 12,
    color: '#78909C',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#4A148C',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6A1B9A',
  },
  revenueCard: {
    backgroundColor: '#4A148C',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 3,
  },
  revenueLabel: {
    color: '#E1BEE7',
    fontSize: 14,
    fontWeight: '600',
  },
  revenueAmount: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  revenueSub: {
    color: '#CE93D8',
    fontSize: 11,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statsCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    elevation: 1,
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#263238',
  },
  statsTitle: {
    fontSize: 12,
    color: '#78909C',
    marginTop: 4,
    textAlign: 'center',
  },
  staffSummaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
  },
  staffSummaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 8,
  },
  staffSummaryLine: {
    fontSize: 13,
    color: '#455A64',
    marginBottom: 4,
  },
  bold: {
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#263238',
  },
  addBtn: {
    backgroundColor: '#4A148C',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
  },
  itemEmojiBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EDE7F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#263238',
  },
  itemPrice: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: 'bold',
    marginTop: 2,
  },
  itemDesc: {
    fontSize: 12,
    color: '#78909C',
    marginTop: 2,
  },
  deleteIconBtn: {
    padding: 8,
  },
  deleteIconText: {
    fontSize: 18,
  },
  voucherCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
  },
  voucherLeft: {
    flex: 1,
  },
  voucherBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFE082',
    marginBottom: 4,
  },
  voucherCodeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E65100',
  },
  voucherTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#263238',
  },
  voucherDetail: {
    fontSize: 11,
    color: '#607D8B',
    marginTop: 2,
  },
  voucherActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#ECEFF1',
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  voucherDeleteBtn: {
    padding: 6,
  },
  voucherDeleteText: {
    fontSize: 16,
    color: '#C62828',
    fontWeight: 'bold',
  },
  userCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#263238',
  },
  userEmail: {
    fontSize: 12,
    color: '#78909C',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#455A64',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F5F7F8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#CFD8DC',
    color: '#1A1D1E',
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  roleChoiceBtn: {
    flex: 1,
    backgroundColor: '#F5F7F8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CFD8DC',
  },
  roleChoiceActive: {
    backgroundColor: '#EDE7F6',
    borderColor: '#6A1B9A',
  },
  roleChoiceText: {
    fontSize: 12,
    color: '#455A64',
    fontWeight: '600',
  },
  roleChoiceTextActive: {
    color: '#6A1B9A',
    fontWeight: 'bold',
  },
  passwordHintText: {
    fontSize: 11,
    color: '#78909C',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ECEFF1',
  },
  modalCancelText: {
    fontSize: 14,
    color: '#546E7A',
    fontWeight: '600',
  },
  modalSubmitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4A148C',
  },
  modalSubmitText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
