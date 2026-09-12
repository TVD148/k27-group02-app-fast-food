import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  Modal, 
  SafeAreaView, 
  Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INITIAL_ADDRESSES = [
  {
    id: '1',
    label: 'Nhà riêng',
    icon: '🏠',
    name: 'Trần Văn Đình',
    phone: '0378876126',
    address: '123 Đường Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    isDefault: true,
  },
  {
    id: '2',
    label: 'Công ty',
    icon: '🏢',
    name: 'Trần Văn Đình',
    phone: '0378876126',
    address: 'Tòa nhà Landmark 81, 720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP. Hồ Chí Minh',
    isDefault: false,
  }
];

export default function AddressScreen({ navigation, route }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  // Modal thêm/sửa địa chỉ
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [labelType, setLabelType] = useState('Nhà riêng');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressText, setAddressText] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    loadSavedAddresses();
  }, []);

  const loadSavedAddresses = async () => {
    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem('saved_addresses');
      if (stored) {
        setAddresses(JSON.parse(stored));
      } else {
        // Khởi tạo 2 địa chỉ mẫu tiện lợi ban đầu
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

  // HÀM REVERSE GEOCODING TỪ TỌA ĐỘ GPS THỰC TẾ SANG ĐỊA CHỈ TIẾNG VIỆT CHÍNH XÁC
  const reverseGeocodeCoords = async (lat, lon) => {
    let streetOrPlace = '';
    
    // 1. Lấy tên địa điểm/tên đường từ Photon (OpenStreetMap data)
    try {
      const pRes = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`);
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.features && pData.features.length > 0) {
          const p = pData.features[0].properties;
          if (p.housenumber && p.street) {
            streetOrPlace = `${p.housenumber} ${p.street}`;
          } else if (p.street) {
            streetOrPlace = p.street;
          } else if (p.name) {
            streetOrPlace = p.name;
          }
        }
      }
    } catch (e) {
      console.log('Lỗi Photon:', e.message);
    }

    // 2. Lấy thông tin Phường/Xã, Quận/Huyện, Tỉnh/Thành phố từ BigDataCloud API tiếng Việt
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=vi`
      );
      if (bdcRes.ok) {
        const data = await bdcRes.json();
        const city = data.city || data.principalSubdivision || '';
        const locality = data.locality || '';
        
        let district = '';
        if (Array.isArray(data.localityInfo?.informative)) {
          const dObj = data.localityInfo.informative.find(i => 
            i.name && (i.name.toLowerCase().includes('quận') || i.name.toLowerCase().includes('huyện') || i.name.toLowerCase().includes('thị xã') || i.name.toLowerCase().includes('district'))
          );
          if (dObj) district = dObj.name;
        }
        if (!district && Array.isArray(data.localityInfo?.administrative)) {
          const dObj = data.localityInfo.administrative.find(i => 
            i.name && (i.name.toLowerCase().includes('quận') || i.name.toLowerCase().includes('huyện') || i.name.toLowerCase().includes('thị xã') || i.name.toLowerCase().includes('phường'))
          );
          if (dObj) district = dObj.name;
        }

        const parts = [];
        if (streetOrPlace) parts.push(streetOrPlace);
        if (locality && locality !== city && !parts.includes(locality)) parts.push(locality);
        if (district && district !== locality && district !== city && !parts.includes(district)) parts.push(district);
        if (city && !parts.includes(city)) parts.push(city);

        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
    } catch (e) {
      console.log('Lỗi BigDataCloud:', e.message);
    }

    // Fallback hiển thị tọa độ GPS thực tế nếu các dịch vụ map quốc tế bận
    return `Tọa độ GPS thực tế (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  };

  // LẤY VỊ TRÍ HIỆN TẠI QUA GPS ĐIỆN THOẠI / TRÌNH DUYỆT (YÊU CẦU BẬT ĐỊNH VỊ)
  const handleGetGPSLocation = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Alert.alert(
        'Không hỗ trợ định vị ⚠️',
        'Thiết bị hoặc trình duyệt của bạn không hỗ trợ tính năng định vị vị trí GPS.'
      );
      return;
    }

    // Kiểm tra quyền nếu Permissions API có sẵn
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          Alert.alert(
            'Quyền vị trí đang bị chặn 🔒',
            'Trình duyệt/thiết bị của bạn đang CHẶN quyền truy cập vị trí của ứng dụng.\n\nHướng dẫn bật:\n1. Bấm vào biểu tượng ổ khóa 🔒 hoặc cài đặt trên thanh địa chỉ URL.\n2. Chọn "Cho phép truy cập vị trí" (Allow Location).\n3. Bật dịch vụ định vị (GPS) trong Cài đặt của máy rồi nhấn lại nút này.'
          );
          return;
        }
      } catch (e) {
        // Một số trình duyệt không hỗ trợ query permissions, bỏ qua để tiếp tục
      }
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          const accurateAddress = await reverseGeocodeCoords(latitude, longitude);
          setAddressText(accurateAddress);
          Alert.alert(
            'Đã định vị thành công 🎯',
            `Đã lấy được địa chỉ GPS chính xác:\n📍 ${accurateAddress}\n\n(Độ chính xác GPS: ~${Math.round(accuracy || 10)}m)\nBạn có thể kiểm tra và bổ sung số nhà/số phòng nếu cần.`,
            [{ text: 'Đồng ý' }]
          );
        } catch (err) {
          const coordText = `Vị trí GPS (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
          setAddressText(coordText);
          Alert.alert('Đã nhận diện tọa độ GPS 🎯', coordText);
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        let title = 'Yêu cầu bật Dịch vụ Vị trí ⚠️';
        let message = 'Không thể xác định vị trí hiện tại.';

        switch (error.code) {
          case 1: // PERMISSION_DENIED
            title = 'Chưa cấp quyền Vị trí 🔒';
            message = 'Bạn cần cho phép ứng dụng truy cập vị trí để tự động lấy địa chỉ chính xác.\n\n👉 Cách bật:\n1. Nhấn vào biểu tượng 🔒 hoặc ⚙️ cạnh thanh địa chỉ (URL) trên trình duyệt.\n2. Chuyển quyền "Vị trí" (Location) sang "Cho phép" (Allow).\n3. Bật GPS trên máy và nhấn lại nút Lấy vị trí.';
            break;
          case 2: // POSITION_UNAVAILABLE
            title = 'Chưa bật Dịch vụ Định vị (GPS) 📡';
            message = 'Dịch vụ định vị GPS trên điện thoại hoặc máy tính của bạn hiện đang TẮT.\n\n👉 Cách bật:\n1. Vuốt thanh cài đặt nhanh của điện thoại xuống và BẬT "Vị trí" (Location / GPS).\n2. Nếu dùng máy tính: Vào Cài đặt Windows -> Privacy & security -> Location -> Bật "Location services".\n3. Sau khi bật, bấm lại nút này để lấy vị trí chính xác.';
            break;
          case 3: // TIMEOUT
            title = 'Hết thời gian tìm kiếm GPS ⏳';
            message = 'Thiết bị mất quá nhiều thời gian để bắt sóng GPS. Vui lòng kiểm tra lại kết nối mạng và đảm bảo đã BẬT GPS ngoài trời/nơi thoáng, sau đó thử lại.';
            break;
          default:
            message = error.message || 'Không thể kết nối đến dịch vụ định vị GPS.';
            break;
        }

        Alert.alert(title, message, [{ text: 'Đã hiểu' }]);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 0 // Bắt buộc lấy tọa độ tươi mới nhất từ vệ tinh/mạng, không dùng cache cũ
      }
    );
  };

  const openAddModal = () => {
    setEditingId(null);
    setLabelType('Nhà riêng');
    setName('Trần Văn Đình');
    setPhone('0378876126');
    setAddressText('');
    setIsDefault(addresses.length === 0);
    setModalVisible(true);
  };

  const handleSaveAddress = async () => {
    if (!addressText.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập hoặc bấm nút lấy vị trí GPS để có địa chỉ giao hàng!');
      return;
    }

    const iconMap = {
      'Nhà riêng': '🏠',
      'Công ty': '🏢',
      'Khác': '📍'
    };

    let updated = [...addresses];
    if (editingId) {
      updated = updated.map(item => {
        if (item.id === editingId) {
          return {
            ...item,
            label: labelType,
            icon: iconMap[labelType] || '📍',
            name: name || 'Người nhận',
            phone: phone || '0378876126',
            address: addressText.trim(),
            isDefault: isDefault
          };
        }
        return isDefault ? { ...item, isDefault: false } : item;
      });
    } else {
      const newAddress = {
        id: Date.now().toString(),
        label: labelType,
        icon: iconMap[labelType] || '📍',
        name: name || 'Người nhận',
        phone: phone || '0378876126',
        address: addressText.trim(),
        isDefault: isDefault || addresses.length === 0
      };

      if (isDefault) {
        updated = updated.map(item => ({ ...item, isDefault: false }));
      }
      updated.unshift(newAddress);
    }

    setAddresses(updated);
    try {
      await AsyncStorage.setItem('saved_addresses', JSON.stringify(updated));
      const defaultAddr = updated.find(a => a.isDefault) || updated[0];
      await AsyncStorage.setItem('default_address', JSON.stringify(defaultAddr));
    } catch (e) {
      console.log('Lỗi lưu địa chỉ');
    }

    setModalVisible(false);
    Alert.alert('Thành công 🎉', 'Đã lưu địa chỉ vào Sổ địa chỉ nhận hàng!');
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
          {/* Nút bấm nhanh Lấy Vị Trí GPS Hiện Tại */}
          <TouchableOpacity 
            style={styles.gpsQuickCard}
            activeOpacity={0.8}
            onPress={() => {
              openAddModal();
              setTimeout(() => {
                handleGetGPSLocation();
              }, 300);
            }}
          >
            <View style={styles.gpsIconCircle}>
              <Text style={styles.gpsIconEmoji}>🎯</Text>
            </View>
            <View style={styles.gpsTextBox}>
              <Text style={styles.gpsTitle}>Lấy vị trí hiện tại của tôi qua GPS</Text>
              <Text style={styles.gpsDesc}>Tự động định vị địa chỉ nhà/công ty chính xác tức thì</Text>
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
                    <Text style={styles.labelIcon}>{item.icon}</Text>
                    <Text style={styles.labelText}>{item.label}</Text>
                    {item.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>✓ Mặc định</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteAddress(item.id)}
                  >
                    <Text style={styles.deleteBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.recipientText}>
                  {item.name} • <Text style={styles.phoneText}>{item.phone}</Text>
                </Text>
                <Text style={styles.detailAddressText}>{item.address}</Text>

                <View style={styles.cardFooterRow}>
                  <Text style={[styles.selectStatusText, item.isDefault && styles.selectedStatusText]}>
                    {item.isDefault ? 'Đang chọn giao tới đây' : 'Nhấp để chọn giao tới đây'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Nút Thêm Địa Chỉ ở Đáy */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.addNewBtn} onPress={openAddModal} activeOpacity={0.8}>
            <Text style={styles.addNewBtnText}>+ Thêm địa chỉ nhận hàng mới</Text>
          </TouchableOpacity>
        </View>

        {/* Modal Thêm Địa Chỉ Mới / Bật Định Vị GPS */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Thêm địa chỉ nhận hàng</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Nút Lấy GPS trong modal */}
              <TouchableOpacity 
                style={[styles.modalGpsBtn, locating && styles.modalGpsBtnLoading]}
                onPress={handleGetGPSLocation}
                disabled={locating}
                activeOpacity={0.8}
              >
                {locating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator color="#00A896" size="small" style={{ marginRight: 8 }} />
                    <Text style={styles.modalGpsText}>Đang lấy vị trí GPS từ thiết bị...</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.modalGpsIcon}>🎯</Text>
                    <Text style={styles.modalGpsText}>Bật GPS lấy vị trí hiện tại chính xác</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Thông báo hướng dẫn bật dịch vụ vị trí */}
              <View style={styles.gpsTipBox}>
                <Text style={styles.gpsTipText}>
                  💡 <Text style={{ fontWeight: 'bold' }}>Lưu ý:</Text> Cần <Text style={{ fontWeight: 'bold' }}>BẬT Vị trí (GPS)</Text> trên điện thoại/máy tính và bấm <Text style={{ fontWeight: 'bold' }}>"Cho phép"</Text> khi trình duyệt hỏi để xác định địa chỉ chính xác.
                </Text>
              </View>

              {/* Loại địa chỉ */}
              <Text style={styles.formLabel}>Loại địa chỉ:</Text>
              <View style={styles.typeRow}>
                {['Nhà riêng', 'Công ty', 'Khác'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, labelType === t && styles.typeBtnActive]}
                    onPress={() => setLabelType(t)}
                  >
                    <Text style={[styles.typeBtnText, labelType === t && styles.typeBtnTextActive]}>
                      {t === 'Nhà riêng' ? '🏠 Nhà riêng' : t === 'Công ty' ? '🏢 Công ty' : '📍 Khác'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Họ tên người nhận */}
              <Text style={styles.formLabel}>Tên người nhận hàng:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nhập họ tên người nhận..."
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />

              {/* Số điện thoại */}
              <Text style={styles.formLabel}>Số điện thoại:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nhập số điện thoại nhận hàng..."
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              {/* Địa chỉ chi tiết */}
              <Text style={styles.formLabel}>Địa chỉ chi tiết (Số nhà, đường, phường, quận):</Text>
              <TextInput
                style={[styles.modalInput, styles.textAreaInput]}
                placeholder="Nhập địa chỉ hoặc bấm nút lấy vị trí GPS phía trên..."
                placeholderTextColor="#94A3B8"
                value={addressText}
                onChangeText={setAddressText}
                multiline
              />

              {/* Checkbox Đặt làm mặc định */}
              <TouchableOpacity 
                style={styles.checkboxRow}
                activeOpacity={0.8}
                onPress={() => setIsDefault(!isDefault)}
              >
                <View style={[styles.checkboxBox, isDefault && styles.checkboxActive]}>
                  {isDefault && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Đặt làm địa chỉ nhận hàng mặc định</Text>
              </TouchableOpacity>

              {/* Nút lưu */}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAddress} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>Lưu và sử dụng địa chỉ này 📍</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    fontSize: 14,
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
    marginBottom: 10,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: 'bold',
    padding: 4,
  },
  modalGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2F1',
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#80CBC4',
  },
  modalGpsBtnLoading: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  gpsTipBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  gpsTipText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  modalGpsIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  modalGpsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00796B',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeBtnActive: {
    backgroundColor: '#E0F2F1',
    borderColor: '#00A896',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  typeBtnTextActive: {
    color: '#00A896',
    fontWeight: 'bold',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 12,
  },
  textAreaInput: {
    height: 70,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 4,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: '#00A896',
    borderColor: '#00A896',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#00A896',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
