import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  RefreshControl,
  SafeAreaView 
} from 'react-native';
import { fetchOrders } from '../services/api';

export default function OrdersListScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadOrders();
    });
    return unsubscribe;
  }, [navigation, selectedTab]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await fetchOrders(selectedTab);
      if (response.success) {
        setOrders(response.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tải danh sách đơn hàng!');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'cho_xac_nhan':
        return { label: '⏳ Chờ xác nhận', color: '#FF9800', bg: '#FFF3E0' };
      case 'dang_che_bien':
        return { label: '👨‍🍳 Đang chế biến', color: '#028090', bg: '#E0F2F1' };
      case 'dang_giao':
        return { label: '🛵 Đang giao', color: '#9C27B0', bg: '#F3E5F5' };
      case 'da_giao':
        return { label: '🎉 Đã hoàn thành', color: '#2E7D32', bg: '#E8F5E9' };
      case 'da_huy':
        return { label: '❌ Đã hủy', color: '#D32F2F', bg: '#FFEBEE' };
      default:
        return { label: status, color: '#777', bg: '#EEE' };
    }
  };

  const renderOrderItem = ({ item }) => {
    const badge = getStatusBadge(item.trang_thai_don_hang);

    return (
      <TouchableOpacity 
        style={styles.orderCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('OrderTracking', { orderId: item.ma_don_hang })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Đơn hàng #{item.ma_don_hang}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.dateText}>
          📅 {new Date(item.ngay_dat).toLocaleString('vi-VN')}
        </Text>

        <Text style={styles.addressText} numberOfLines={1}>
          📍 {item.dia_chi_giao_hang}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.itemCount}>
            {item.tong_so_mon || 1} món ăn
          </Text>
          <Text style={styles.totalPrice}>
            {parseFloat(item.tong_thanh_toan).toLocaleString('vi-VN')} đ
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const tabs = [
    { key: '', label: 'Tất cả' },
    { key: 'cho_xac_nhan', label: 'Chờ nhận' },
    { key: 'dang_che_bien', label: 'Đang làm' },
    { key: 'dang_giao', label: 'Đang giao' },
    { key: 'da_giao', label: 'Hoàn thành' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Thanh tab lọc trạng thái */}
      <View style={styles.tabContainer}>
        <FlatList
          data={tabs}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.key}
          renderItem={({ item }) => {
            const isSelected = selectedTab === item.key;
            return (
              <TouchableOpacity 
                style={[styles.tabBtn, isSelected && styles.tabBtnActive]} 
                onPress={() => setSelectedTab(item.key)}
              >
                <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00A896" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyText}>Chưa có đơn hàng nào!</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={item => item.ma_don_hang.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} colors={['#00A896']} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  },
  tabContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FF5722',
  },
  tabText: {
    fontSize: 13,
    color: '#6C757D',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    color: '#78909C',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
  },
  itemCount: {
    fontSize: 13,
    color: '#888',
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF5722',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#78909C',
    fontWeight: 'bold',
  },
});
