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
  Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchOrders, updateOrderStatus, fetchMenuItems, toggleItemStatus } from '../services/api';

export default function StaffKitchenScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'menu'
  const [orderFilter, setOrderFilter] = useState('all'); // 'all' | 'cho_xac_nhan' | 'dang_che_bien' | 'san_sang_giao'
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [orderRes, menuRes] = await Promise.all([
        fetchOrders(),
        fetchMenuItems()
      ]);
      if (orderRes.success) {
        setOrders(orderRes.data || []);
      }
      if (menuRes.success) {
        setMenuItems(menuRes.data || []);
      }
    } catch (error) {
      console.log('Lỗi tải dữ liệu bếp:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Cập nhật trạng thái đơn hàng
  const handleUpdateStatus = async (orderId, newStatus, actionTitle) => {
    Alert.alert(
      'Xác nhận thao tác 👨‍🍳',
      `Bạn có chắc muốn ${actionTitle} cho đơn #${orderId}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đồng ý',
          onPress: async () => {
            setUpdatingOrderId(orderId);
            try {
              const res = await updateOrderStatus(orderId, newStatus, `Bếp: ${actionTitle}`);
              if (res.success) {
                Alert.alert('Thành công 🎉', res.message);
                loadData();
              }
            } catch (err) {
              Alert.alert('Lỗi', err.message || 'Không thể cập nhật trạng thái đơn!');
            } finally {
              setUpdatingOrderId(null);
            }
          }
        }
      ]
    );
  };

  // Bật/tắt món còn/hết hàng
  const handleToggleItem = async (itemId, currentStatus, itemName) => {
    try {
      const res = await toggleItemStatus(itemId);
      if (res.success) {
        setMenuItems(prev => prev.map(m => m.ma_mon_an === itemId ? { ...m, trang_thai: res.data.trang_thai } : m));
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể đổi trạng thái món!');
    }
  };

  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'all') return ['cho_xac_nhan', 'dang_che_bien', 'san_sang_giao'].includes(o.trang_thai_don_hang);
    return o.trang_thai_don_hang === orderFilter;
  });

  const getStatusBadge = (st) => {
    switch (st) {
      case 'cho_xac_nhan':
        return { label: '🔔 Đơn mới chờ nhận', bg: '#FFE082', text: '#E65100' };
      case 'dang_che_bien':
        return { label: '🍳 Bếp đang nấu', bg: '#FFE0B2', text: '#BF360C' };
      case 'san_sang_giao':
        return { label: '📦 Đã xong - Chờ Shipper', bg: '#C8E6C9', text: '#1B5E20' };
      case 'dang_giao':
        return { label: '🛵 Shipper đang giao', bg: '#BBDEFB', text: '#0D47A1' };
      case 'da_giao':
        return { label: '✅ Đã giao thành công', bg: '#DCFCE7', text: '#15803D' };
      default:
        return { label: st, bg: '#EEE', text: '#666' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>👨‍🍳 Bếp & Cửa Hàng FastFood</Text>
          <Text style={styles.headerSubtitle}>Tài khoản: Nhân viên điều phối chế biến</Text>
        </View>
        <TouchableOpacity 
          style={styles.switchRoleBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.switchRoleText}>Hồ sơ 👤</Text>
        </TouchableOpacity>
      </View>

      {/* Main Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'orders' && styles.tabBtnActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            📋 Đơn Hàng Nhà Bếp ({filteredOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'menu' && styles.tabBtnActive]}
          onPress={() => setActiveTab('menu')}
        >
          <Text style={[styles.tabText, activeTab === 'menu' && styles.tabTextActive]}>
            🍔 Quản Lý Tồn Món
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'orders' ? (
        <>
          {/* Status Filter Chips */}
          <View style={styles.filterRow}>
            {[
              { id: 'all', label: 'Tất cả đơn cần làm' },
              { id: 'cho_xac_nhan', label: '🔔 Chờ xác nhận' },
              { id: 'dang_che_bien', label: '🍳 Đang nấu' },
              { id: 'san_sang_giao', label: '📦 Chờ Shipper' }
            ].map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, orderFilter === f.id && styles.chipActive]}
                onPress={() => setOrderFilter(f.id)}
              >
                <Text style={[styles.chipText, orderFilter === f.id && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && !refreshing ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#E65100" />
              <Text style={styles.loadingText}>Đang tải đơn hàng nhà bếp...</Text>
            </View>
          ) : (
            <ScrollView 
              contentContainerStyle={styles.scrollList}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#E65100']} />}
            >
              {filteredOrders.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>🎉</Text>
                  <Text style={styles.emptyTitle}>Bếp đang thảnh thơi!</Text>
                  <Text style={styles.emptySubtitle}>Không có đơn hàng nào cần xử lý trong mục này.</Text>
                </View>
              ) : (
                filteredOrders.map(order => {
                  const badge = getStatusBadge(order.trang_thai_don_hang);
                  const isUpdating = updatingOrderId === order.ma_don_hang;

                  return (
                    <View key={order.ma_don_hang} style={styles.orderCard}>
                      {/* Card Header */}
                      <View style={styles.orderCardHeader}>
                        <View>
                          <Text style={styles.orderIdText}>Đơn #{order.ma_don_hang}</Text>
                          <Text style={styles.orderTimeText}>{new Date(order.ngay_dat).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(order.ngay_dat).toLocaleDateString('vi-VN')}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                        </View>
                      </View>

                      {/* Customer Info */}
                      <View style={styles.customerBox}>
                        <Text style={styles.customerName}>👤 Khách: {order.ten_khach_hang || 'Khách hàng'} • 📞 {order.so_dien_thoai_nhan}</Text>
                        <Text style={styles.customerAddress} numberOfLines={2}>📍 {order.dia_chi_giao_hang}</Text>
                        {order.ghi_chu ? (
                          <Text style={styles.orderNoteText}>📝 Ghi chú: "{order.ghi_chu}"</Text>
                        ) : null}
                      </View>

                      {/* Action Buttons for Kitchen */}
                      <View style={styles.actionRow}>
                        {order.trang_thai_don_hang === 'cho_xac_nhan' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.btnCook]}
                            onPress={() => handleUpdateStatus(order.ma_don_hang, 'dang_che_bien', 'Nhận đơn & Chế biến')}
                            disabled={isUpdating}
                          >
                            {isUpdating ? <ActivityIndicator color="#FFF" size="small" /> : (
                              <Text style={styles.actionBtnText}>🍳 Nhận Đơn & Bắt Đầu Nấu</Text>
                            )}
                          </TouchableOpacity>
                        )}

                        {order.trang_thai_don_hang === 'dang_che_bien' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.btnReady]}
                            onPress={() => handleUpdateStatus(order.ma_don_hang, 'san_sang_giao', 'Làm xong - Báo Shipper')}
                            disabled={isUpdating}
                          >
                            {isUpdating ? <ActivityIndicator color="#FFF" size="small" /> : (
                              <Text style={styles.actionBtnText}>✅ Đã Làm Xong ➔ Báo Shipper</Text>
                            )}
                          </TouchableOpacity>
                        )}

                        {order.trang_thai_don_hang === 'san_sang_giao' && (
                          <View style={styles.waitingShipperBox}>
                            <Text style={styles.waitingShipperText}>
                              {order.ma_shipper 
                                ? `🛵 Shipper: ${order.ten_shipper || 'Tài xế'} đang tới nhận đồ!` 
                                : '⏳ Món đã gói xong, đang chờ tài xế Shipper nhận đơn...'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </>
      ) : (
        /* TAB 2: QUẢN LÝ TỒN MÓN (BẬT / TẮT CÒN HÀNG) */
        <ScrollView 
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <Text style={styles.menuGuideText}>
            💡 Bật/Tắt món ăn khi bếp hết nguyên liệu để khách hàng không đặt món này:
          </Text>
          {menuItems.map(item => {
            const isAvailable = item.trang_thai === 'con_hang';
            return (
              <View key={item.ma_mon_an} style={styles.menuItemRow}>
                <View style={styles.menuItemEmoji}>
                  <Text style={{ fontSize: 28 }}>🍔</Text>
                </View>
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemName}>{item.ten_mon}</Text>
                  <Text style={styles.menuItemPrice}>{parseFloat(item.gia_ban).toLocaleString('vi-VN')} đ</Text>
                  <Text style={[styles.menuStatusLabel, { color: isAvailable ? '#2E7D32' : '#C62828' }]}>
                    {isAvailable ? '✓ Đang mở bán' : '✕ Đang tạm hết'}
                  </Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={() => handleToggleItem(item.ma_mon_an, item.trang_thai, item.ten_mon)}
                  trackColor={{ false: '#CFD8DC', true: '#A5D6A7' }}
                  thumbColor={isAvailable ? '#2E7D32' : '#90A4AE'}
                />
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D84315',
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
    color: '#FFCCBC',
    marginTop: 2,
  },
  switchRoleBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  switchRoleText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    elevation: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#D84315',
  },
  tabText: {
    fontSize: 13,
    color: '#78909C',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#D84315',
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ECEFF1',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFD8DC',
  },
  chipActive: {
    backgroundColor: '#D84315',
    borderColor: '#D84315',
  },
  chipText: {
    fontSize: 12,
    color: '#455A64',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  scrollList: {
    padding: 12,
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
    color: '#607D8B',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 50,
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
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#D84315',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  customerBox: {
    backgroundColor: '#FAFAFA',
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
  },
  customerName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#37474F',
  },
  customerAddress: {
    fontSize: 12,
    color: '#546E7A',
    marginTop: 2,
  },
  orderNoteText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionRow: {
    marginTop: 8,
  },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCook: {
    backgroundColor: '#E65100',
  },
  btnReady: {
    backgroundColor: '#2E7D32',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  waitingShipperBox: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  waitingShipperText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  menuGuideText: {
    fontSize: 13,
    color: '#546E7A',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  menuItemRow: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
  },
  menuItemEmoji: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#263238',
  },
  menuItemPrice: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '600',
    marginTop: 2,
  },
  menuStatusLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
