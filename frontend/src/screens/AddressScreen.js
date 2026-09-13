import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Modal, 
  SafeAreaView 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  fetchUserAddresses, 
  addUserAddress, 
  updateUserAddress, 
  setDefaultUserAddress, 
  deleteUserAddress,
  fetchStoreLandmark
} from '../services/api';
import MapLocationPicker from '../components/MapLocationPicker';

function calculateHaversine(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
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

// Quy tắc tính tiền ship mới:
// - Khoảng cách <= 1.0 km: mặc định 5.000đ
// - Từ 1km trở đi: cứ cách 1km là thêm 5k, 100m là thêm 500đ
function calculateShippingFee(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return 5000;
  const d = parseFloat(distanceKm);
  if (isNaN(d) || d <= 0) return 5000;
  if (d <= 1.0) return 5000;
  const extraKm = d - 1.0;
  const extra100m = Math.ceil(Math.round(extraKm * 1000) / 100);
  return 5000 + extra100m * 500;
}

export default function AddressScreen({ navigation, route }) {
  const [addresses, setAddresses] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storeLandmark, setStoreLandmark] = useState({
    dia_chi_quan: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
    vi_do: 10.9805,
    kinh_do: 106.6745,
    ban_kinh_phuc_vu_km: 3.0,
    gia_ship_moi_km: 5000
  });

  // Modal Map Location Picker (Chuẩn Shopee / Grab)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSavedAddresses();
      loadLandmark();
    });
    loadSavedAddresses();
    loadLandmark();
    return unsubscribe;
  }, [navigation]);

  const loadLandmark = async () => {
    try {
      const res = await fetchStoreLandmark();
      if (res && res.success && res.data) {
        setStoreLandmark(res.data);
      }
    } catch (e) {
      console.log('Dùng mốc quán mặc định:', e);
    }
  };

  const getUserAddressKey = (user) => {
    if (!user) return null;
    const uid = user.ma_nguoi_dung || user.id || user.so_dien_thoai;
    return uid ? `saved_addresses_${uid}` : null;
  };

  const checkAuth = async (actionDesc = 'thêm và quản lý địa chỉ nhận hàng') => {
    const storedUser = await AsyncStorage.getItem('user_info');
    const token = await AsyncStorage.getItem('user_token');
    if (!token || !storedUser) {
      Alert.alert(
        'Yêu cầu đăng nhập 🔒',
        `Bạn cần đăng nhập tài khoản để ${actionDesc}!`,
        [
          { text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') },
          { text: 'Để sau', style: 'cancel' }
        ]
      );
      return false;
    }
    return true;
  };

  const loadSavedAddresses = async () => {
    setLoading(true);
    try {
      const storedUser = await AsyncStorage.getItem('user_info');
      const token = await AsyncStorage.getItem('user_token');
      const user = (storedUser && token) ? JSON.parse(storedUser) : null;
      setCurrentUser(user);

      if (!user) {
        // Chưa đăng nhập -> Danh sách rỗng
        setAddresses([]);
        await AsyncStorage.removeItem('default_address');
        setLoading(false);
        return;
      }

      const userKey = getUserAddressKey(user);

      // 1. LẤY TRỰC TIẾP TỪ DATABASE MYSQL
      try {
        const response = await fetchUserAddresses();
        if (response && response.success && Array.isArray(response.data)) {
          const list = response.data;
          setAddresses(list);
          if (userKey) {
            await AsyncStorage.setItem(userKey, JSON.stringify(list));
          }
          await AsyncStorage.setItem('saved_addresses', JSON.stringify(list));

          if (list.length > 0) {
            const def = list.find(a => a.isDefault) || list[0];
            await AsyncStorage.setItem('default_address', JSON.stringify(def));
            if (userKey) {
              await AsyncStorage.setItem(`default_address_${userKey}`, JSON.stringify(def));
            }
            // Đồng bộ luôn trường dia_chi trong user_info trên máy
            if (def && def.address) {
              const updatedUser = { ...user, dia_chi: def.address };
              setCurrentUser(updatedUser);
              await AsyncStorage.setItem('user_info', JSON.stringify(updatedUser));
            }
          } else {
            await AsyncStorage.removeItem('default_address');
            if (userKey) await AsyncStorage.removeItem(`default_address_${userKey}`);
          }
          setLoading(false);
          return;
        }
      } catch (apiErr) {
        console.log('Lỗi gọi API địa chỉ, dùng fallback bộ nhớ máy:', apiErr.message);
      }

      // 2. Fallback AsyncStorage nếu mất mạng
      let stored = userKey ? await AsyncStorage.getItem(userKey) : null;
      if (stored) {
        let parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setAddresses(parsed);
          const def = parsed.find(a => a.isDefault) || parsed[0];
          if (def) {
            await AsyncStorage.setItem('default_address', JSON.stringify(def));
          }
        } else {
          setAddresses([]);
        }
      } else {
        setAddresses([]);
        await AsyncStorage.removeItem('default_address');
      }
    } catch (e) {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  // Chọn một địa chỉ làm địa chỉ mặc định giao hàng (Lưu Database & cập nhật nguoi_dung.dia_chi)
  const handleSelectAddress = async (selectedItem) => {
    const isAuth = await checkAuth('chọn địa chỉ giao hàng');
    if (!isAuth) return;

    try {
      const targetId = selectedItem.ma_dia_chi || selectedItem.id;
      // Gọi API cập nhật Database MySQL
      if (targetId) {
        await setDefaultUserAddress(targetId);
      }

      const userKey = getUserAddressKey(currentUser);
      const updated = addresses.map(item => ({
        ...item,
        isDefault: (item.ma_dia_chi || item.id) === targetId
      }));
      setAddresses(updated);

      if (userKey) {
        await AsyncStorage.setItem(userKey, JSON.stringify(updated));
        await AsyncStorage.setItem(`default_address_${userKey}`, JSON.stringify({ ...selectedItem, isDefault: true }));
      }
      await AsyncStorage.setItem('saved_addresses', JSON.stringify(updated));
      await AsyncStorage.setItem('default_address', JSON.stringify({ ...selectedItem, isDefault: true }));

      // Đồng bộ vào user_info cục bộ
      if (currentUser) {
        const updatedUser = { ...currentUser, dia_chi: selectedItem.address };
        setCurrentUser(updatedUser);
        await AsyncStorage.setItem('user_info', JSON.stringify(updatedUser));
      }

      Alert.alert(
        'Đã đổi địa chỉ giao hàng 📍',
        `Giao tới: ${selectedItem.label} - ${selectedItem.address}`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home');
              }
            } 
          }
        ]
      );
    } catch (e) {
      Alert.alert('Thông báo', e.message || 'Lỗi khi đặt địa chỉ mặc định');
    }
  };

  // Xóa địa chỉ (Xóa trong Database MySQL)
  const handleDeleteAddress = (id) => {
    Alert.alert(
      'Xóa địa chỉ 🗑️',
      'Bạn có chắc muốn xóa địa chỉ này khỏi danh bạ?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserAddress(id);
              await loadSavedAddresses();
            } catch (err) {
              Alert.alert('Lỗi xóa', err.message || 'Không thể xóa địa chỉ!');
            }
          }
        }
      ]
    );
  };

  const openAddModal = async () => {
    const isAuth = await checkAuth('thêm địa chỉ nhận hàng');
    if (!isAuth) return;
    setEditingAddress(null);
    setModalVisible(true);
  };

  const openEditModal = async (item) => {
    const isAuth = await checkAuth('chỉnh sửa địa chỉ');
    if (!isAuth) return;
    setEditingAddress(item);
    setModalVisible(true);
  };

  // Xác nhận vị trí từ MapLocationPicker
  const handleConfirmMapLocation = async (newLocation) => {
    const storedUser = await AsyncStorage.getItem('user_info');
    const token = await AsyncStorage.getItem('user_token');
    const user = (storedUser && token) ? JSON.parse(storedUser) : null;

    if (!user) {
      setModalVisible(false);
      setEditingAddress(null);
      Alert.alert(
        'Yêu cầu đăng nhập 🔒',
        'Vui lòng đăng nhập tài khoản để lưu địa chỉ nhận hàng!',
        [
          { text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') },
          { text: 'Để sau', style: 'cancel' }
        ]
      );
      return;
    }

    try {
      const payload = {
        name: newLocation.name,
        phone: newLocation.phone,
        label: newLocation.label,
        address: newLocation.address,
        detail: newLocation.detail || '',
        coords: newLocation.coords,
        isDefault: newLocation.isDefault !== undefined ? newLocation.isDefault : (addresses.length === 0)
      };

      if (editingAddress) {
        const targetId = editingAddress.ma_dia_chi || editingAddress.id;
        await updateUserAddress(targetId, payload);
      } else {
        await addUserAddress(payload);
      }

      await loadSavedAddresses();
      setModalVisible(false);
      setEditingAddress(null);
      Alert.alert('Thành công 🎉', `Đã lưu địa chỉ nhận hàng vào sổ địa chỉ:\n📍 ${newLocation.address}`);
    } catch (saveErr) {
      Alert.alert('Lỗi lưu địa chỉ ⚠️', saveErr.message || 'Không thể lưu địa chỉ vào cơ sở dữ liệu!');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Tùy Biến Không Nút Mũi Tên Back Trùng Lặp */}
        <View style={styles.headerBar}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>✕ Đóng</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sổ Địa Chỉ Giao Hàng</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Nút bấm nhanh Tìm kiếm & Ghim Vị Trí Chuẩn Shopee */}
          <TouchableOpacity 
            style={styles.gpsQuickCard}
            activeOpacity={0.85}
            onPress={openAddModal}
          >
            <View style={styles.gpsIconCircle}>
              <Text style={styles.gpsIconEmoji}>📍</Text>
            </View>
            <View style={styles.gpsTextBox}>
              <Text style={styles.gpsTitle}>Tìm kiếm & Ghim vị trí trên bản đồ</Text>
              <Text style={styles.gpsDesc}>Gợi ý địa điểm tự động (Shopee/Grab UX) hoặc định vị GPS tức thì</Text>
            </View>
            <Text style={styles.gpsArrow}>➔</Text>
          </TouchableOpacity>

          {/* Banner thông báo nếu chưa đăng nhập */}
          {!currentUser && (
            <View style={styles.loginBannerCard}>
              <View style={styles.loginBannerHeader}>
                <Text style={styles.loginBannerIcon}>🔒</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.loginBannerTitle}>Yêu cầu đăng nhập</Text>
                  <Text style={styles.loginBannerSubtitle}>
                    Vui lòng đăng nhập để lưu, đổi và quản lý địa chỉ nhận hàng của bạn.
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.loginBannerBtn}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginBannerBtnText}>🔑 Đăng nhập ngay</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Danh sách các địa chỉ đã lưu */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Địa chỉ đã lưu ({addresses.length})</Text>
            <TouchableOpacity onPress={openAddModal}>
              <Text style={styles.addTextBtn}>+ Thêm mới</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#00A896" style={{ marginTop: 30 }} />
          ) : !currentUser ? (
            <View style={styles.emptyAddressBox}>
              <Text style={styles.emptyIcon}>🔒</Text>
              <Text style={styles.emptyTitle}>Bạn chưa đăng nhập</Text>
              <Text style={styles.emptyText}>Đăng nhập để thêm mới và lưu địa chỉ nhận hàng của bạn.</Text>
              <TouchableOpacity 
                style={[styles.emptyAddBtn, { backgroundColor: '#FF6B00' }]} 
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.emptyAddBtnText}>🔑 Đăng nhập ngay</Text>
              </TouchableOpacity>
            </View>
          ) : addresses.length === 0 ? (
            <View style={styles.emptyAddressBox}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyTitle}>Chưa có địa chỉ nào được lưu</Text>
              <Text style={styles.emptyText}>Thêm địa chỉ nhà riêng hoặc nơi làm việc để nhận món ăn nhanh chóng!</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal}>
                <Text style={styles.emptyAddBtnText}>+ Thêm địa chỉ nhận hàng</Text>
              </TouchableOpacity>
            </View>
          ) : (
            addresses.map((item) => {
              const distanceKm = item.khoang_cach_km != null 
                ? parseFloat(item.khoang_cach_km) 
                : (item.coords && item.coords.lat && item.coords.lng && storeLandmark)
                  ? calculateHaversine(storeLandmark.vi_do, storeLandmark.kinh_do, item.coords.lat, item.coords.lng)
                  : null;

              const shippingFee = distanceKm !== null ? calculateShippingFee(distanceKm) : 5000;
              const maxRadius = storeLandmark?.ban_kinh_phuc_vu_km || 3.0;
              const isOutOfRange = distanceKm !== null && distanceKm > maxRadius;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.addressCard, item.isDefault && styles.addressCardDefault]}
                  activeOpacity={0.85}
                  onPress={() => handleSelectAddress(item)}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.labelBadgeRow}>
                      <Text style={styles.labelIcon}>{item.icon || '📍'}</Text>
                      <Text style={styles.labelText}>{item.label}</Text>
                      {item.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>✓ Mặc định</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.actionRow}>
                      <TouchableOpacity 
                        style={styles.editBtn}
                        onPress={() => openEditModal(item)}
                      >
                        <Text style={styles.actionBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteAddress(item.id)}
                      >
                        <Text style={styles.actionBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.recipientText}>
                    {item.name} • <Text style={styles.phoneText}>{item.phone}</Text>
                  </Text>
                  <Text style={styles.detailAddressText}>{item.address}</Text>
                  {item.detail ? (
                    <Text style={styles.subDetailText}>Ghi chú: {item.detail}</Text>
                  ) : null}

                  {/* THÔNG TIN KHOẢNG CÁCH TỚI QUÁN VÀ TIỀN SHIP DỰ KIẾN THEO YÊU CẦU */}
                  <View style={[styles.distanceBadgeRow, isOutOfRange && styles.distanceBadgeOutOfRange]}>
                    <Text style={styles.distanceBadgeIcon}>{isOutOfRange ? '⚠️' : '📏'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.distanceBadgeText, isOutOfRange && styles.distanceBadgeTextOutOfRange]}>
                        {distanceKm !== null
                          ? `Khoảng cách: ${distanceKm} km`
                          : 'Chưa có vị trí bản đồ • Bấm ✏️ ghim vị trí để xem khoảng cách'}
                      </Text>
                      {isOutOfRange && (
                        <Text style={styles.outOfRangeSubText}>
                          (Ngoài khu vực phục vụ của quán)
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.cardFooterRow}>
                    <Text style={[styles.selectStatusText, item.isDefault && styles.selectedStatusText]}>
                      {item.isDefault ? 'Đang chọn giao tới đây ✓' : 'Nhấp để chọn giao tới đây'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Nút Thêm Địa Chỉ ở Đáy */}
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={[styles.addNewBtn, !currentUser && { backgroundColor: '#FF6B00' }]} 
            onPress={openAddModal} 
            activeOpacity={0.85}
          >
            <Text style={styles.addNewBtnText}>
              {currentUser ? '+ Thêm địa chỉ nhận hàng mới' : '🔑 Đăng nhập để thêm địa chỉ'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Modal Toàn Màn Hình Chọn Vị Trí Bản Đồ Chuẩn Shopee */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            setModalVisible(false);
            setEditingAddress(null);
          }}
        >
          <MapLocationPicker
            initialAddress={editingAddress ? editingAddress.address : ''}
            initialName={editingAddress ? editingAddress.name : (currentUser?.ho_ten || '')}
            initialPhone={editingAddress ? editingAddress.phone : (currentUser?.so_dien_thoai || '')}
            initialLabel={editingAddress ? editingAddress.label : 'Nhà riêng'}
            onClose={() => {
              setModalVisible(false);
              setEditingAddress(null);
            }}
            onConfirmLocation={handleConfirmMapLocation}
          />
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#00A896',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    height: 56,
    backgroundColor: '#00A896',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  gpsQuickCard: {
    backgroundColor: '#E0F2F1',
    borderWidth: 1.5,
    borderColor: '#80CBC4',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  gpsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00A896',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gpsIconEmoji: {
    fontSize: 22,
  },
  gpsTextBox: {
    flex: 1,
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#004D40',
    marginBottom: 2,
  },
  gpsDesc: {
    fontSize: 12,
    color: '#00796B',
    lineHeight: 16,
  },
  gpsArrow: {
    fontSize: 18,
    color: '#00A896',
    fontWeight: 'bold',
  },
  loginBannerCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  loginBannerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  loginBannerIcon: {
    fontSize: 24,
  },
  loginBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9A3412',
    marginBottom: 4,
  },
  loginBannerSubtitle: {
    fontSize: 12,
    color: '#7C2D12',
    lineHeight: 17,
  },
  loginBannerBtn: {
    marginTop: 10,
    backgroundColor: '#FF6B00',
    paddingVertical: 9,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  loginBannerBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  addTextBtn: {
    fontSize: 14,
    color: '#00A896',
    fontWeight: '700',
  },
  emptyAddressBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyAddBtn: {
    backgroundColor: '#00A896',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyAddBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  addressCardDefault: {
    borderColor: '#00A896',
    backgroundColor: '#F0FDF4',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  labelText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    padding: 4,
  },
  deleteBtn: {
    padding: 4,
  },
  actionBtnText: {
    fontSize: 15,
  },
  recipientText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  phoneText: {
    color: '#64748B',
    fontWeight: 'normal',
  },
  detailAddressText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 4,
  },
  subDetailText: {
    fontSize: 12,
    color: '#00A896',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  cardFooterRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  selectStatusText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  selectedStatusText: {
    color: '#00A896',
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  addNewBtn: {
    backgroundColor: '#00A896',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addNewBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  distanceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 4,
    marginBottom: 6,
    gap: 6,
  },
  distanceBadgeOutOfRange: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  distanceBadgeIcon: {
    fontSize: 14,
  },
  distanceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  distanceBadgeTextOutOfRange: {
    color: '#B91C1C',
  },
  outOfRangeSubText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 2,
  },
});
