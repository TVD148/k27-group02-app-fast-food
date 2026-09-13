import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView,
  Modal,
  ScrollView,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchOrders } from '../services/api';
import BottomTabBar from '../components/BottomTabBar';

export default function OrdersListScreen({ navigation }) {
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab phân loại danh mục đơn hàng
  const [selectedTab, setSelectedTab] = useState('');

  // Bộ lọc ngày tháng (chuẩn Shopee)
  const [selectedDate, setSelectedDate] = useState(null); // 'YYYY-MM-DD' hoặc null
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Trạng thái tháng/năm xem trong lịch
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth()); // 0-indexed
  const [tempSelectedDate, setTempSelectedDate] = useState(null);

  useEffect(() => {
    loadOrders();
    const unsubscribe = navigation.addListener('focus', () => {
      loadOrders();
    });
    return unsubscribe;
  }, [navigation]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      if (!token) {
        setAllOrders([]);
        return;
      }
      // Tải tất cả đơn để lọc tức thời client-side
      const response = await fetchOrders();
      if (response.success && Array.isArray(response.data)) {
        setAllOrders(response.data);
      } else {
        setAllOrders([]);
      }
    } catch (error) {
      console.log('Lỗi tải danh sách đơn hàng:', error.message);
      setAllOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  // 1. Danh mục Tab chuẩn ShopeeFood
  const tabs = [
    { key: '', label: 'Tất cả' },
    { key: 'dang_den', label: 'Đang đến' },
    { key: 'lich_su', label: 'Lịch sử' },
    { key: 'da_huy', label: 'Đã hủy' },
  ];

  // 2. Lọc đơn hàng kết hợp Tab & Ngày tháng
  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      // Lọc theo Tab danh mục
      if (selectedTab === 'dang_den') {
        if (!['cho_xac_nhan', 'dang_che_bien', 'dang_giao', 'san_sang_giao'].includes(order.trang_thai_don_hang)) {
          return false;
        }
      } else if (selectedTab === 'lich_su') {
        if (order.trang_thai_don_hang !== 'da_giao') {
          return false;
        }
      } else if (selectedTab === 'da_huy') {
        if (order.trang_thai_don_hang !== 'da_huy') {
          return false;
        }
      }

      // Lọc theo Ngày tháng (Shopee Date Filter: YYYY-MM-DD)
      if (selectedDate) {
        if (!order.ngay_dat) return false;
        const orderDate = new Date(order.ngay_dat);
        const y = orderDate.getFullYear();
        const m = String(orderDate.getMonth() + 1).padStart(2, '0');
        const d = String(orderDate.getDate()).padStart(2, '0');
        const orderDateStr = `${y}-${m}-${d}`;
        if (orderDateStr !== selectedDate) {
          return false;
        }
      }

      return true;
    });
  }, [allOrders, selectedTab, selectedDate]);

  // Format ngày hiển thị VN (DD/MM/YYYY)
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Mở bộ lọc ngày
  const handleOpenDatePicker = () => {
    setTempSelectedDate(selectedDate);
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        setCalendarYear(parseInt(parts[0], 10));
        setCalendarMonth(parseInt(parts[1], 10) - 1);
      }
    } else {
      const d = new Date();
      setCalendarYear(d.getFullYear());
      setCalendarMonth(d.getMonth());
    }
    setShowDatePicker(true);
  };

  // Xóa bộ lọc ngày (trở về xem tất cả các ngày)
  const handleClearDateFilter = () => {
    setSelectedDate(null);
    setTempSelectedDate(null);
    setShowDatePicker(false);
  };

  // Áp dụng ngày đã chọn
  const handleApplyDateFilter = () => {
    setSelectedDate(tempSelectedDate);
    setShowDatePicker(false);
  };

  // Đặt lại toàn bộ bộ lọc khi không tìm thấy đơn
  const handleResetAllFilters = () => {
    setSelectedTab('');
    setSelectedDate(null);
    setTempSelectedDate(null);
  };

  // Trợ giúp tạo ma trận ngày cho lịch Shopee
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0: CN, 1: T2,...

  const monthNames = [
    'Tháng Một', 'Tháng Hai', 'Tháng Ba', 'Tháng Tư', 
    'Tháng Năm', 'Tháng Sáu', 'Tháng Bảy', 'Tháng Tám', 
    'Tháng Chín', 'Tháng Mười', 'Tháng Mười Một', 'Tháng Mười Hai'
  ];

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  // Render lưới ngày của tháng
  const renderCalendarDays = () => {
    const totalDays = daysInMonth(calendarYear, calendarMonth);
    const startDay = firstDayOfMonth(calendarYear, calendarMonth);
    const grid = [];

    // Các ô trống trước ngày 1
    for (let i = 0; i < startDay; i++) {
      grid.push(<View key={`empty-${i}`} style={styles.calCell} />);
    }

    // Các ngày trong tháng
    for (let day = 1; day <= totalDays; day++) {
      const mStr = String(calendarMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateKey = `${calendarYear}-${mStr}-${dStr}`;
      const isSelected = tempSelectedDate === dateKey;

      const isToday = 
        now.getFullYear() === calendarYear &&
        now.getMonth() === calendarMonth &&
        now.getDate() === day;

      grid.push(
        <TouchableOpacity
          key={dateKey}
          style={[styles.calCell, isSelected && styles.calCellSelected]}
          onPress={() => setTempSelectedDate(dateKey)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.calDayText, 
            isSelected && styles.calDayTextSelected,
            isToday && !isSelected && styles.calDayTodayText
          ]}>
            {day}
          </Text>
          {isToday && !isSelected && <View style={styles.todayDot} />}
        </TouchableOpacity>
      );
    }

    return grid;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'cho_xac_nhan':
        return { label: '⏳ Chờ xác nhận', color: '#D97706', bg: '#FEF3C7' };
      case 'dang_che_bien':
        return { label: '👨‍🍳 Đang chế biến', color: '#0284C7', bg: '#E0F2FE' };
      case 'san_sang_giao':
        return { label: '🍽️ Chờ giao', color: '#0D9488', bg: '#CCFBF1' };
      case 'dang_giao':
        return { label: '🛵 Đang giao', color: '#7C3AED', bg: '#EDE9FE' };
      case 'da_giao':
        return { label: '🎉 Hoàn thành', color: '#16A34A', bg: '#DCFCE7' };
      case 'da_huy':
        return { label: '❌ Đã hủy', color: '#DC2626', bg: '#FEE2E2' };
      default:
        return { label: status, color: '#64748B', bg: '#F1F5F9' };
    }
  };

  // Render từng thẻ đơn hàng có chi tiết món ăn ("ngày nào đặt món gì")
  const renderOrderItem = ({ item }) => {
    const badge = getStatusBadge(item.trang_thai_don_hang);
    const orderDate = new Date(item.ngay_dat);
    const dateStr = !isNaN(orderDate.getTime()) 
      ? orderDate.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
      : item.ngay_dat;

    const dishes = Array.isArray(item.danh_sach_mon) ? item.danh_sach_mon : [];

    return (
      <TouchableOpacity 
        style={styles.orderCard}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('OrderTracking', { orderId: item.ma_don_hang })}
      >
        {/* Header đơn */}
        <View style={styles.cardHeader}>
          <View style={styles.orderIdBadgeWrap}>
            <Text style={styles.orderIdText}>Đơn #{item.ma_don_hang}</Text>
            <Text style={styles.orderDateHeader}>• {dateStr}</Text>
          </View>
          <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Danh sách các món ăn đã đặt trong đơn ("ngày nào đặt món gì") */}
        <View style={styles.dishesSection}>
          {dishes.length > 0 ? (
            dishes.map((dish, idx) => (
              <View key={dish.ma_chi_tiet || idx} style={styles.dishRow}>
                <View style={styles.dishBullet}>
                  <Text style={{ fontSize: 13 }}>🍔</Text>
                </View>
                <View style={styles.dishDetails}>
                  <Text style={styles.dishNameText}>
                    {dish.ten_mon} <Text style={styles.dishQtyText}>x{dish.so_luong}</Text>
                  </Text>
                  {dish.ghi_chu ? (
                    <Text style={styles.dishNoteText}>📝 {dish.ghi_chu}</Text>
                  ) : null}
                </View>
                <Text style={styles.dishPriceText}>
                  {parseFloat(dish.thanh_tien || (dish.don_gia * dish.so_luong)).toLocaleString('vi-VN')} đ
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.dishRow}>
              <Text style={styles.dishNameText}>Đơn hàng món ăn nhanh</Text>
              <Text style={styles.dishPriceText}>{item.tong_so_mon || 1} món</Text>
            </View>
          )}
        </View>

        {/* Địa chỉ giao */}
        <View style={styles.addressRow}>
          <Text style={styles.addressLabel}>📍 Giao tới: </Text>
          <Text style={styles.addressText} numberOfLines={1}>
            {item.dia_chi_giao_hang || item.dia_chi_giao || 'Địa chỉ khách hàng'}
          </Text>
        </View>

        {/* Footer tổng tiền & nút xem chi tiết */}
        <View style={styles.cardFooter}>
          <Text style={styles.totalItemsCountText}>
            Tổng {item.tong_so_mon || 1} món
          </Text>
          <View style={styles.totalPriceWrap}>
            <Text style={styles.totalPriceLabel}>Thành tiền: </Text>
            <Text style={styles.totalPriceValue}>
              {parseFloat(item.tong_thanh_toan || item.tong_tien).toLocaleString('vi-VN')} đ
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#EE4D2D" />

      {/* Header Cam Shopee Lịch Sử Đơn Hàng */}
      <View style={styles.topHeaderBar}>
        <Text style={styles.topHeaderTitle}>Đơn Hàng 📦</Text>
      </View>

      {/* 1. Thanh Tab Phân Loại Danh Mục (Chuẩn Shopee) */}
      <View style={styles.tabContainer}>
        {tabs.map(tab => {
          const isSelected = selectedTab === tab.key;
          return (
            <TouchableOpacity 
              key={tab.key}
              style={[styles.tabBtn, isSelected && styles.tabBtnActive]} 
              onPress={() => setSelectedTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {isSelected && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2. Thanh Bộ Lọc Ngày Tháng Chuẩn Shopee (Chỉ dùng bộ lọc ngày) */}
      <View style={styles.dateFilterBar}>
        <TouchableOpacity 
          style={[styles.dateFilterBtn, selectedDate && styles.dateFilterBtnActive]}
          onPress={handleOpenDatePicker}
          activeOpacity={0.8}
        >
          <Text style={[styles.dateFilterBtnText, selectedDate && styles.dateFilterBtnTextActive]}>
            📅 {selectedDate ? formatDateDisplay(selectedDate) : 'Tất cả ngày'}
          </Text>
          <Text style={[styles.dateChevron, selectedDate && styles.dateChevronActive]}>
            {showDatePicker ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>

        {selectedDate && (
          <TouchableOpacity 
            style={styles.clearDateFilterBadge}
            onPress={handleClearDateFilter}
            activeOpacity={0.7}
          >
            <Text style={styles.clearDateFilterBadgeText}>✕ Bỏ lọc ngày</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }} />
        <Text style={styles.orderCountBadgeText}>
          {filteredOrders.length} đơn
        </Text>
      </View>

      {/* Thân danh sách đơn hàng */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EE4D2D" />
          <Text style={styles.loadingText}>Đang tải đơn hàng...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        /* Empty State chuẩn Shopee khi không tìm thấy đơn (Minh họa hình ảnh Sổ tay & Bút chì cam) */
        <ScrollView 
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#EE4D2D']} />}
        >
          <View style={styles.emptyShopeeIllustration}>
            <View style={styles.notepadOuter}>
              <View style={styles.notepadHeader} />
              <View style={styles.notepadRow}>
                <View style={styles.notepadDot} />
                <View style={styles.notepadLine} />
              </View>
              <View style={styles.notepadRow}>
                <View style={styles.notepadDot} />
                <View style={styles.notepadLine} />
              </View>
              <View style={styles.notepadRow}>
                <View style={styles.notepadDot} />
                <View style={styles.notepadLine} />
              </View>
              {/* Bút chì nghiêng */}
              <View style={styles.pencilGraphic}>
                <Text style={{ fontSize: 32 }}>✏️</Text>
              </View>
            </View>
          </View>

          <Text style={styles.emptyShopeeTitle}>Bạn muốn đặt lại bộ lọc?</Text>
          <Text style={styles.emptyShopeeSubtitle}>
            Chà, không tìm thấy đơn hàng phù hợp rồi. Bạn vui lòng kiểm tra và thử lại nhé.
          </Text>

          <TouchableOpacity 
            style={styles.resetFilterBtn}
            onPress={handleResetAllFilters}
            activeOpacity={0.85}
          >
            <Text style={styles.resetFilterBtnText}>Đặt lại bộ lọc</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={item => item.ma_don_hang.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#EE4D2D']} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 3. Modal Lịch Chọn Ngày Chuẩn Shopee (Screenshot 2) */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.calModalCard}>
            {/* Header Tháng Năm & Mũi tên chuyển tháng */}
            <View style={styles.calMonthHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.calMonthArrow}>
                <Text style={styles.calMonthArrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calMonthTitle}>
                {monthNames[calendarMonth]} {calendarYear}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.calMonthArrow}>
                <Text style={styles.calMonthArrowText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Hàng các thứ trong tuần */}
            <View style={styles.calWeekRow}>
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((dayName, idx) => (
                <Text key={idx} style={[styles.calWeekDayText, idx === 0 && { color: '#EE4D2D' }]}>
                  {dayName}
                </Text>
              ))}
            </View>

            {/* Lưới các ngày trong tháng */}
            <View style={styles.calGrid}>
              {renderCalendarDays()}
            </View>

            {/* Hàng nút bấm Xóa & Chọn chuẩn Shopee */}
            <View style={styles.calBtnGroup}>
              <TouchableOpacity 
                style={styles.calResetBtn}
                onPress={handleClearDateFilter}
                activeOpacity={0.7}
              >
                <Text style={styles.calResetBtnText}>Xóa</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.calConfirmBtn}
                onPress={handleApplyDateFilter}
                activeOpacity={0.85}
              >
                <Text style={styles.calConfirmBtnText}>Chọn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Thanh điều hướng Bottom Tab */}
      <BottomTabBar activeTab="OrdersList" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  topHeaderBar: {
    backgroundColor: '#EE4D2D',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  topHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Tab Danh Mục chuẩn Shopee
  tabContainer: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    position: 'relative',
  },
  tabBtnActive: {
    // Active state
  },
  tabText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#EE4D2D',
    fontWeight: '800',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#EE4D2D',
    borderRadius: 2,
  },

  // Bộ lọc Ngày Tháng
  dateFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  dateFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  dateFilterBtnActive: {
    backgroundColor: '#FFF5F5',
    borderColor: '#EE4D2D',
  },
  dateFilterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  dateFilterBtnTextActive: {
    color: '#EE4D2D',
    fontWeight: '800',
  },
  dateChevron: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  dateChevronActive: {
    color: '#EE4D2D',
    fontWeight: 'bold',
  },
  clearDateFilterBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearDateFilterBadgeText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  orderCountBadgeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Danh sách đơn hàng
  listContent: {
    padding: 14,
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
    marginBottom: 10,
  },
  orderIdBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  orderDateHeader: {
    fontSize: 12,
    color: '#6B7280',
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Chi tiết món ăn ("ngày nào đặt món gì")
  dishesSection: {
    paddingVertical: 4,
    gap: 8,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
  },
  dishBullet: {
    marginRight: 8,
  },
  dishDetails: {
    flex: 1,
  },
  dishNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  dishQtyText: {
    color: '#EE4D2D',
    fontWeight: '800',
  },
  dishNoteText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontStyle: 'italic',
  },
  dishPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },

  // Địa chỉ
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  addressText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },

  // Footer thẻ đơn
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 10,
    paddingTop: 10,
  },
  totalItemsCountText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  totalPriceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  totalPriceLabel: {
    fontSize: 12,
    color: '#4B5563',
  },
  totalPriceValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#EE4D2D',
  },

  // Loading & Empty States
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 13,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyShopeeIllustration: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notepadOuter: {
    width: 120,
    height: 140,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: '#FB923C',
    backgroundColor: '#FFF7ED',
    padding: 12,
    justifyContent: 'space-around',
    position: 'relative',
  },
  notepadHeader: {
    width: '40%',
    height: 6,
    backgroundColor: '#FB923C',
    alignSelf: 'center',
    borderRadius: 3,
    marginBottom: 4,
  },
  notepadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notepadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EA580C',
  },
  notepadLine: {
    flex: 1,
    height: 6,
    backgroundColor: '#FDBA74',
    borderRadius: 3,
  },
  pencilGraphic: {
    position: 'absolute',
    right: -14,
    bottom: 20,
    transform: [{ rotate: '15deg' }],
  },
  emptyShopeeTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyShopeeSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  resetFilterBtn: {
    backgroundColor: '#EE4D2D',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Modal Lịch Shopee
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxWidth: 360,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  calMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calMonthArrow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  calMonthArrowText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#374151',
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  calWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  calWeekDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    width: 40,
    textAlign: 'center',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 2,
  },
  calCellSelected: {
    backgroundColor: '#EE4D2D',
    borderRadius: 20,
  },
  calDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  calDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  calDayTodayText: {
    color: '#EE4D2D',
    fontWeight: '800',
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EE4D2D',
  },
  calBtnGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  calResetBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EE4D2D',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  calResetBtnText: {
    color: '#EE4D2D',
    fontSize: 14,
    fontWeight: '800',
  },
  calConfirmBtn: {
    flex: 1,
    backgroundColor: '#EE4D2D',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  calConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
