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
import MapLocationPicker from '../components/MapLocationPicker';

const INITIAL_ADDRESSES = [
  {
    id: '1',
    label: 'Nhà riêng',
    icon: '🏠',
    name: 'Trần Văn Đình',
    phone: '0378876126',
    address: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
    detail: 'Cổng chính',
    latitude: 10.9805,
    longitude: 106.6745,
    isDefault: true,
  },
  {
    id: '2',
    label: 'Trường học',
    icon: '🏫',
    name: 'Trần Văn Đình',
    phone: '0378876126',
    address: 'Trường Đại học Bình Dương (BDU), 504 Đại lộ Bình Dương, TP. Thủ Dầu Một, Bình Dương',
    detail: 'Khoa CNTT',
    latitude: 10.9808,
    longitude: 106.6750,
    isDefault: false,
  }
];

export default function AddressScreen({ navigation, route }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Map Location Picker (Chuẩn Shopee / Grab)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  useEffect(() => {
    loadSavedAddresses();
  }, []);

  const loadSavedAddresses = async () => {
    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem('saved_addresses');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Tự động nâng cấp nếu bộ nhớ còn giữ địa chỉ mock cũ (Lê Duẩn Quận 1)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].address && parsed[0].address.includes('Lê Duẩn')) {
          setAddresses(INITIAL_ADDRESSES);
          await AsyncStorage.setItem('saved_addresses', JSON.stringify(INITIAL_ADDRESSES));
          await AsyncStorage.setItem('default_address', JSON.stringify(INITIAL_ADDRESSES[0]));
        } else {
          setAddresses(parsed);
        }
      } else {
        // Khởi tạo địa chỉ ban đầu chuẩn khu vực Bình Dương
        setAddresses(INITIAL_ADDRESSES);
        await AsyncStorage.setItem('saved_addresses', JSON.stringify(INITIAL_ADDRESSES));
        await AsyncStorage.setItem('default_address', JSON.stringify(INITIAL_ADDRESSES[0]));
      }
    } catch (e) {
      setAddresses(INITIAL_ADDRESSES);
    } finally {
      setLoading(false);
    }
  };

  // Chọn một địa chỉ làm địa chỉ mặc định giao hàng
  const handleSelectAddress = async (selectedItem) => {
    const updated = addresses.map(item => ({
      ...item,
      isDefault: item.id === selectedItem.id
    }));
    setAddresses(updated);
    try {
      await AsyncStorage.setItem('saved_addresses', JSON.stringify(updated));
      await AsyncStorage.setItem('default_address', JSON.stringify({ ...selectedItem, isDefault: true }));
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
      console.log('Lỗi lưu địa chỉ mặc định');
    }
  };

  // Xóa địa chỉ
  const handleDeleteAddress = (id) => {
    Alert.alert(
      'Xóa địa chỉ',
      'Bạn có chắc muốn xóa địa chỉ này khỏi danh bạ?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa', 
          style: 'destructive',
          onPress: async () => {
            const updated = addresses.filter(a => a.id !== id);
            // Nếu xóa trúng địa chỉ mặc định thì chọn cái đầu tiên
            if (updated.length > 0 && !updated.some(a => a.isDefault)) {
              updated[0].isDefault = true;
              await AsyncStorage.setItem('default_address', JSON.stringify(updated[0]));
            }
            setAddresses(updated);
            await AsyncStorage.setItem('saved_addresses', JSON.stringify(updated));
          }
        }
      ]
    );
  };

  const openAddModal = () => {
    setEditingAddress(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingAddress(item);
    setModalVisible(true);
  };

  // Xác nhận vị trí từ MapLocationPicker
  const handleConfirmMapLocation = async (newLocation) => {
    let updated = [...addresses];
    
    if (editingAddress) {
      updated = updated.map(item => {
        if (item.id === editingAddress.id) {
          return {
            ...item,
            ...newLocation,
            id: editingAddress.id,
            isDefault: newLocation.isDefault !== undefined ? newLocation.isDefault : item.isDefault,
          };
        }
        return newLocation.isDefault ? { ...item, isDefault: false } : item;
      });
    } else {
      if (newLocation.isDefault || addresses.length === 0) {
        updated = updated.map(item => ({ ...item, isDefault: false }));
        updated.unshift({ ...newLocation, isDefault: true });
      } else {
        updated.unshift(newLocation);
      }
    }

    setAddresses(updated);
    try {
      await AsyncStorage.setItem('saved_addresses', JSON.stringify(updated));
      const defaultAddr = updated.find(a => a.isDefault) || updated[0];
      await AsyncStorage.setItem('default_address', JSON.stringify(defaultAddr));
    } catch (e) {
      console.log('Lỗi lưu địa chỉ:', e);
    }

    setModalVisible(false);
    setEditingAddress(null);
    Alert.alert('Thành công 🎉', `Đã lưu địa chỉ nhận hàng:\n📍 ${newLocation.address}`);
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

          {/* Danh sách các địa chỉ đã lưu */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Địa chỉ đã lưu ({addresses.length})</Text>
            <TouchableOpacity onPress={openAddModal}>
              <Text style={styles.addTextBtn}>+ Thêm mới</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#00A896" style={{ marginTop: 30 }} />
          ) : addresses.length === 0 ? (
            <View style={styles.emptyAddressBox}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyText}>Chưa có địa chỉ nào được lưu!</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal}>
                <Text style={styles.emptyAddBtnText}>+ Thêm địa chỉ nhận hàng</Text>
              </TouchableOpacity>
            </View>
          ) : (
            addresses.map((item) => (
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

                <View style={styles.cardFooterRow}>
                  <Text style={[styles.selectStatusText, item.isDefault && styles.selectedStatusText]}>
                    {item.isDefault ? 'Đang chọn giao tới đây ✓' : 'Nhấp để chọn giao tới đây'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Nút Thêm Địa Chỉ ở Đáy */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.addNewBtn} onPress={openAddModal} activeOpacity={0.85}>
            <Text style={styles.addNewBtnText}>+ Thêm địa chỉ nhận hàng mới</Text>
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
            initialName={editingAddress ? editingAddress.name : 'Trần Văn Đình'}
            initialPhone={editingAddress ? editingAddress.phone : '0378876126'}
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
  emptyText: {
    fontSize: 14,
    color: '#64748B',
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
});
