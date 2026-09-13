import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Image,
  KeyboardAvoidingView, 
  Platform,
  SafeAreaView 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  createOrder, 
  applyVoucher, 
  fetchVouchers, 
  generateVietQR, 
  confirmPayment, 
  fetchStoreLandmark,
  fetchUserAddresses 
} from '../services/api';

function calculateHaversine(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const p1 = parseFloat(lat1);
  const l1 = parseFloat(lon1);
  const p2 = parseFloat(lat2);
  const l2 = parseFloat(lon2);
  if (isNaN(p1) || isNaN(l1) || isNaN(p2) || isNaN(l2)) return null;

  const R = 6371; // km
  const dLat = (p2 - p1) * Math.PI / 180;
  const dLon = (l2 - l1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1 * Math.PI / 180) * Math.cos(p2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
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

export default function CheckoutScreen({ route, navigation }) {
  const { cartData, grandTotal: initialGrandTotal } = route.params || {};

  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('tien_mat');
  const [submitting, setSubmitting] = useState(false);

  // Voucher states
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [availableVouchers, setAvailableVouchers] = useState([]);
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  // VietQR states
  const [vietQrData, setVietQrData] = useState(null);
  const [generatingQr, setGeneratingQr] = useState(false);

  // Mốc quán & Tính khoảng cách
  const [storeLandmark, setStoreLandmark] = useState({
    dia_chi_quan: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
    vi_do: 10.9805,
    kinh_do: 106.6745,
    ban_kinh_phuc_vu_km: 3.0,
    gia_ship_moi_km: 5000
  });

  const customerCoords = defaultAddress?.coords;
  const distanceKm = (customerCoords && storeLandmark)
    ? calculateHaversine(storeLandmark.vi_do, storeLandmark.kinh_do, customerCoords.lat, customerCoords.lng)
    : null;

  const maxRadius = storeLandmark?.ban_kinh_phuc_vu_km || 3.0;
  const isOutOfRange = distanceKm !== null && distanceKm > maxRadius;

  const rawSubtotal = cartData?.tong_tien || (initialGrandTotal ? initialGrandTotal - 5000 : 0);
  // Quy tắc tính tiền ship mới: dưới 1km là 5.000đ, từ 1km trở đi cứ 1km thêm 5k, 100m thêm 500đ
  const shippingFee = calculateShippingFee(distanceKm);

  // Phân loại voucher: Miễn phí vận chuyển (Freeship) hay Giảm giá món ăn
  const isFreeshipVoucher = appliedVoucher ? (
    appliedVoucher.loai_ap_dung === 'phi_ship' ||
    (appliedVoucher.ma_code && appliedVoucher.ma_code.toUpperCase().includes('SHIP')) ||
    (appliedVoucher.ten_voucher && appliedVoucher.ten_voucher.toLowerCase().includes('vận chuyển'))
  ) : false;

  let actualDiscount = 0;
  if (appliedVoucher) {
    if (isFreeshipVoucher) {
      // FREESHIP: Chỉ được giảm tối đa bằng đúng tiền ship, tuyệt đối không trừ qua tiền món ăn!
      if (appliedVoucher.loai_giam_gia === 'phan_tram') {
        let disc = (shippingFee * parseFloat(appliedVoucher.gia_tri_giam)) / 100;
        if (appliedVoucher.giam_toi_da && parseFloat(appliedVoucher.giam_toi_da) > 0) {
          disc = Math.min(disc, parseFloat(appliedVoucher.giam_toi_da));
        }
        actualDiscount = Math.min(Math.round(disc), shippingFee);
      } else {
        actualDiscount = Math.min(parseFloat(appliedVoucher.gia_tri_giam), shippingFee);
      }
    } else {
      // GIẢM MÓN: Chỉ được giảm tối đa bằng đúng tiền món ăn!
      if (appliedVoucher.loai_giam_gia === 'phan_tram') {
        let disc = (rawSubtotal * parseFloat(appliedVoucher.gia_tri_giam)) / 100;
        if (appliedVoucher.giam_toi_da && parseFloat(appliedVoucher.giam_toi_da) > 0) {
          disc = Math.min(disc, parseFloat(appliedVoucher.giam_toi_da));
        }
        actualDiscount = Math.min(Math.round(disc), rawSubtotal);
      } else {
        actualDiscount = Math.min(parseFloat(appliedVoucher.gia_tri_giam), rawSubtotal);
      }
    }
  }

  // Tiền thanh toán cuối cùng
  const grandTotal = isFreeshipVoucher
    ? rawSubtotal + Math.max(0, shippingFee - actualDiscount)
    : Math.max(0, rawSubtotal - actualDiscount) + shippingFee;

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDeliveryAddress();
      loadLandmark();
    });
    loadDeliveryAddress();
    loadPublicVouchers();
    loadLandmark();
    return unsubscribe;
  }, [navigation]);

  const loadLandmark = async () => {
    try {
      const res = await fetchStoreLandmark();
      if (res.success && res.data) {
        setStoreLandmark(res.data);
      }
    } catch (e) {
      console.log('Dùng mốc quán mặc định:', e);
    }
  };

  const loadDeliveryAddress = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user_info');
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (user && user.so_dien_thoai) {
        setPhone(user.so_dien_thoai);
      }

      // 1. Kiểm tra tài khoản đã đăng nhập
      const userKey = user ? (user.ma_nguoi_dung || user.id || user.so_dien_thoai) : null;
      if (!userKey) {
        setDefaultAddress(null);
        setAddress('');
        return;
      }

      // 2. Lấy trực tiếp từ Database MySQL
      try {
        const res = await fetchUserAddresses();
        if (res && res.success && Array.isArray(res.data)) {
          const list = res.data;
          if (list.length > 0) {
            const chosen = list.find(a => a.isDefault) || list[0];
            setDefaultAddress(chosen);
            setAddress(chosen.address || '');
            setPhone(chosen.phone || user?.so_dien_thoai || '');
            return;
          } else {
            // Danh sách rỗng trong Database -> Không có địa chỉ mặc định
            setDefaultAddress(null);
            setAddress('');
            return;
          }
        }
      } catch (dbErr) {
        console.log('Chưa lấy được địa chỉ từ database, thử bộ nhớ máy:', dbErr.message);
      }

      // 3. Fallback lấy danh sách địa chỉ từ AsyncStorage nếu offline
      const savedListStr = await AsyncStorage.getItem(`saved_addresses_${userKey}`);
      if (savedListStr) {
        const list = JSON.parse(savedListStr);
        if (Array.isArray(list) && list.length > 0) {
          const storedDefaultStr = await AsyncStorage.getItem(`default_address_${userKey}`);
          let chosen = null;
          if (storedDefaultStr) {
            const parsedDefault = JSON.parse(storedDefaultStr);
            chosen = list.find(a => a.id === parsedDefault.id || a.address === parsedDefault.address);
          }
          if (!chosen) {
            chosen = list.find(a => a.isDefault) || list[0];
          }
          setDefaultAddress(chosen);
          setAddress(chosen.address || '');
          setPhone(chosen.phone || user?.so_dien_thoai || '');
          return;
        }
      }

      // 4. Nếu tài khoản chưa từng lưu địa chỉ nào trong sổ địa chỉ: để trống hoàn toàn
      setDefaultAddress(null);
      setAddress('');
    } catch (e) {
      console.log('Không thể tải địa chỉ giao hàng:', e);
      setDefaultAddress(null);
      setAddress('');
    }
  };

  const loadPublicVouchers = async () => {
    try {
      const response = await fetchVouchers();
      if (response.success) {
        setAvailableVouchers(response.data || []);
      }
    } catch (e) {
      console.log('Chưa tải được danh sách voucher');
    }
  };

  const handleApplyVoucher = async (codeToApply) => {
    const targetCode = codeToApply || voucherCode;
    if (!targetCode.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã giảm giá!');
      return;
    }

    setApplyingVoucher(true);
    try {
      const response = await applyVoucher(targetCode, rawSubtotal, shippingFee);
      if (response.success) {
        setAppliedVoucher(response.data);
        setVoucherCode(response.data.ma_code);
        Alert.alert('Thành công 🎉', response.message);
      }
    } catch (error) {
      Alert.alert('Không thể áp dụng', error.message || 'Mã giảm giá không hợp lệ!');
      setAppliedVoucher(null);
    } finally {
      setApplyingVoucher(false);
    }
  };

  const handlePaymentMethodChange = (methodKey) => {
    setPaymentMethod(methodKey);
  };

  const handlePlaceOrder = async () => {
    const token = await AsyncStorage.getItem('user_token');
    if (!token) {
      Alert.alert(
        'Yêu cầu đăng nhập 🔒',
        'Bạn cần đăng nhập tài khoản để tiến hành đặt hàng và thanh toán!',
        [
          { text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') },
          { text: 'Để sau', style: 'cancel' }
        ]
      );
      return;
    }

    const finalAddress = (defaultAddress?.address || address || '').trim();
    const finalPhone = (defaultAddress?.phone || phone || '').trim();

    if (!finalAddress) {
      Alert.alert('Chưa có địa chỉ giao hàng', 'Vui lòng chọn hoặc thêm địa chỉ nhận hàng trước khi thanh toán!', [
        { text: 'Chọn địa chỉ ngay ➔', onPress: () => navigation.navigate('Address') },
        { text: 'Để sau', style: 'cancel' }
      ]);
      return;
    }
    if (!finalPhone) {
      Alert.alert('Lỗi', 'Vui lòng cung cấp số điện thoại nhận hàng!');
      return;
    }

    if (isOutOfRange) {
      Alert.alert(
        'Vượt quá phạm vi 3km 🚫',
        `Quán chỉ nhận giao hàng trong bán kính ${maxRadius}km từ quán (${storeLandmark?.dia_chi_quan || '504 Đại lộ Bình Dương'}). Vị trí hiện tại của bạn cách quán ${distanceKm} km. Vui lòng chọn địa chỉ khác trong phạm vi 3km!`,
        [
          { text: 'Chọn lại địa chỉ ➔', onPress: () => navigation.navigate('Address') },
          { text: 'Đóng', style: 'cancel' }
        ]
      );
      return;
    }

    setSubmitting(true);
    try {
      // Gọi API tạo đơn hàng kèm tọa độ để hệ thống xác thực khoảng cách & tính phí ship
      const response = await createOrder(
        finalAddress, 
        finalPhone, 
        note, 
        paymentMethod, 
        appliedVoucher ? appliedVoucher.ma_code : null,
        customerCoords
      );

      if (response.success) {
        const newOrderId = response.data.ma_don_hang;

        // Nếu phương thức là VietQR / Chuyển khoản, sinh mã QR động
        if (paymentMethod === 'vietqr' || paymentMethod === 'chuyen_khoan') {
          setGeneratingQr(true);
          try {
            const qrRes = await generateVietQR(newOrderId);
            if (qrRes.success) {
              setVietQrData(qrRes.data);
              Alert.alert(
                'Tạo đơn thành công! 📱',
                'Đơn hàng của bạn đang chờ xác nhận từ nhà bếp. Hãy quét mã VietQR để hoàn tất chuyển khoản!',
                [
                  { 
                    text: 'Xem mã QR VietQR', 
                    onPress: () => {
                      navigation.navigate('OrderTracking', { orderId: newOrderId });
                    } 
                  }
                ]
              );
              return;
            }
          } catch (qrErr) {
            console.log('Lỗi sinh VietQR:', qrErr.message);
          } finally {
            setGeneratingQr(false);
          }
        }

        Alert.alert(
          'Đặt hàng thành công! 🎉',
          'Đơn hàng của bạn đang chờ xác nhận từ nhà bếp.',
          [
            { 
              text: 'Theo dõi đơn hàng', 
              onPress: () => {
                navigation.navigate('OrderTracking', { orderId: newOrderId });
              } 
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Đặt hàng thất bại', error.message || 'Có lỗi xảy ra khi tạo đơn hàng!');
    } finally {
      setSubmitting(false);
    }
  };

  const paymentOptions = [
    { key: 'tien_mat', label: '💵 Tiền mặt khi nhận hàng (COD)', desc: 'Thanh toán trực tiếp cho shipper khi nhận đồ ăn' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. SECTION KHUYẾN MÃI (VOUCHER / MÃ GIẢM GIÁ) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🎁 Mã giảm giá & Voucher ưu đãi</Text>
            
            <View style={styles.voucherInputRow}>
              <TextInput
                style={styles.voucherInput}
                placeholder="Nhập mã voucher (VD: FAST30, HELLO2026)"
                placeholderTextColor="#999"
                value={voucherCode}
                onChangeText={setVoucherCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity 
                style={[styles.applyBtn, applyingVoucher && styles.btnDisabled]} 
                onPress={() => handleApplyVoucher(voucherCode)}
                disabled={applyingVoucher}
              >
                {applyingVoucher ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.applyBtnText}>Áp dụng</Text>
                )}
              </TouchableOpacity>
            </View>

            {appliedVoucher && (
              <View style={styles.appliedSuccessCard}>
                <Text style={styles.appliedSuccessTitle}>✅ Đã áp dụng: {appliedVoucher.ten_voucher}</Text>
                <Text style={styles.appliedSuccessDetail}>
                  Tiết kiệm được: <Text style={styles.highlightText}>-{appliedVoucher.so_tien_giam.toLocaleString('vi-VN')} đ</Text>
                </Text>
              </View>
            )}

            {/* Danh sách gợi ý các voucher hot */}
            {availableVouchers.length > 0 && (
              <View style={styles.suggestVouchersContainer}>
                <Text style={styles.suggestTitle}>Gợi ý mã ưu đãi hot dành cho bạn:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voucherScrollView}>
                  {availableVouchers.map((v) => {
                    const isFs = v.loai_ap_dung === 'phi_ship' || 
                                 (v.ma_code && v.ma_code.toUpperCase().includes('SHIP')) || 
                                 (v.ten_voucher && v.ten_voucher.toLowerCase().includes('vận chuyển'));
                    const isUsed = !!v.da_su_dung;
                    return (
                      <TouchableOpacity 
                        key={v.ma_voucher}
                        style={[styles.voucherChip, isUsed && { opacity: 0.65, backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}
                        onPress={() => {
                          if (isUsed) {
                            Alert.alert('Đã sử dụng', `Mã giảm giá '${v.ma_code}' đã được sử dụng trên tài khoản của bạn! Mỗi tài khoản chỉ được dùng mã này 1 lần.`);
                            return;
                          }
                          setVoucherCode(v.ma_code);
                          handleApplyVoucher(v.ma_code);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={[styles.voucherChipCode, isUsed && { color: '#64748B', textDecorationLine: 'line-through' }]}>
                            {v.ma_code}
                          </Text>
                          {isUsed ? (
                            <Text style={[styles.voucherTypeBadge, { backgroundColor: '#E2E8F0', color: '#64748B' }]}>
                              🔒 Đã sử dụng
                            </Text>
                          ) : (
                            <Text style={[styles.voucherTypeBadge, isFs ? styles.voucherTypeFs : styles.voucherTypeFood]}>
                              {isFs ? '🚚 Freeship' : '🍔 Giảm món'}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.voucherChipDesc, isUsed && { color: '#94A3B8' }]}>{v.ten_voucher}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* 2. SECTION PHƯƠNG THỨC THANH TOÁN */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>💳 Phương thức thanh toán</Text>

            {paymentOptions.map((opt) => {
              const isSelected = paymentMethod === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.paymentCard, isSelected && styles.paymentCardSelected]}
                  onPress={() => handlePaymentMethodChange(opt.key)}
                >
                  <View style={styles.radioCircle}>
                    {isSelected && <View style={styles.radioSelected} />}
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={[styles.paymentLabel, isSelected && styles.paymentLabelSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.paymentDesc}>{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>



          {/* 4. SECTION THÔNG TIN GIAO HÀNG (TỰ ĐỘNG LẤY ĐỊA CHỈ MẶC ĐỊNH) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>📍 Địa chỉ nhận hàng</Text>
              <TouchableOpacity 
                style={styles.changeAddressBtn}
                onPress={() => navigation.navigate('Address')}
                activeOpacity={0.7}
              >
                <Text style={styles.changeAddressBtnText}>Thay đổi ➔</Text>
              </TouchableOpacity>
            </View>

            {defaultAddress ? (
              <TouchableOpacity 
                style={styles.defaultAddressCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Address')}
              >
                <View style={styles.addressCardTop}>
                  <View style={styles.addressLabelBadge}>
                    <Text style={styles.addressLabelEmoji}>{defaultAddress.icon || '🏠'}</Text>
                    <Text style={styles.addressLabelText}>{defaultAddress.label || 'Địa chỉ nhận hàng'}</Text>
                  </View>
                  <View style={styles.defaultTag}>
                    <Text style={styles.defaultTagText}>Mặc định</Text>
                  </View>
                </View>

                <View style={styles.addressInfoRow}>
                  <Text style={styles.recipientNamePhone}>
                    👤 {defaultAddress.name || 'Người nhận'} • 📞 {defaultAddress.phone || phone || 'Chưa có SĐT'}
                  </Text>
                </View>

                <Text style={styles.addressDetailText}>
                  {defaultAddress.address || address}
                </Text>

                {/* Khoảng cách tới mốc quán & Bán kính 3km */}
                {distanceKm !== null ? (
                  <View style={[styles.distanceBadge, isOutOfRange && styles.distanceBadgeOutOfRange]}>
                    <Text style={[styles.distanceBadgeText, isOutOfRange && styles.distanceBadgeTextOutOfRange]}>
                      {isOutOfRange 
                        ? `🚫 Cách quán ${distanceKm} km (Vượt quá bán kính phục vụ ${maxRadius}km)` 
                        : `📍 Cách quán ${distanceKm} km • Tiền ship: ${shippingFee.toLocaleString('vi-VN')} đ (${distanceKm <= 1.0 ? 'Mặc định 5k dưới 1km' : '+500đ/100m'})`}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.autoDefaultBadge}>
                    <Text style={styles.autoDefaultBadgeText}>✓ Đã tự động chọn địa chỉ mặc định, không cần nhập lại</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.noAddressBox}
                onPress={() => navigation.navigate('Address')}
                activeOpacity={0.8}
              >
                <Text style={styles.noAddressText}>⚠️ Chưa chọn địa chỉ giao hàng</Text>
                <Text style={styles.noAddressSub}>Nhấn vào đây để chọn hoặc bật GPS lấy vị trí tức thì ➔</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.label, { marginTop: 14 }]}>Ghi chú cho shipper / nhà bếp (Tùy chọn)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: Giao lên lầu 2, gọi trước khi đến 5 phút..."
              placeholderTextColor="#999"
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* 5. SECTION TÓM TẮT ĐƠN HÀNG */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🛍️ Chi tiết đơn hàng ({cartData?.items?.length || 0} món)</Text>
            {cartData?.items?.map((item, index) => (
              <View key={index} style={styles.orderItemRow}>
                <Text style={styles.orderItemName} numberOfLines={1}>
                  {item.so_luong}x {item.ten_mon}
                </Text>
                <Text style={styles.orderItemPrice}>{item.gia_tam_tinh.toLocaleString('vi-VN')} đ</Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Tiền hàng tạm tính:</Text>
              <Text style={styles.priceValue}>{rawSubtotal.toLocaleString('vi-VN')} đ</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>
                Phí giao hàng {distanceKm !== null ? `(${distanceKm} km)` : ''}:
              </Text>
              <Text style={styles.priceValue}>{shippingFee.toLocaleString('vi-VN')} đ</Text>
            </View>

            {appliedVoucher && (
              <View style={styles.priceRow}>
                <Text style={styles.discountLabel}>
                  {isFreeshipVoucher ? '🚚 Giảm phí vận chuyển' : '🍔 Giảm giá món ăn'} ({appliedVoucher.ma_code}):
                </Text>
                <Text style={styles.discountValue}>
                  -{actualDiscount.toLocaleString('vi-VN')} đ
                  {isFreeshipVoucher && parseFloat(appliedVoucher.gia_tri_giam) > shippingFee ? ` (Tối đa phí ship)` : ''}
                </Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>TỔNG THANH TOÁN:</Text>
              <Text style={styles.totalValue}>{grandTotal.toLocaleString('vi-VN')} đ</Text>
            </View>
          </View>
        </ScrollView>

        {/* CẢNH BÁO NGOÀI PHẠM VI 3KM NẾU CÓ */}
        {isOutOfRange && (
          <View style={styles.outOfRangeBanner}>
            <Text style={styles.outOfRangeBannerText}>
              ⚠️ Địa chỉ cách quán {distanceKm}km (vượt quá 3km). Quán chỉ nhận giao hàng trong bán kính 3km!
            </Text>
          </View>
        )}

        {/* BOTTOM BAR: Nút Xác nhận đặt hàng / Hoàn tất thanh toán */}
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={[styles.submitBtn, (submitting || generatingQr || isOutOfRange) && styles.btnDisabled]} 
            onPress={handlePlaceOrder}
            disabled={submitting || generatingQr || isOutOfRange}
          >
            {submitting || generatingQr ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isOutOfRange
                  ? `Ngoài bán kính giao hàng (${distanceKm} km) 🚫`
                  : `Xác nhận Đặt hàng (${grandTotal.toLocaleString('vi-VN')} đ) 🚀`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginBottom: 14,
  },
  voucherInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  voucherInput: {
    flex: 1,
    backgroundColor: '#F7F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1D1E',
    fontWeight: 'bold',
    marginRight: 8,
  },
  applyBtn: {
    backgroundColor: '#FF5722',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  appliedSuccessCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  appliedSuccessTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  appliedSuccessDetail: {
    fontSize: 12,
    color: '#388E3C',
    marginTop: 2,
  },
  highlightText: {
    fontWeight: 'bold',
    color: '#D84315',
  },
  suggestVouchersContainer: {
    marginTop: 8,
  },
  suggestTitle: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 8,
  },
  voucherScrollView: {
    flexDirection: 'row',
  },
  voucherChip: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  voucherChipCode: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF5722',
  },
  voucherChipDesc: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  voucherTypeBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  voucherTypeFs: {
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
  },
  voucherTypeFood: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6C757D',
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#F7F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 12,
    fontSize: 14,
    color: '#1A1D1E',
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  changeAddressBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#E0F2F1',
  },
  changeAddressBtnText: {
    color: '#00A896',
    fontSize: 13,
    fontWeight: 'bold',
  },
  defaultAddressCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  addressCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  addressLabelEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  addressLabelText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#15803D',
  },
  defaultTag: {
    backgroundColor: '#00A896',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  defaultTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  addressInfoRow: {
    marginBottom: 6,
  },
  recipientNamePhone: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  addressDetailText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 8,
  },
  autoDefaultBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignSelf: 'flex-start',
  },
  autoDefaultBadgeText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },
  distanceBadge: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  distanceBadgeOutOfRange: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  distanceBadgeText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '700',
  },
  distanceBadgeTextOutOfRange: {
    color: '#DC2626',
  },
  outOfRangeBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  outOfRangeBannerText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  noAddressBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  noAddressText: {
    color: '#B45309',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noAddressSub: {
    color: '#D97706',
    fontSize: 12,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#F7F9FA',
  },
  paymentCardSelected: {
    borderColor: '#FF5722',
    backgroundColor: '#FFF3E0',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5722',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  paymentLabelSelected: {
    color: '#FF5722',
  },
  paymentDesc: {
    fontSize: 12,
    color: '#78909C',
    marginTop: 2,
  },
  vietQrPreviewCard: {
    backgroundColor: '#E0F2F1',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#80CBC4',
  },
  vietQrTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#00A896',
    marginBottom: 4,
  },
  vietQrDesc: {
    fontSize: 12,
    color: '#004D40',
    lineHeight: 17,
    marginBottom: 10,
  },
  bankDetailBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
  },
  bankDetailRow: {
    fontSize: 12,
    color: '#444',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  totalPriceText: {
    fontWeight: 'bold',
    color: '#FF5722',
    fontSize: 14,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderItemName: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 13,
    color: '#6C757D',
  },
  priceValue: {
    fontSize: 13,
    color: '#1A1D1E',
    fontWeight: '600',
  },
  discountLabel: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  discountValue: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5722',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 6,
  },
  submitBtn: {
    backgroundColor: '#FF5722',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: '#FFAB91',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
