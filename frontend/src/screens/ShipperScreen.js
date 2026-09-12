import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchOrders, acceptOrderDelivery, updateOrderStatus, fetchShipperStats } from '../services/api';

export default function ShipperScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'delivering' | 'stats'
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total_delivered: 0, total_cod: 0, total_delivering: 0, total_available: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOrderId, setActingOrderId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadShipperData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadShipperData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadShipperData = async () => {
    setLoading(true);
    try {
      const storedUser = await AsyncStorage.getItem('user_info');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }

      const [orderRes, statsRes] = await Promise.all([
        fetchOrders(),
        fetchShipperStats()
      ]);

      if (orderRes.success) {
        setOrders(orderRes.data || []);
      }
      if (statsRes.success) {
        setStats(statsRes.data || {});
      }
    } catch (error) {
      console.log('Lỗi tải dữ liệu shipper:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadShipperData();
  };

  // Shipper nhận đơn giao
  const handleAcceptOrder = async (orderId) => {
    Alert.alert(
      'Nhận giao đơn hàng 🛵',
      `Bạn có chắc chắn muốn nhận giao đơn hàng #${orderId} này tới khách hàng?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Nhận đơn ngay',
          onPress: async () => {
            setActingOrderId(orderId);
            try {
              const res = await acceptOrderDelivery(orderId);
              if (res.success) {
                Alert.alert('Nhận đơn thành công! 🚀', 'Hãy tới quán FastFood nhận đồ ăn và bắt đầu giao cho khách.');
                setActiveTab('delivering');
                loadShipperData();
              }
            } catch (err) {
              Alert.alert('Không thể nhận đơn', err.message || 'Đơn hàng này có thể đã được tài xế khác nhận!');
            } finally {
              setActingOrderId(null);
            }
          }
        }
      ]
    );
  };

  // Hoàn tất giao hàng & thu tiền COD
  const handleCompleteDelivery = async (orderId, codAmount) => {
    Alert.alert(
      'Xác nhận giao hàng thành công ✅',
      `Xác nhận đã giao đồ ăn cho khách và đã thu đủ số tiền COD: ${parseFloat(codAmount).toLocaleString('vi-VN')} đ?`,
      [
        { text: 'Chưa xong', style: 'cancel' },
        {
          text: 'Đã giao & Thu tiền',
          onPress: async () => {
            setActingOrderId(orderId);
            try {
              const res = await updateOrderStatus(orderId, 'da_giao', 'Shipper giao thành công và thu tiền COD');
              if (res.success) {
                Alert.alert('Tuyệt vời 🎉', 'Đơn hàng đã hoàn tất! Doanh thu đã được ghi nhận vào tài khoản của bạn.');
                loadShipperData();
              }
            } catch (err) {
              Alert.alert('Lỗi', err.message || 'Không thể cập nhật trạng thái giao hàng!');
            } finally {
              setActingOrderId(null);
            }
          }
        }
      ]
    );
  };

  // Gọi điện thoại cho khách
  const handleCallCustomer = (phone) => {
    if (!phone) {
      Alert.alert('Lỗi', 'Không có số điện thoại khách hàng!');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  // Lọc danh sách theo Tab
  const availableOrders = orders.filter(o => o.trang_thai_don_hang === 'san_sang_giao' && !o.ma_shipper);
  const myDeliveringOrders = orders.filter(o => o.trang_thai_don_hang === 'dang_giao' && o.ma_shipper === currentUser?.ma_nguoi_dung);
  const deliveredOrders = orders.filter(o => o.trang_thai_don_hang === 'da_giao' && o.ma_shipper === currentUser?.ma_nguoi_dung);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Shipper */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🛵 FastFood Shipper Driver</Text>
          <Text style={styles.headerSubtitle}>Tài xế: {currentUser?.ho_ten || 'Tài xế công nghệ'} (Sẵn sàng)</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.profileBtnText}>Hồ sơ 👤</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'available' && styles.tabBtnActive]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>
            📦 Chờ Lấy ({availableOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'delivering' && styles.tabBtnActive]}
          onPress={() => setActiveTab('delivering')}
        >
          <Text style={[styles.tabText, activeTab === 'delivering' && styles.tabTextActive]}>
            🛵 Đang Giao ({myDeliveringOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'stats' && styles.tabBtnActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
            📊 Thu Nhập COD
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#00897B" />
          <Text style={styles.loadingText}>Đang tải dữ liệu đơn giao...</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#00897B']} />}
        >
          {/* TAB 1: ĐƠN CÓ SẴN TẠI QUÁN CHỜ SHIPPER NHẬN */}
          {activeTab === 'available' && (
            <>
              {availableOrders.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>🛵</Text>
                  <Text style={styles.emptyTitle}>Hiện chưa có đơn mới</Text>
                  <Text style={styles.emptySubtitle}>Khi quán làm xong món, các đơn sẽ xuất hiện tại đây để bạn nhận giao.</Text>
                </View>
              ) : (
                availableOrders.map(order => (
                  <View key={order.ma_don_hang} style={styles.orderCard}>
                    <View style={styles.orderHeaderRow}>
                      <View>
                        <Text style={styles.orderIdText}>Đơn hàng #{order.ma_don_hang}</Text>
                        <Text style={styles.orderTimeText}>{new Date(order.ngay_dat).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      <View style={styles.badgeReady}>
                        <Text style={styles.badgeReadyText}>✓ Quán đã làm xong</Text>
                      </View>
                    </View>

                    <View style={styles.locationBox}>
                      <Text style={styles.locationLabel}>📍 Nơi nhận: <Text style={styles.boldText}>Cửa hàng Fast Food (504 Đại lộ Bình Dương)</Text></Text>
                      <Text style={styles.locationLabel}>🏠 Giao đến: <Text style={styles.boldText}>{order.dia_chi_giao_hang}</Text></Text>
                      <Text style={styles.customerLine}>👤 Khách: {order.ten_khach_hang || 'Khách'} • 📞 {order.so_dien_thoai_nhan}</Text>
                      {order.ghi_chu ? (
                        <Text style={styles.noteLine}>📝 Ghi chú: {order.ghi_chu}</Text>
                      ) : null}
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Tiền thu COD:</Text>
                      <Text style={styles.codPriceText}>{parseFloat(order.tong_thanh_toan).toLocaleString('vi-VN')} đ</Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.acceptBtn}
                      onPress={() => handleAcceptOrder(order.ma_don_hang)}
                      disabled={actingOrderId === order.ma_don_hang}
                    >
                      {actingOrderId === order.ma_don_hang ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.acceptBtnText}>🛵 Nhận Giao Đơn Này ➔</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}

          {/* TAB 2: ĐƠN ĐANG GIAO CỦA SHIPPER NÀY */}
          {activeTab === 'delivering' && (
            <>
              {myDeliveringOrders.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>📦</Text>
                  <Text style={styles.emptyTitle}>Bạn chưa có đơn đang giao</Text>
                  <Text style={styles.emptySubtitle}>Hãy chuyển sang tab "Chờ Lấy" để nhận đơn mới nhé!</Text>
                </View>
              ) : (
                myDeliveringOrders.map(order => (
                  <View key={order.ma_don_hang} style={[styles.orderCard, styles.deliveringBorder]}>
                    <View style={styles.orderHeaderRow}>
                      <View>
                        <Text style={styles.orderIdText}>Đang giao #{order.ma_don_hang}</Text>
                        <Text style={styles.orderTimeText}>Phương thức: Tiền mặt khi nhận (COD)</Text>
                      </View>
                      <View style={styles.badgeDelivering}>
                        <Text style={styles.badgeDeliveringText}>Đang trên đường giao</Text>
                      </View>
                    </View>

                    <View style={styles.locationBox}>
                      <Text style={styles.customerNameTitle}>Khách hàng: {order.ten_khach_hang || 'Khách hàng'}</Text>
                      <Text style={styles.deliveryAddressText}>📍 {order.dia_chi_giao_hang}</Text>
                      {order.ghi_chu ? (
                        <Text style={styles.noteLine}>📝 Ghi chú của khách: "{order.ghi_chu}"</Text>
                      ) : null}
                    </View>

                    {/* Quick Call Button */}
                    <TouchableOpacity 
                      style={styles.callCustomerBtn}
                      onPress={() => handleCallCustomer(order.so_dien_thoai_nhan)}
                    >
                      <Text style={styles.callCustomerText}>📞 Gọi cho khách: {order.so_dien_thoai_nhan}</Text>
                    </TouchableOpacity>

                    <View style={styles.codBox}>
                      <Text style={styles.codBoxLabel}>Số tiền cần thu COD:</Text>
                      <Text style={styles.codBoxAmount}>{parseFloat(order.tong_thanh_toan).toLocaleString('vi-VN')} đ</Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.completeBtn}
                      onPress={() => handleCompleteDelivery(order.ma_don_hang, order.tong_thanh_toan)}
                      disabled={actingOrderId === order.ma_don_hang}
                    >
                      {actingOrderId === order.ma_don_hang ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.completeBtnText}>✅ Đã Giao Hàng & Thu Đủ Tiền COD</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}

          {/* TAB 3: BÁO CÁO THU NHẬP & TIỀN COD */}
          {activeTab === 'stats' && (
            <View style={styles.statsContainer}>
              <View style={styles.statsCardPrimary}>
                <Text style={styles.statsCardTitle}>💵 Tổng Tiền COD Đã Thu</Text>
                <Text style={styles.statsBigValue}>{stats.total_cod?.toLocaleString('vi-VN')} đ</Text>
                <Text style={styles.statsSubText}>Số tiền cần nộp lại cho cửa hàng sau ca làm việc</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statsGridCard}>
                  <Text style={styles.statsGridNumber}>{stats.total_delivered || 0}</Text>
                  <Text style={styles.statsGridLabel}>Đơn hoàn thành</Text>
                </View>
                <View style={styles.statsGridCard}>
                  <Text style={[styles.statsGridNumber, { color: '#00897B' }]}>{stats.total_delivering || 0}</Text>
                  <Text style={styles.statsGridLabel}>Đơn đang giao</Text>
                </View>
              </View>

              {/* Lịch sử các đơn đã giao */}
              <Text style={styles.historySectionTitle}>Lịch sử các đơn gần đây:</Text>
              {deliveredOrders.length === 0 ? (
                <Text style={styles.noHistoryText}>Chưa có đơn nào hoàn tất trong ca này.</Text>
              ) : (
                deliveredOrders.map(d => (
                  <View key={d.ma_don_hang} style={styles.historyRow}>
                    <View>
                      <Text style={styles.historyOrderTitle}>Đơn #{d.ma_don_hang} • {d.ten_khach_hang || 'Khách'}</Text>
                      <Text style={styles.historyTime}>{new Date(d.ngay_dat).toLocaleDateString('vi-VN')}</Text>
                    </View>
                    <Text style={styles.historyAmount}>+{parseFloat(d.tong_thanh_toan).toLocaleString('vi-VN')} đ</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#00897B',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#B2DFDB',
    marginTop: 2,
  },
  profileBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  profileBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    elevation: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#00897B',
  },
  tabText: {
    fontSize: 13,
    color: '#78909C',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00897B',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 30,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#00796B',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 50,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#78909C',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  deliveringBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#00897B',
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  orderTimeText: {
    fontSize: 12,
    color: '#90A4AE',
    marginTop: 2,
  },
  badgeReady: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  badgeReadyText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  badgeDelivering: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#80CBC4',
  },
  badgeDeliveringText: {
    fontSize: 11,
    color: '#00796B',
    fontWeight: 'bold',
  },
  locationBox: {
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
  },
  locationLabel: {
    fontSize: 13,
    color: '#37474F',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  customerLine: {
    fontSize: 13,
    color: '#546E7A',
    marginTop: 2,
  },
  noteLine: {
    fontSize: 12,
    color: '#E65100',
    marginTop: 4,
    fontStyle: 'italic',
  },
  customerNameTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#263238',
  },
  deliveryAddressText: {
    fontSize: 13,
    color: '#37474F',
    marginTop: 4,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: '#546E7A',
  },
  codPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E65100',
  },
  acceptBtn: {
    backgroundColor: '#00897B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  callCustomerBtn: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    paddingVertical: 10,
    alignItems: 'center',
    marginVertical: 8,
  },
  callCustomerText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  codBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  codBoxLabel: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '600',
  },
  codBoxAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D84315',
  },
  completeBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  completeBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsContainer: {
    paddingBottom: 20,
  },
  statsCardPrimary: {
    backgroundColor: '#00897B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 3,
  },
  statsCardTitle: {
    color: '#E0F2F1',
    fontSize: 14,
    fontWeight: '600',
  },
  statsBigValue: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  statsSubText: {
    color: '#B2DFDB',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statsGridCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
  },
  statsGridNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#263238',
  },
  statsGridLabel: {
    fontSize: 12,
    color: '#78909C',
    marginTop: 4,
  },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#37474F',
    marginBottom: 10,
  },
  noHistoryText: {
    color: '#90A4AE',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
  historyRow: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyOrderTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#263238',
  },
  historyTime: {
    fontSize: 11,
    color: '#90A4AE',
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
});
