import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  RefreshControl,
  SafeAreaView,
  Linking 
} from 'react-native';
import { fetchOrderDetail, updateOrderStatus, fetchStoreLandmark } from '../services/api';

export default function OrderTrackingScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [storeHotline, setStoreHotline] = useState('0901234567');

  useEffect(() => {
    loadOrderDetails();
    loadStoreHotline();

    // Tự động kiểm tra trạng thái đơn mỗi 4 giây để cập nhật ngay khi shipper giao tới hoàn thành
    const timer = setInterval(() => {
      fetchOrderDetail(orderId)
        .then(res => {
          if (res && res.success && res.data) {
            setOrder(res.data);
            if (res.data.so_dien_thoai_quan) {
              setStoreHotline(res.data.so_dien_thoai_quan);
            }
          }
        })
        .catch(() => {});
    }, 4000);

    return () => clearInterval(timer);
  }, [orderId]);

  const loadStoreHotline = async () => {
    try {
      const res = await fetchStoreLandmark();
      if (res && res.success && res.data?.so_dien_thoai_quan) {
        setStoreHotline(res.data.so_dien_thoai_quan);
      }
    } catch (e) {}
  };

  const handleCallStore = (phone) => {
    const targetPhone = phone || storeHotline || '0901234567';
    Linking.openURL(`tel:${targetPhone}`).catch(() => {
      Alert.alert('Không thể thực hiện cuộc gọi', `Vui lòng bấm gọi số: ${targetPhone}`);
    });
  };

  const loadOrderDetails = async (isManual = false) => {
    if (!isManual) setLoading(true);
    try {
      const response = await fetchOrderDetail(orderId);
      if (response.success) {
        setOrder(response.data);
      }
    } catch (error) {
      if (isManual) {
        Alert.alert('Lỗi', error.message || 'Không thể lấy thông tin tiến trình đơn hàng!');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Hủy đơn hàng',
      'Bạn có chắc muốn hủy đơn hàng này?',
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Xác nhận hủy',
          style: 'destructive',
          onPress: async () => {
            setCanceling(true);
            try {
              const response = await updateOrderStatus(orderId, 'da_huy', 'Khách hàng đổi ý hủy đơn');
              if (response.success) {
                Alert.alert('Thành công', 'Đã hủy đơn hàng thành công!');
                loadOrderDetails();
              }
            } catch (error) {
              Alert.alert('Thất bại', error.message || 'Không thể hủy đơn hàng!');
            } finally {
              setCanceling(false);
            }
          }
        }
      ]
    );
  };

  const steps = [
    { key: 'cho_xac_nhan', title: 'Chờ nhận', desc: 'Đơn hàng đang chờ cửa hàng tiếp nhận', icon: '⏳' },
    { key: 'dang_che_bien', title: 'Đang làm', desc: 'Bếp nhận nấu, hiện đang làm món', icon: '👨‍🍳' },
    { key: 'dang_giao', title: 'Đang giao', desc: 'Shipper nhận đơn, hiện đang giao hàng', icon: '🛵' },
    { key: 'da_giao', title: 'Hoàn thành', desc: 'Shipper đã giao tới. Đơn hàng hoàn tất!', icon: '🎉' },
  ];

  const getStepStatusIndex = (currentStatus) => {
    switch (currentStatus) {
      case 'cho_xac_nhan': return 0;
      case 'dang_che_bien': 
      case 'san_sang_giao': return 1;
      case 'dang_giao': return 2;
      case 'da_giao': return 3;
      default: return -1;
    }
  };

  // Các thông điệp tiến trình vui vẻ
  const getStatusMascotMessage = (currentStatus) => {
    switch (currentStatus) {
      case 'cho_xac_nhan':
        return {
          emoji: '⏳📱',
          title: 'Đơn hàng: Chờ nhận',
          desc: 'Đơn hàng đã được tiếp nhận và đang chờ nhà bếp nấu món!'
        };
      case 'dang_che_bien':
      case 'san_sang_giao':
        return {
          emoji: '👨‍🍳🔥',
          title: 'Bếp nhận nấu: Hiện đang làm',
          desc: 'Bếp đã nhận đơn và hiện đang làm các món ăn nóng giòn cho bạn!'
        };
      case 'dang_giao':
        return {
          emoji: '🛵💨',
          title: 'Shipper nhận: Hiện đang giao',
          desc: 'Tài xế đã nhận đơn từ quán và đang trên đường giao tới bạn!'
        };
      case 'da_giao':
        return {
          emoji: '🎉🍔',
          title: 'Shipper giao tới: Hoàn thành',
          desc: 'Đơn hàng đã được giao tận tay thành công. Chúc bạn ngon miệng!'
        };
      case 'da_huy':
        return {
          emoji: '❌',
          title: 'Đơn hàng đã bị hủy',
          desc: 'Đơn hàng đã dừng xử lý. Hãy tạo đơn mới bất cứ lúc nào bạn muốn!'
        };
      default:
        return { emoji: '📦', title: 'Đang xử lý', desc: 'Đang cập nhật trạng thái đơn...' };
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00A896" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Không tìm thấy dữ liệu đơn hàng!</Text>
      </View>
    );
  }

  const activeIndex = getStepStatusIndex(order.trang_thai_don_hang);
  const isCanceled = order.trang_thai_don_hang === 'da_huy';
  const mascot = getStatusMascotMessage(order.trang_thai_don_hang);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrderDetails(); }} colors={['#00A896']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Mã Đơn Hàng */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.orderIdText}>Đơn hàng #{order.ma_don_hang}</Text>
            <TouchableOpacity 
              style={styles.refreshBtn} 
              onPress={() => loadOrderDetails(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.refreshBtnText}>🔄 Làm mới</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.orderTimeText}>
            Thời gian đặt: {new Date(order.ngay_dat).toLocaleString('vi-VN')}
          </Text>
        </View>

        {/* Top Stepper Indicator (4 Dấu Chấm & Nhãn Tiến Trình) */}
        <View style={styles.topStepperCard}>
          <View style={styles.dotsRow}>
            {steps.map((step, idx) => {
              const isCompleted = idx <= activeIndex;
              const isCurrent = idx === activeIndex;
              return (
                <React.Fragment key={step.key}>
                  <View style={[
                    styles.stepperDot,
                    isCompleted && styles.stepperDotActive,
                    isCurrent && styles.stepperDotCurrent
                  ]} />
                  {idx < steps.length - 1 && (
                    <View style={[styles.stepperLine, idx < activeIndex && styles.stepperLineActive]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
          <View style={styles.stepsLabelsRow}>
            {steps.map((step, idx) => (
              <Text 
                key={step.key} 
                style={[
                  styles.stepLabelText,
                  idx <= activeIndex && styles.stepLabelTextActive,
                  idx === activeIndex && styles.stepLabelTextCurrent
                ]}
              >
                {step.title}
              </Text>
            ))}
          </View>
        </View>

        {/* Mascot / Graphic Card theo chuẩn Mockup */}
        <View style={styles.mascotCard}>
          <Text style={styles.mascotEmoji}>{mascot.emoji}</Text>
          <Text style={styles.mascotTitle}>{mascot.title}</Text>
          <Text style={styles.mascotDesc}>{mascot.desc}</Text>
        </View>

        {/* Thông báo Hotline quán khi Bếp đang nấu món (Khách muốn hủy hoặc thay đổi thì gọi số này) */}
        {['dang_che_bien', 'san_sang_giao'].includes(order.trang_thai_don_hang) && (
          <View style={styles.kitchenCookingNoticeCard}>
            <View style={styles.kitchenCookingHeader}>
              <View style={styles.kitchenCookingIconWrap}>
                <Text style={styles.kitchenCookingIcon}>👨‍🍳</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.kitchenCookingTitle}>Bếp đang chuẩn bị món ăn!</Text>
                <Text style={styles.kitchenCookingSub}>Đơn hàng đã tiếp nhận vào bếp và đang nấu nóng hổi</Text>
              </View>
            </View>

            <View style={styles.kitchenCookingDivider} />

            <Text style={styles.kitchenCookingDesc}>
              💬 Nếu bạn muốn <Text style={{ fontWeight: '700', color: '#DC2626' }}>hủy đơn</Text> hoặc <Text style={{ fontWeight: '700', color: '#D97706' }}>thay đổi món ăn</Text>, vui lòng liên hệ ngay với quán qua số điện thoại:
            </Text>

            <TouchableOpacity 
              style={styles.hotlineCallBtn}
              activeOpacity={0.85}
              onPress={() => handleCallStore(order.so_dien_thoai_quan || storeHotline)}
            >
              <View style={styles.hotlineCallLeft}>
                <View style={styles.hotlinePhoneCircle}>
                  <Text style={styles.hotlinePhoneIcon}>📞</Text>
                </View>
                <View>
                  <Text style={styles.hotlineStoreLabel}>Hotline Nhà Hàng FastFood</Text>
                  <Text style={styles.hotlinePhoneNumber}>{order.so_dien_thoai_quan || storeHotline || '0901234567'}</Text>
                </View>
              </View>
              <View style={styles.hotlineCallRight}>
                <Text style={styles.hotlineCallText}>GỌI NGAY ⚡</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Thông tin giao nhận */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🚚 Thông tin nhận hàng</Text>
          <Text style={styles.infoLabel}>Khách hàng: <Text style={styles.infoValue}>{order.ten_khach_hang}</Text></Text>
          <Text style={styles.infoLabel}>Số điện thoại: <Text style={styles.infoValue}>{order.so_dien_thoai_nhan}</Text></Text>
          <Text style={styles.infoLabel}>Địa chỉ giao: <Text style={styles.infoValue}>{order.dia_chi_giao_hang}</Text></Text>
          {order.ghi_chu ? (
            <Text style={styles.infoLabel}>Ghi chú: <Text style={styles.infoValue}>{order.ghi_chu}</Text></Text>
          ) : null}

          {order.ten_shipper && (
            <View style={styles.shipperCard}>
              <Text style={styles.shipperTitle}>🛵 Shipper phụ trách:</Text>
              <Text style={styles.shipperName}>{order.ten_shipper} ({order.sdt_shipper})</Text>
              {order.bien_so_shipper && <Text style={styles.shipperPlate}>Biển số: {order.bien_so_shipper}</Text>}
            </View>
          )}
        </View>

        {/* Chi tiết các món đã đặt */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🍔 Món ăn trong đơn ({order.items?.length || 0})</Text>
          {order.items?.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={styles.itemName}>{item.so_luong}x {item.ten_mon_an}</Text>
                {item.tuy_chon_da_chon && item.tuy_chon_da_chon.length > 0 && (
                  <Text style={styles.itemOptionText}>
                    {item.tuy_chon_da_chon.map(opt => opt.ten).join(', ')}
                  </Text>
                )}
              </View>
              <Text style={styles.itemPrice}>{item.thanh_tien.toLocaleString('vi-VN')} đ</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tiền hàng:</Text>
            <Text style={styles.priceValue}>{order.tong_tien_hang.toLocaleString('vi-VN')} đ</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Phí giao hàng:</Text>
            <Text style={styles.priceValue}>{order.phi_giao_hang.toLocaleString('vi-VN')} đ</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>TỔNG THANH TOÁN:</Text>
            <Text style={styles.totalValue}>{order.tong_thanh_toan.toLocaleString('vi-VN')} đ</Text>
          </View>
        </View>

        {/* Nút hủy đơn nếu đơn đang ở trạng thái 'cho_xac_nhan' */}
        {order.trang_thai_don_hang === 'cho_xac_nhan' && (
          <TouchableOpacity 
            style={[styles.cancelBtn, canceling && styles.btnDisabled]}
            onPress={handleCancelOrder}
            disabled={canceling}
          >
            {canceling ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.cancelBtnText}>Hủy Đơn Hàng Này 🛑</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF5722',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00A896',
  },
  refreshBtn: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  refreshBtnText: {
    fontSize: 12,
    color: '#00A896',
    fontWeight: 'bold',
  },
  orderTimeText: {
    fontSize: 12,
    color: '#78909C',
    marginTop: 4,
  },
  topStepperCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 12,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  stepperDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ECEFF1',
  },
  stepperDotActive: {
    backgroundColor: '#FF5722',
  },
  stepperDotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF5722',
    borderWidth: 3,
    borderColor: '#FFE0B2',
  },
  stepperLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#ECEFF1',
    marginHorizontal: 4,
  },
  stepperLineActive: {
    backgroundColor: '#FF5722',
  },
  mascotCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },
  mascotEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  mascotTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  mascotDesc: {
    fontSize: 13,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6C757D',
    marginBottom: 6,
  },
  infoValue: {
    color: '#1A1D1E',
    fontWeight: 'bold',
  },
  shipperCard: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  shipperTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  shipperName: {
    fontSize: 14,
    color: '#1B5E20',
    fontWeight: 'bold',
    marginTop: 2,
  },
  shipperPlate: {
    fontSize: 12,
    color: '#388E3C',
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemMain: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1D1E',
  },
  itemOptionText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  itemPrice: {
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
    marginBottom: 4,
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
  cancelBtn: {
    backgroundColor: '#FF5722',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 30,
  },
  btnDisabled: {
    backgroundColor: '#FFAB91',
  },
  cancelBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepsLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  stepLabelText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textAlign: 'center',
    width: '25%',
  },
  stepLabelTextActive: {
    color: '#475569',
    fontWeight: '700',
  },
  stepLabelTextCurrent: {
    color: '#FF5722',
    fontWeight: '900',
  },
  stepActionBtn: {
    backgroundColor: '#FF5722',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  stepActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  kitchenCookingNoticeCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  kitchenCookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kitchenCookingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kitchenCookingIcon: {
    fontSize: 24,
  },
  kitchenCookingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9A3412',
  },
  kitchenCookingSub: {
    fontSize: 12,
    color: '#C2410C',
    marginTop: 2,
  },
  kitchenCookingDivider: {
    height: 1,
    backgroundColor: '#FED7AA',
    marginVertical: 12,
  },
  kitchenCookingDesc: {
    fontSize: 13,
    color: '#431407',
    lineHeight: 19,
    marginBottom: 12,
  },
  hotlineCallBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  hotlineCallLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hotlinePhoneCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  hotlinePhoneIcon: {
    fontSize: 16,
  },
  hotlineStoreLabel: {
    fontSize: 10,
    color: '#FED7AA',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  hotlinePhoneNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  hotlineCallRight: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  hotlineCallText: {
    color: '#EA580C',
    fontSize: 12,
    fontWeight: '800',
  },
});
