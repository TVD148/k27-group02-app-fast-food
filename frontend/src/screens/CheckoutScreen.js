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
  KeyboardAvoidingView, 
  Platform,
  SafeAreaView 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createOrder } from '../services/api';

export default function CheckoutScreen({ route, navigation }) {
  const { cartData, grandTotal } = route.params || {};

  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('tien_mat');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDefaultUserInfo();
  }, []);

  const loadDefaultUserInfo = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user_info');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.dia_chi) setAddress(user.dia_chi);
        if (user.so_dien_thoai) setPhone(user.so_dien_thoai);
      }
    } catch (e) {
      console.log('Không thể tải thông tin người dùng mặc định');
    }
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

    if (!address.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ giao hàng!');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại nhận hàng!');
      return;
    }

    setSubmitting(true);
    try {
      const response = await createOrder(address, phone, note, paymentMethod);
      if (response.success) {
        const newOrderId = response.data.ma_don_hang;
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
    { key: 'momo', label: '🪪 Ví điện tử MoMo', desc: 'Thanh toán qua ví MoMo tiện lợi' },
    { key: 'vnpay', label: '💳 Ví VNPAY / Thẻ Ngân Hàng', desc: 'Thanh toán qua cổng VNPAY an toàn' },
    { key: 'chuyen_khoan', label: '🏦 Chuyển khoản Ngân hàng', desc: 'Chuyển khoản theo mã QR sau khi đặt' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Thông tin giao hàng */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📍 Thông tin giao hàng</Text>

            <Text style={styles.label}>Địa chỉ nhận hàng *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập địa chỉ nhà, tên đường, quận/huyện..."
              placeholderTextColor="#999"
              value={address}
              onChangeText={setAddress}
              multiline
            />

            <Text style={styles.label}>Số điện thoại nhận hàng *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập số điện thoại người nhận..."
              placeholderTextColor="#999"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Ghi chú cho nhà bếp / Shipper</Text>
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: Cho nhiều tương cà, giao giờ hành chính..."
              placeholderTextColor="#999"
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* 2. Phương thức thanh toán */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>💳 Phương thức thanh toán</Text>

            {paymentOptions.map((opt) => {
              const isSelected = paymentMethod === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.paymentCard, isSelected && styles.paymentCardSelected]}
                  onPress={() => setPaymentMethod(opt.key)}
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

          {/* 3. Tóm tắt đơn hàng */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🛍️ Món ăn trong đơn ({cartData?.items?.length || 0} món)</Text>
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
              <Text style={styles.priceLabel}>Tiền hàng:</Text>
              <Text style={styles.priceValue}>{cartData?.tong_tien.toLocaleString('vi-VN')} đ</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Phí giao hàng:</Text>
              <Text style={styles.priceValue}>15.000 đ</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>TỔNG THÀNH TIỀN:</Text>
              <Text style={styles.totalValue}>{grandTotal?.toLocaleString('vi-VN')} đ</Text>
            </View>
          </View>
        </ScrollView>

        {/* Nút đặt hàng cạnh dưới */}
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={[styles.submitBtn, submitting && styles.btnDisabled]} 
            onPress={handlePlaceOrder}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Xác Nhận Đặt Hàng ({grandTotal?.toLocaleString('vi-VN')} đ)</Text>
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
