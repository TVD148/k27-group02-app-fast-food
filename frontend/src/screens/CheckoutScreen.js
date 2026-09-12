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
import { createOrder, applyVoucher, fetchVouchers, generateVietQR, confirmPayment } from '../services/api';

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

  const rawSubtotal = cartData?.tong_tien || (initialGrandTotal ? initialGrandTotal - 15000 : 0);
  const shippingFee = 15000;
  const discountAmount = appliedVoucher ? parseFloat(appliedVoucher.so_tien_giam) : 0;
  const grandTotal = Math.max(0, rawSubtotal + shippingFee - discountAmount);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDeliveryAddress();
    });
    loadDeliveryAddress();
    loadPublicVouchers();
    return unsubscribe;
  }, [navigation]);

  const loadDeliveryAddress = async () => {
    try {
      // 1. Kiểm tra địa chỉ mặc định đã chọn trong default_address
      const storedDefault = await AsyncStorage.getItem('default_address');
      if (storedDefault) {
        const parsed = JSON.parse(storedDefault);
        if (parsed.address && parsed.address.includes('Lê Duẩn')) {
          const sample = {
            id: '1',
            label: 'Nhà riêng',
            name: 'Trần Văn Đình',
            phone: '0378876126',
            address: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
            isDefault: true
          };
          setDefaultAddress(sample);
          setAddress(sample.address);
          setPhone(sample.phone);
          await AsyncStorage.setItem('default_address', JSON.stringify(sample));
          return;
        }
        setDefaultAddress(parsed);
        setAddress(parsed.address || '');
        setPhone(parsed.phone || '0378876126');
        return;
      }

      // 2. Lấy từ danh sách sổ địa chỉ saved_addresses
      const savedList = await AsyncStorage.getItem('saved_addresses');
      if (savedList) {
        const list = JSON.parse(savedList);
        if (Array.isArray(list) && list.length > 0) {
          const def = list.find(a => a.isDefault) || list[0];
          setDefaultAddress(def);
          setAddress(def.address || '');
          setPhone(def.phone || '0378876126');
          await AsyncStorage.setItem('default_address', JSON.stringify(def));
          return;
        }
      }

      // 3. Lấy từ thông tin người dùng đăng nhập user_info
      const storedUser = await AsyncStorage.getItem('user_info');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const fallback = {
          id: 'user_default',
          label: 'Nhà riêng',
          icon: '🏠',
          name: user.ho_ten || 'Trần Văn Đình',
          phone: user.so_dien_thoai || '0378876126',
          address: user.dia_chi || '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
          isDefault: true
        };
        setDefaultAddress(fallback);
        setAddress(fallback.address);
        setPhone(fallback.phone);
        await AsyncStorage.setItem('default_address', JSON.stringify(fallback));
        return;
      }

      // 4. Mặc định dự phòng chuẩn khu vực
      const sample = {
        id: '1',
        label: 'Nhà riêng',
        icon: '🏠',
        name: 'Trần Văn Đình',
        phone: '0378876126',
        address: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
        isDefault: true
      };
      setDefaultAddress(sample);
      setAddress(sample.address);
      setPhone(sample.phone);
      await AsyncStorage.setItem('default_address', JSON.stringify(sample));
    } catch (e) {
      console.log('Không thể tải địa chỉ giao hàng:', e);
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
      const response = await applyVoucher(targetCode, rawSubtotal);
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

    setSubmitting(true);
    try {
      // Gọi API tạo đơn hàng (sử dụng địa chỉ mặc định đã chọn)
      const response = await createOrder(
        finalAddress, 
        finalPhone, 
        note, 
        paymentMethod, 
        appliedVoucher ? appliedVoucher.ma_code : null
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
                `Đơn hàng #${newOrderId} đã được khởi tạo. Hãy quét mã VietQR để hoàn tất chuyển khoản!`,
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
          `Đơn hàng #${newOrderId} đã được gửi đến nhà bếp chế biến.`,
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
    { key: 'vietqr', label: '📱 Chuyển khoản Ngân hàng (VietQR)', desc: 'Sinh mã QR động chuyển khoản chính xác tới MB Bank' },
    { key: 'momo', label: '🪪 Ví điện tử MoMo', desc: 'Thanh toán qua ví MoMo tiện lợi' },
    { key: 'vnpay', label: '💳 Cổng thanh toán VNPAY', desc: 'Thanh toán thẻ ATM / QR VNPAY an toàn' },
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
                  {availableVouchers.map((v) => (
                    <TouchableOpacity 
                      key={v.ma_voucher}
                      style={styles.voucherChip}
                      onPress={() => {
                        setVoucherCode(v.ma_code);
                        handleApplyVoucher(v.ma_code);
                      }}
                    >
                      <Text style={styles.voucherChipCode}>{v.ma_code}</Text>
                      <Text style={styles.voucherChipDesc}>{v.ten_voucher}</Text>
                    </TouchableOpacity>
                  ))}
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

          {/* 3. SECTION VIETQR CODE ĐỘNG (Hiển thị khi chọn VietQR / Chuyển khoản) */}
          {(paymentMethod === 'vietqr' || paymentMethod === 'chuyen_khoan') && (
            <View style={styles.vietQrPreviewCard}>
              <Text style={styles.vietQrTitle}>📱 Thanh toán qua VietQR tự động</Text>
              <Text style={styles.vietQrDesc}>
                Hệ thống sẽ tự động sinh mã VietQR chuyển khoản chính xác tới ngân hàng MB Bank ngay khi bấm Xác Nhận Đặt Hàng.
              </Text>
              
              <View style={styles.bankDetailBox}>
                <Text style={styles.bankDetailRow}>• Ngân hàng: <Text style={styles.boldText}>MB Bank (Ngân hàng TMCP Quân Đội)</Text></Text>
                <Text style={styles.bankDetailRow}>• Số tài khoản: <Text style={styles.boldText}>0987654321</Text></Text>
                <Text style={styles.bankDetailRow}>• Chủ tài khoản: <Text style={styles.boldText}>CONG TY APP FAST FOOD</Text></Text>
                <Text style={styles.bankDetailRow}>• Số tiền thanh toán: <Text style={styles.totalPriceText}>{grandTotal.toLocaleString('vi-VN')} đ</Text></Text>
              </View>
            </View>
          )}

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
                    👤 {defaultAddress.name || 'Người nhận'} • 📞 {defaultAddress.phone || phone || '0378876126'}
                  </Text>
                </View>

                <Text style={styles.addressDetailText}>
                  {defaultAddress.address || address}
                </Text>

                <View style={styles.autoDefaultBadge}>
                  <Text style={styles.autoDefaultBadgeText}>✓ Đã tự động chọn địa chỉ mặc định, không cần nhập lại</Text>
                </View>
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
              <Text style={styles.priceLabel}>Phí giao hàng:</Text>
              <Text style={styles.priceValue}>{shippingFee.toLocaleString('vi-VN')} đ</Text>
            </View>

            {appliedVoucher && (
              <View style={styles.priceRow}>
                <Text style={styles.discountLabel}>Giảm giá Voucher ({appliedVoucher.ma_code}):</Text>
                <Text style={styles.discountValue}>-{discountAmount.toLocaleString('vi-VN')} đ</Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>TỔNG THANH TOÁN:</Text>
              <Text style={styles.totalValue}>{grandTotal.toLocaleString('vi-VN')} đ</Text>
            </View>
          </View>
        </ScrollView>

        {/* BOTTOM BAR: Nút Xác nhận đặt hàng / Hoàn tất thanh toán */}
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={[styles.submitBtn, (submitting || generatingQr) && styles.btnDisabled]} 
            onPress={handlePlaceOrder}
            disabled={submitting || generatingQr}
          >
            {submitting || generatingQr ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                Hoàn tất Thanh toán ({grandTotal.toLocaleString('vi-VN')} đ) 🚀
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
