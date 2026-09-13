import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
  Platform,
  Dimensions
} from 'react-native';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

export default function MapLocationPicker({
  initialCoords = { lat: 10.9901, lng: 106.6644 }, // Mặc định khu vực Đại học Bình Dương
  initialAddress = '',
  initialName = '',
  initialPhone = '',
  initialLabel = 'Nhà riêng',
  onConfirmLocation,
  onClose
}) {
  const [coords, setCoords] = useState(initialCoords);
  const [address, setAddress] = useState(initialAddress);
  const [detailNote, setDetailNote] = useState('');
  const [recipientName, setRecipientName] = useState(initialName);
  const [recipientPhone, setRecipientPhone] = useState(initialPhone);
  const [labelType, setLabelType] = useState(initialLabel);

  // States tìm kiếm gợi ý địa điểm (Places Autocomplete)
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Trạng thái GPS
  const [locating, setLocating] = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => {
    // Nếu chưa có địa chỉ ban đầu, tự động phân tích tọa độ ban đầu
    if (!initialAddress) {
      resolveAddressFromCoords(coords.lat, coords.lng);
    } else {
      setAddress(initialAddress);
    }
  }, []);

  useEffect(() => {
    if (initialName) setRecipientName(initialName);
    if (initialPhone) setRecipientPhone(initialPhone);
  }, [initialName, initialPhone]);

  // 1. TÌM KIẾM ĐỊA ĐIỂM GỢI Ý THÔNG MINH (PLACES AUTOCOMPLETE NHƯ SHOPEE)
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!text || text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const query = text.trim();
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.features && data.features.length > 0) {
            const list = data.features.map((f, idx) => {
              const p = f.properties;
              const name = p.name || '';
              const street = [p.housenumber, p.street].filter(Boolean).join(' ');
              const district = p.district || '';
              const city = p.city || p.state || '';
              const subText = [street, district, city].filter(Boolean).join(', ');
              return {
                id: idx.toString(),
                mainText: name || street || 'Địa điểm tìm thấy',
                secondaryText: subText,
                fullAddress: [name, street, district, city].filter(Boolean).join(', '),
                coords: {
                  lat: f.geometry.coordinates[1],
                  lng: f.geometry.coordinates[0]
                }
              };
            });
            setSuggestions(list);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        }
      } catch (err) {
        console.log('Lỗi Places Autocomplete:', err);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  // Chọn 1 địa điểm từ danh sách gợi ý -> Ghim bản đồ bay tới vị trí đó
  const handleSelectSuggestion = (item) => {
    setShowSuggestions(false);
    setSearchQuery(item.mainText);
    setCoords(item.coords);
    resolveAddressFromCoords(item.coords.lat, item.coords.lng, item.mainText);
  };

  // 2. REVERSE GEOCODING TỪ TỌA ĐỘ RA ĐỊA CHỈ TIẾNG VIỆT CHUẨN XÁC
  const resolveAddressFromCoords = async (lat, lon, extraStreet = '') => {
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=vi`
      );
      if (bdcRes.ok) {
        const data = await bdcRes.json();
        const admin = data.localityInfo?.administrative || [];
        const info = data.localityInfo?.informative || [];

        // Quận / Huyện / TP thuộc tỉnh
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

        // Tỉnh / Thành phố
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

        // Phường / Xã
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
        // Lọc bỏ Plus Code (như WJHH+RMG)
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
          setAddress(parts.join(', '));
          return;
        }
      }
    } catch (e) {
      console.log('Lỗi geocode:', e);
    }
    setAddress(`Tọa độ GPS (${lat.toFixed(5)}, ${lon.toFixed(5)})`);
  };

  // 3. ĐỊNH VỊ GPS THỰC TẾ CỦA THIẾT BỊ (FUSED LOCATION / NATIVE GPS)
  const handleGetCurrentGPS = async () => {
    setLocating(true);
    try {
      if (Location && Location.requestForegroundPermissionsAsync) {
        if (Location.hasServicesEnabledAsync) {
          const enabled = await Location.hasServicesEnabledAsync();
          if (!enabled) {
            Alert.alert(
              'Chưa bật GPS 📡',
              'Vui lòng vuốt thanh cài đặt nhanh của máy và BẬT "Vị trí" (GPS) để ứng dụng định vị chính xác!'
            );
            setLocating(false);
            return;
          }
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Chưa cấp quyền Vị trí 🔒',
            'Vui lòng cấp quyền truy cập vị trí cho ứng dụng trong Cài đặt của máy để tự động định vị!'
          );
          setLocating(false);
          return;
        }

        // Bắt sóng GPS vệ tinh / FusedLocation nhanh trong 2-3s
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });

        // Tìm tên đường nếu có
        let realStreet = '';
        try {
          if (Location.reverseGeocodeAsync) {
            const geoList = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geoList && geoList.length > 0) {
              const g = geoList[0];
              const candidate = (g.street || '').trim();
              if (candidate && !candidate.includes('+') && !/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}$/i.test(candidate)) {
                realStreet = [g.streetNumber, candidate].filter(Boolean).join(' ');
              }
            }
          }
        } catch (e) {}

        await resolveAddressFromCoords(latitude, longitude, realStreet);
        Alert.alert('Đã định vị thành công 🎯', `Vị trí đã được kéo về tâm bản đồ (Độ chính xác: ~${Math.round(accuracy || 5)}m)`);
      }
    } catch (err) {
      console.log('Lỗi lấy GPS:', err);
      // Fallback web
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (p) => {
            const { latitude, longitude } = p.coords;
            setCoords({ lat: latitude, lng: longitude });
            await resolveAddressFromCoords(latitude, longitude);
          },
          (geoErr) => {
            Alert.alert('Lỗi GPS', 'Không thể lấy vị trí GPS: ' + geoErr.message);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    } finally {
      setLocating(false);
    }
  };

  // 4. XÁC NHẬN VÀ LƯU ĐỊA CHỈ (BẮT BUỘC NHẬP TÊN, SĐT, ĐỊA CHỈ)
  const handleConfirm = () => {
    const cleanName = (recipientName || '').trim();
    const cleanPhone = (recipientPhone || '').trim();
    const cleanAddress = (address || '').trim();

    if (!cleanName) {
      Alert.alert('Thiếu thông tin ⚠️', 'Vui lòng nhập họ và tên người nhận hàng!');
      return;
    }

    if (!cleanPhone) {
      Alert.alert('Thiếu thông tin ⚠️', 'Vui lòng nhập số điện thoại người nhận hàng!');
      return;
    }

    // Kiểm tra định dạng số điện thoại Việt Nam (10 chữ số, bắt đầu bằng 0)
    const phoneRegex = /^0[0-9]{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert('Số điện thoại không hợp lệ ⚠️', 'Vui lòng nhập đúng số điện thoại gồm 10 chữ số (ví dụ: 0912345678)!');
      return;
    }

    if (!cleanAddress) {
      Alert.alert('Thiếu thông tin ⚠️', 'Vui lòng chọn hoặc ghim vị trí địa chỉ nhận hàng trên bản đồ!');
      return;
    }

    const iconMap = {
      'Nhà riêng': '🏠',
      'Văn phòng': '🏢',
      'Khác': '📍'
    };

    // Kết hợp số nhà/ngõ hẻm chi tiết nếu có
    const fullAddress = detailNote.trim() 
      ? `${detailNote.trim()}, ${cleanAddress}`
      : cleanAddress;

    const locationData = {
      id: Date.now().toString(),
      label: labelType,
      icon: iconMap[labelType] || '📍',
      name: cleanName,
      phone: cleanPhone,
      address: fullAddress,
      coords: coords,
      isDefault: true
    };

    if (onConfirmLocation) {
      onConfirmLocation(locationData);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. HEADER TÌM KIẾM VÀ GỢI Ý ĐỊA ĐIỂM (PLACES AUTOCOMPLETE) */}
      <View style={styles.topSearchHeader}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm tên đường, trường học, tòa nhà..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {searching ? (
            <ActivityIndicator size="small" color="#00A896" style={{ marginRight: 8 }} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); }}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* DANH SÁCH GỢI Ý ĐỊA ĐIỂM XUẤT HIỆN TỨC THÌ DẠNG DROPDOWN */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }}>
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestionItem}
                activeOpacity={0.7}
                onPress={() => handleSelectSuggestion(item)}
              >
                <Text style={styles.suggestionPin}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionMainText} numberOfLines={1}>{item.mainText}</Text>
                  {item.secondaryText ? (
                    <Text style={styles.suggestionSubText} numberOfLines={1}>{item.secondaryText}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 2. KHUNG BẢN ĐỒ VÀ CON GHIM VỊ TRÍ CHUẨN SHOPEE */}
      <View style={styles.mapViewport}>
        {/* Bản đồ nhúng OpenStreetMap Mapnik với tâm ghim */}
        {Platform.OS === 'web' ? (
          <iframe
            title="Bản đồ định vị"
            style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'auto' }}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.006}%2C${coords.lat - 0.004}%2C${coords.lng + 0.006}%2C${coords.lat + 0.004}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
          />
        ) : (
          <View style={styles.nativeMapPlaceholder}>
            <Text style={styles.nativeMapEmoji}>🗺️</Text>
            <Text style={styles.nativeMapCoordText}>Tọa độ ghim: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</Text>
          </View>
        )}

        {/* CON GHIM ĐỎ CỐ ĐỊNH Ở TRUNG TÂM BẢN ĐỒ VỚI HIỆU ỨNG TỌA ĐỘ NHƯ SHOPEE */}
        <View style={styles.centerPinContainer} pointerEvents="none">
          <View style={styles.pinBubble}>
            <Text style={styles.pinBubbleText}>Giao đến vị trí này</Text>
          </View>
          <Text style={styles.centerPinIcon}>📍</Text>
          <View style={styles.pinShadow} />
        </View>

        {/* NÚT TRÒN LẤY LẠI GPS CỦA TÔI NỔI TRÊN BẢN ĐỒ */}
        <TouchableOpacity 
          style={styles.gpsFloatingBtn} 
          onPress={handleGetCurrentGPS}
          activeOpacity={0.8}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#00A896" />
          ) : (
            <Text style={styles.gpsFloatingIcon}>🎯</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 3. THẺ THÔNG TIN ĐỊA CHỈ & XÁC NHẬN GIAO HÀNG PHÍA DƯỚI BẢN ĐỒ */}
      <View style={styles.bottomCard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          {/* Địa chỉ phân tích được */}
          <View style={styles.addressSummaryRow}>
            <View style={styles.pinRedCircle}>
              <Text style={{ fontSize: 16 }}>📍</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.addressLabelHeader}>
                Địa chỉ đã chọn <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>*</Text>:
              </Text>
              <Text style={styles.addressDisplayValue} numberOfLines={2}>
                {address || 'Đang lấy thông tin địa chỉ từ bản đồ...'}
              </Text>
            </View>
          </View>

          {/* Ô nhập số nhà / ngõ hẻm / số phòng bổ sung */}
          <Text style={styles.inputLabel}>Số nhà, tên ngõ hẻm, số phòng (Không bắt buộc):</Text>
          <TextInput
            style={styles.detailInput}
            placeholder="Ví dụ: Số 12 hẻm 45, Căn hộ A201, Tòa BDU..."
            placeholderTextColor="#94A3B8"
            value={detailNote}
            onChangeText={setDetailNote}
          />

          {/* Loại địa chỉ */}
          <View style={styles.labelTypeRow}>
            {['Nhà riêng', 'Văn phòng', 'Khác'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, labelType === type && styles.typeChipActive]}
                onPress={() => setLabelType(type)}
                activeOpacity={0.7}
              >
                <Text style={[styles.typeChipText, labelType === type && styles.typeChipTextActive]}>
                  {type === 'Nhà riêng' ? '🏠 Nhà riêng' : type === 'Văn phòng' ? '🏢 Văn phòng' : '📍 Khác'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Thông tin liên hệ */}
          <View style={styles.contactRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>
                Tên người nhận <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>*</Text>:
              </Text>
              <TextInput
                style={styles.contactInput}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Họ và tên..."
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.inputLabel}>
                Số điện thoại <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>*</Text>:
              </Text>
              <TextInput
                style={styles.contactInput}
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                placeholder="Số điện thoại (10 số)..."
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* NÚT XÁC NHẬN VỊ TRÍ */}
          <TouchableOpacity 
            style={styles.confirmBtn} 
            activeOpacity={0.85}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmBtnText}>Xác nhận vị trí giao hàng ➔</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 50,
  },
  closeBtn: {
    padding: 6,
    marginRight: 10,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 0,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#94A3B8',
    paddingHorizontal: 6,
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 65,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionPin: {
    fontSize: 18,
    marginRight: 12,
  },
  suggestionMainText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  suggestionSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  mapViewport: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  nativeMapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  nativeMapEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  nativeMapCoordText: {
    fontSize: 13,
    color: '#0369A1',
    fontWeight: '600',
  },
  centerPinContainer: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: [{ translateX: -18 }, { translateY: -45 }],
    alignItems: 'center',
    zIndex: 30,
  },
  pinBubble: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 4,
    elevation: 4,
  },
  pinBubbleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  centerPinIcon: {
    fontSize: 36,
  },
  pinShadow: {
    width: 12,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    marginTop: -2,
  },
  gpsFloatingBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gpsFloatingIcon: {
    fontSize: 22,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: height * 0.45,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  addressSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pinRedCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLabelHeader: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  addressDisplayValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: 'bold',
    marginTop: 2,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 6,
  },
  detailInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 12,
  },
  labelTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeChipActive: {
    backgroundColor: '#E0F2F1',
    borderColor: '#00A896',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  typeChipTextActive: {
    color: '#00796B',
    fontWeight: 'bold',
  },
  contactRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  contactInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1E293B',
  },
  confirmBtn: {
    backgroundColor: '#00A896',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    elevation: 2,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
