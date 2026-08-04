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
  SafeAreaView 
} from 'react-native';
import { fetchOrderDetail, updateOrderStatus } from '../services/api';

export default function OrderTrackingScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    setLoading(true);
    try {
      const response = await fetchOrderDetail(orderId);
      if (response.success) {
        setOrder(response.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể lấy thông tin tiến trình đơn hàng!');
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
    { key: 'cho_xac_nhan', title: 'Chờ xác nhận', desc: 'Đơn hàng đang chờ cửa hàng duyệt', icon: '⏳' },
    { key: 'dang_che_bien', title: 'Đang chế biến', desc: 'Nhà bếp đang chế biến món ăn', icon: '👨‍🍳' },
    { key: 'dang_giao', title: 'Đang giao hàng', desc: 'Shipper đang di chuyển giao tới bạn', icon: '🛵' },
    { key: 'da_giao', title: 'Đã giao thành công', desc: 'Đơn hàng hoàn tất. Chúc ngon miệng!', icon: '🎉' },
  ];

  const getStepStatusIndex = (currentStatus) => {
    switch (currentStatus) {
      case 'cho_xac_nhan': return 0;
      case 'dang_che_bien': return 1;
      case 'dang_giao': return 2;
      case 'da_giao': return 3;
      default: return -1;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF8F00" />
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrderDetails(); }} colors={['#FF8F00']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Mã Đơn Hàng */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.orderIdText}>Đơn hàng #{order.ma_don_hang}</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadOrderDetails}>
              <Text style={styles.refreshBtnText}>🔄 Cập nhật</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.orderTimeText}>
            Thời gian đặt: {new Date(order.ngay_dat).toLocaleString('vi-VN')}
          </Text>
        </View>

        {/* 1. Màn hình Timeline / Stepper Tiến Trình */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📍 Tiến trình đơn hàng</Text>

          {isCanceled ? (
            <View style={styles.canceledCard}>
              <Text style={styles.canceledIcon}>❌</Text>
              <Text style={styles.canceledTitle}>Đơn hàng đã bị hủy</Text>
              <Text style={styles.canceledDesc}>Rất tiếc, đơn hàng này đã dừng xử lý.</Text>
            </View>
          ) : (
            <View style={styles.stepperContainer}>
              {steps.map((step, idx) => {
                const isCompleted = idx <= activeIndex;
                const isCurrent = idx === activeIndex;

                return (
                  <View key={step.key} style={styles.stepRow}>
                    <View style={styles.stepLeftColumn}>
                      <View style={[
                        styles.stepDot, 
                        isCompleted && styles.stepDotCompleted,
                        isCurrent && styles.stepDotCurrent
                      ]}>
                        <Text style={styles.stepIconText}>{step.icon}</Text>
                      </View>
                      {idx < steps.length - 1 && (
                        <View style={[styles.stepLine, isCompleted && idx < activeIndex && styles.stepLineCompleted]} />
                      )}
                    </View>

                    <View style={styles.stepContent}>
                      <Text style={[styles.stepTitle, isCompleted && styles.stepTitleCompleted, isCurrent && styles.stepTitleCurrent]}>
                        {step.title}
                      </Text>
                      <Text style={styles.stepDesc}>{step.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 2. Thông tin giao nhận */}
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

        {/* 3. Chi tiết danh sách món ăn */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🍔 Chi tiết các món đặt ({order.items?.length || 0})</Text>
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

        {/* 4. Lịch sử nhật ký làm việc (Timeline logs) */}
        {order.lich_su_trang_thai && order.lich_su_trang_thai.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📝 Nhật ký làm việc</Text>
            {order.lich_su_trang_thai.map((log, idx) => (
              <View key={idx} style={styles.logRow}>
                <Text style={styles.logTime}>{new Date(log.ngay_tao).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
                <View style={styles.logBody}>
                  <Text style={styles.logActor}>{log.nguoi_thuc_hien}:</Text>
                  <Text style={styles.logNote}>{log.ghi_chu}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

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
    backgroundColor: '#FAF3E0',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#D84315',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    color: '#D84315',
  },
  refreshBtn: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  refreshBtnText: {
    fontSize: 12,
    color: '#FF8F00',
    fontWeight: 'bold',
  },
  orderTimeText: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 14,
  },
  stepperContainer: {
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  stepLeftColumn: {
    alignItems: 'center',
    marginRight: 14,
    width: 36,
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#DDD',
  },
  stepDotCompleted: {
    backgroundColor: '#FFE0B2',
    borderColor: '#FF8F00',
  },
  stepDotCurrent: {
    backgroundColor: '#FF8F00',
    borderColor: '#D84315',
  },
  stepIconText: {
    fontSize: 16,
  },
  stepLine: {
    width: 3,
    height: 30,
    backgroundColor: '#E0E0E0',
    marginVertical: 2,
  },
  stepLineCompleted: {
    backgroundColor: '#FF8F00',
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
  },
  stepTitleCompleted: {
    color: '#333',
  },
  stepTitleCurrent: {
    fontSize: 15,
    color: '#D84315',
  },
  stepDesc: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  canceledCard: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
  },
  canceledIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  canceledTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C62828',
  },
  canceledDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  infoValue: {
    color: '#333',
    fontWeight: 'bold',
  },
  shipperCard: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
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
    color: '#333',
  },
  itemOptionText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#666',
  },
  priceValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D84315',
  },
  logRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  logTime: {
    fontSize: 12,
    color: '#999',
    width: 60,
  },
  logBody: {
    flex: 1,
  },
  logActor: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
  },
  logNote: {
    fontSize: 12,
    color: '#333',
  },
  cancelBtn: {
    backgroundColor: '#D84315',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
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
});
