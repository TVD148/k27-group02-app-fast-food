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
import * as Location from 'expo-location';

const INITIAL_ADDRESSES = [
  {
    id: '1',
    label: 'Nhà riêng',
    icon: '🏠',
    name: 'Trần Văn Đình',
    phone: '0378876126',
    address: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
    isDefault: true,
  },
  {
    id: '2',
    label: 'Trường học',
    icon: '🏫',
    name: 'Trần Văn Đình',
    phone: '0378876126',
    address: 'Trường Đại học Bình Dương (BDU), TP. Thủ Dầu Một, Bình Dương',
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
        // Khởi tạo địa chỉ ban đầu chuẩn khu vực
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
  const reverseGeocodeCoords = async (lat, lon, extraStreet = '') => {
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=vi`
      );
      if (bdcRes.ok) {
        const data = await bdcRes.json();
        const admin = data.localityInfo?.administrative || [];
        const info = data.localityInfo?.informative || [];

        // 1. Xác định Quận / Huyện / Thành phố trực thuộc
        let district = '';
        const districtObj = [...info, ...admin].find(i => {
          if (!i.name) return false;
          const n = i.name.toLowerCase();
          return (
            n.includes('quận') || 
            n.includes('huyện') || 
            n.includes('thị xã') || 
            n.includes('thủ đức') || 
            n.includes('thủ dầu một') || 
            n.includes('thu dau mot') || 
            n.includes('dĩ an') || 
            n.includes('di an') || 
            n.includes('thuận an') || 
            n.includes('thuan an') || 
            n.includes('bến cát') || 
            n.includes('ben cat') || 
            n.includes('tân uyên') || 
            n.includes('tan uyen') ||
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

        // 2. Xác định Tỉnh / Thành phố chính xác (Bình Dương, TP. Hồ Chí Minh, Đồng Nai...)
        let province = '';
        const dLow = (district || '').toLowerCase();
        const hcmDistricts = ['thủ đức', 'quận 1', 'quận 2', 'quận 3', 'quận 4', 'quận 5', 'quận 6', 'quận 7', 'quận 8', 'quận 9', 'quận 10', 'quận 11', 'quận 12', 'bình thạnh', 'gò vấp', 'tân bình', 'tân phú', 'phú nhuận', 'bình tân', 'nhà bè', 'hóc môn', 'củ chi', 'cần giờ', 'bình chánh'];
        const bdDistricts = ['thủ dầu một', 'dĩ an', 'thuận an', 'bến cát', 'tân uyên', 'bàu bàng', 'bắc tân uyên', 'dầu tiếng', 'phú giáo', 'bình dương'];

        if (hcmDistricts.some(d => dLow.includes(d))) {
          province = 'TP. Hồ Chí Minh';
        } else if (bdDistricts.some(d => dLow.includes(d))) {
          province = 'Bình Dương';
        } else {
          const provinceObj = [...info, ...admin].find(i => i.isoCode && i.isoCode.startsWith('VN-') && i.isoCode !== 'VN');
          province = provinceObj ? provinceObj.name : (data.principalSubdivision || data.city || '');
        }

        // 3. Xác định Phường / Xã
        let ward = '';
        const wardObj = admin.find(i => 
          i.adminLevel === 6 || 
          (i.description && (i.description.includes('phường') || i.description.includes('xã') || i.description.includes('thị trấn')))
        );
        if (wardObj) {
          ward = wardObj.name;
          const wLower = ward.toLowerCase();
          if (!wLower.startsWith('phường') && !wLower.startsWith('xã') && !wLower.startsWith('thị trấn')) {
            ward = (wardObj.description?.includes('xã') ? 'Xã ' : 'Phường ') + ward;
          }
        } else if (data.locality) {
          ward = data.locality;
          if (!ward.toLowerCase().startsWith('phường') && !ward.toLowerCase().startsWith('xã')) {
            ward = 'Phường ' + ward;
          }
        }

        const parts = [];
        // Lọc bỏ Plus Code Google (như WJHH+RMG)
        if (extraStreet && !extraStreet.includes('+') && !/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}$/i.test(extraStreet.trim())) {
          parts.push(extraStreet.trim());
        }
        if (ward && !parts.includes(ward)) parts.push(ward);
        if (district && district !== ward && district !== province && !parts.includes(district)) parts.push(district);
        if (province) {
          const pStr = (province.includes('Tỉnh') || province.includes('Thành phố') || province.includes('TP.')) 
            ? province 
            : (province === 'Hồ Chí Minh' ? 'TP. Hồ Chí Minh' : 'Tỉnh ' + province);
          if (!parts.includes(pStr)) parts.push(pStr);
        }

        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
    } catch (e) {
      console.log('Lỗi Geocode:', e.message);
    }

    return `Vị trí GPS thực tế (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  };

  // LẤY VỊ TRÍ HIỆN TẠI QUA GPS ĐIỆN THOẠI (EXPO-LOCATION NATIVE) & WEB TRÌNH DUYỆT
  const handleGetGPSLocation = async () => {
    setLocating(true);

    // ========================================================
    // CÁCH 1: DÙNG EXPO-LOCATION GỐC (DÀNH CHO ĐIỆN THOẠI MOBILE ANDROID / IOS)
    // ========================================================
    try {
      if (Location && Location.requestForegroundPermissionsAsync) {
        // 1. Kiểm tra xem điện thoại đã bật dịch vụ vị trí (GPS phần cứng) chưa
        if (Location.hasServicesEnabledAsync) {
          const isGpsOn = await Location.hasServicesEnabledAsync();
          if (!isGpsOn) {
            Alert.alert(
              'Chưa bật Dịch vụ Vị trí (GPS) 📡',
              'Dịch vụ định vị GPS trên điện thoại của bạn hiện đang TẮT.\n\n👉 Vui lòng vuốt thanh cài đặt nhanh của điện thoại xuống và BẬT "Vị trí" (Location / GPS), sau đó nhấn lại nút này để lấy vị trí chính xác!'
            );
            setLocating(false);
            return;
          }
        }

        // 2. Yêu cầu cấp quyền truy cập vị trí trên điện thoại (Hệ điều hành Android / iOS)
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Chưa cấp quyền Vị trí trên điện thoại 🔒',
            'Ứng dụng cần bạn cho phép truy cập vị trí để tự động lấy địa chỉ nhận hàng.\n\n👉 Vui lòng vào Cài đặt điện thoại -> Ứng dụng -> Fast Food -> Quyền -> Cho phép "Vị trí" (Location: Allow) rồi thử lại!'
          );
          setLocating(false);
          return;
        }

        // 3. Lấy tọa độ GPS độ chính xác cao nhất từ phần cứng điện thoại
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        const { latitude, longitude, accuracy } = position.coords;

        // 4. Lấy tên đường thật từ thiết bị (LOẠI BỎ TRIỆT ĐỂ PLUS CODE NHƯ WJHH+RMG)
        let realStreet = '';
        try {
          if (Location.reverseGeocodeAsync) {
            const geoList = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geoList && geoList.length > 0) {
              const g = geoList[0];
              const candidate = (g.street || '').trim();
              // Chỉ lấy nếu không phải là mã Plus Code (chứa dấu +)
              if (candidate && !candidate.includes('+') && !/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}$/i.test(candidate)) {
                realStreet = [g.streetNumber, candidate].filter(Boolean).join(' ');
              }
            }
          }
        } catch (nativeGeoErr) {
          console.log('Chuyển sang geocode dự phòng:', nativeGeoErr.message);
        }

        // 5. Kết hợp với bộ bóc tách Phường / Quận / Tỉnh tiếng Việt chuẩn
        const detectedAddress = await reverseGeocodeCoords(latitude, longitude, realStreet);

        setAddressText(detectedAddress);
        Alert.alert(
          'Đã định vị thành công 🎯',
          `Đã lấy được địa chỉ GPS chính xác trên điện thoại:\n📍 ${detectedAddress}\n\n(Độ chính xác GPS: ~${Math.round(accuracy || 5)}m)\nBạn có thể bổ sung số nhà/số phòng nếu cần.`,
          [{ text: 'Sử dụng địa chỉ này' }]
        );
        setLocating(false);
        return;
      }
    } catch (expoErr) {
      console.log('Expo-location thử fallback browser:', expoErr.message);
    }

    // ========================================================
    // CÁCH 2: DÙNG NAVIGATOR.GEOLOCATION (DÀNH CHO TRÌNH DUYỆT WEB HOẶC GIẢ LẬP)
    // ========================================================
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          try {
            const accurateAddress = await reverseGeocodeCoords(latitude, longitude);
            setAddressText(accurateAddress);
            Alert.alert(
              'Đã định vị thành công 🎯',
              `Đã lấy được địa chỉ GPS chính xác:\n📍 ${accurateAddress}\n\n(Độ chính xác: ~${Math.round(accuracy || 10)}m)`,
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
          maximumAge: 0 
        }
      );
    } else {
      setLocating(false);
      Alert.alert(
        'Không thể truy cập GPS ⚠️',
        'Thiết bị chưa hỗ trợ truy cập GPS tự động. Vui lòng nhập địa chỉ trực tiếp vào ô bên dưới.'
      );
    }
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
