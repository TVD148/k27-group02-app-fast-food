import React, { useState, useEffect, useMemo } from 'react';
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
  Modal,
  TextInput,
  StatusBar,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchOrders, updateOrderStatus, fetchMenuItems, toggleItemStatus, updateUserProfile, logoutUser } from '../services/api';

export default function StaffKitchenScreen({ navigation }) {
  // 3 Bottom Tabs: 'pending' (Đơn mới), 'cooking' (Đang nấu & Sẵn sàng), 'profile' (Hồ sơ)
  const [activeBottomTab, setActiveBottomTab] = useState('pending');
  
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Profile Edit & Logout State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    ho_ten: '',
    so_dien_thoai: '',
    email: ''
  });

  const handleOpenEditProfile = () => {
    setProfileForm({
      ho_ten: currentUser?.ho_ten || '',
      so_dien_thoai: currentUser?.so_dien_thoai || '',
      email: currentUser?.email || ''
    });
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.ho_ten.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ và tên');
      return;
    }
    if (!profileForm.so_dien_thoai.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await updateUserProfile(
        profileForm.ho_ten.trim(),
        profileForm.so_dien_thoai.trim(),
        profileForm.email.trim()
      );
      if (res && res.success) {
        Alert.alert('Thành công', 'Thông tin nhân viên đã được cập nhật thành công!');
        const updated = {
          ...currentUser,
          ho_ten: profileForm.ho_ten.trim(),
          so_dien_thoai: profileForm.so_dien_thoai.trim(),
          email: profileForm.email.trim()
        };
        setCurrentUser(updated);
        await AsyncStorage.setItem('user_info', JSON.stringify(updated));
        setShowEditProfileModal(false);
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể cập nhật thông tin');
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Có lỗi xảy ra khi cập nhật thông tin');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Đăng Xuất Ca Làm Việc',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản nhân viên / bếp?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng Xuất',
          style: 'destructive',
          onPress: async () => {
            setShowEditProfileModal(false);
            try {
              await logoutUser();
            } catch (e) {
              console.log('Lỗi đăng xuất:', e.message);
            }
            await AsyncStorage.multiRemove(['user_token', 'user_info', 'user_role']);
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  // Modal Chi tiết Đơn Chế Biến (Killer Feature)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [checkedItems, setCheckedItems] = useState({}); // { [stepKey]: boolean }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadDataSilently();
    }, 8000);
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [navigation]);

  const loadData = async () => {
    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem('user_info');
      if (stored) setCurrentUser(JSON.parse(stored));

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

  const loadDataSilently = async () => {
    try {
      const [orderRes, menuRes] = await Promise.all([
        fetchOrders().catch(() => null),
        fetchMenuItems().catch(() => null)
      ]);
      if (orderRes && orderRes.success) {
        setOrders(orderRes.data || []);
      }
      if (menuRes && menuRes.success) {
        setMenuItems(menuRes.data || []);
      }
    } catch (e) {}
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Bật / tắt tồn kho món ăn nhanh từ màn hình bếp
  const handleToggleItem = async (foodId, currentStatus, foodName) => {
    try {
      const res = await toggleItemStatus(foodId);
      if (res && res.success) {
        const newStatus = res.trang_thai_moi || res.data?.trang_thai || (currentStatus === 'con_hang' ? 'het_hang' : 'con_hang');
        setMenuItems(prev => prev.map(f => f.ma_mon_an === foodId ? { ...f, trang_thai: newStatus } : f));
        Alert.alert('Đã cập nhật', `${foodName}: ${newStatus === 'con_hang' ? 'Đã chuyển sang CÒN HÀNG ✅' : 'Đã chuyển sang HẾT HÀNG ❌'}`);
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể đổi trạng thái món!');
    }
  };

  // Phân loại đơn:
  // Đơn mới: 'cho_xac_nhan'
  // Đang nấu: 'dang_che_bien', 'san_sang_giao'
  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.trang_thai_don_hang === 'cho_xac_nhan');
  }, [orders]);

  const cookingOrders = useMemo(() => {
    return orders.filter(o => ['dang_che_bien', 'san_sang_giao'].includes(o.trang_thai_don_hang));
  }, [orders]);

  // Xác định độ ưu tiên đơn hàng (Đỏ nếu chờ > 15 phút, Xanh nếu mới đặt)
  const getOrderPriority = (orderDateStr) => {
    if (!orderDateStr) return { isUrgent: false, waitMinutes: 0 };
    const orderTime = new Date(orderDateStr).getTime();
    const now = new Date().getTime();
    const diffMinutes = Math.max(0, Math.floor((now - orderTime) / 60000));
    return {
      isUrgent: diffMinutes >= 15,
      waitMinutes: diffMinutes
    };
  };

  // Mở modal chi tiết chế biến cho 1 đơn hàng
  const openOrderDetail = (order) => {
    setSelectedOrder(order);
    setCheckedItems({});
  };

  const toggleCheckStep = (key) => {
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleUpdateStatus = async (orderId, newStatus, actionTitle) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await updateOrderStatus(orderId, newStatus, `Bếp: ${actionTitle}`);
      if (res.success) {
        const successMsg = newStatus === 'dang_che_bien' 
          ? 'Đã nhận đơn và chuyển sang trạng thái đang nấu thành công! 🍳'
          : (res.message || 'Cập nhật trạng thái thành công!');
        Alert.alert('Thành công 🎉', successMsg);
        if (selectedOrder && selectedOrder.ma_don_hang === orderId) {
          setSelectedOrder(null);
        }
        loadData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể cập nhật trạng thái đơn!');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Render Danh Sách Đơn Hàng Dạng Card
  const renderOrderList = (orderList, isPendingView = true) => {
    if (orderList.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIcon}>🍳💤</Text>
          </View>
          <Text style={styles.emptyTitle}>Bếp đang rảnh rỗi!</Text>
          <Text style={styles.emptySubtitle}>
            {isPendingView 
              ? 'Hiện chưa có đơn hàng nào, bếp đang rảnh rỗi!' 
              : 'Chưa có đơn hàng nào đang trong quá trình chế biến.'}
          </Text>
          <TouchableOpacity style={styles.emptyReloadBtn} onPress={handleRefresh}>
            <Text style={styles.emptyReloadText}>🔄 Làm Mới Dữ Liệu</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cardsContainer}>
        {orderList.map((order) => {
          const { isUrgent, waitMinutes } = getOrderPriority(order.ngay_dat);
          const isPending = order.trang_thai_don_hang === 'cho_xac_nhan';
          const isCooking = order.trang_thai_don_hang === 'dang_che_bien';
          const isReady = order.trang_thai_don_hang === 'san_sang_giao';

          return (
            <TouchableOpacity
              key={order.ma_don_hang}
              activeOpacity={0.88}
              onPress={() => openOrderDetail(order)}
              style={[
                styles.orderCard,
                isUrgent ? styles.urgentCardBorder : styles.normalCardBorder
              ]}
            >
              {/* Header Thẻ Đơn */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.orderIdBadge}>
                  <Text style={styles.orderIdText}>#{order.ma_don_hang}</Text>
                </View>

                {/* Badge Độ Ưu Tiên (Đỏ = Chờ lâu, Xanh = Mới) */}
                <View style={[
                  styles.priorityBadge, 
                  isUrgent ? styles.urgentBadgeBg : styles.normalBadgeBg
                ]}>
                  <Text style={[
                    styles.priorityBadgeText,
                    isUrgent ? styles.urgentBadgeText : styles.normalBadgeText
                  ]}>
                    {isUrgent ? `🔥 CHỜ LÂU: ${waitMinutes} PHÚT` : `⚡ MỚI ĐẶT: ${waitMinutes}p`}
                  </Text>
                </View>
              </View>

              {/* Thông tin khách hàng & Bàn/Thời gian */}
              <View style={styles.customerInfoRow}>
                <Text style={styles.customerNameText}>👤 {order.ten_khach_hang || 'Khách hàng'}</Text>
                <Text style={styles.orderTimeText}>🕒 {new Date(order.ngay_dat).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>

              {/* Trích xuất nhanh món ăn */}
              <View style={styles.quickItemList}>
                <Text style={styles.quickItemLabel}>Món cần chuẩn bị ({order.tong_so_mon || (order.danh_sach_mon ? order.danh_sach_mon.length : 1)} món):</Text>
                {Array.isArray(order.danh_sach_mon) && order.danh_sach_mon.length > 0 ? (
                  <View style={styles.cardDishesContainer}>
                    {order.danh_sach_mon.map((dish, dIdx) => {
                      const hasCustom = !!dish.dinh_duong_tuy_bien;
                      return (
                        <View key={dish.ma_chi_tiet || dIdx} style={styles.cardDishRow}>
                          <Text style={styles.cardDishName}>
                            • <Text style={{ fontWeight: '800', color: '#0F172A' }}>{dish.so_luong}x</Text> {dish.ten_mon}
                          </Text>
                          {hasCustom && (
                            <View style={styles.cardCustomTag}>
                              <Text style={styles.cardCustomTagText}>⚡ Có tùy biến</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.quickItemText} numberOfLines={2}>
                    {order.dia_chi_giao ? `📍 Giao: ${order.dia_chi_giao}` : 'Đơn đặt tại quán'}
                  </Text>
                )}
                {order.ghi_chu ? (
                  <View style={styles.cardNoteBox}>
                    <Text style={styles.cardNoteLabel}>💬 Lời nhắn của khách:</Text>
                    <Text style={styles.cardNoteText}>"{order.ghi_chu}"</Text>
                  </View>
                ) : null}
              </View>

              {/* Dải nút bấm tương tác nhanh to rõ ràng */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.detailTouchBtn}
                  onPress={() => openOrderDetail(order)}
                >
                  <Text style={styles.detailTouchBtnText}>🔍 Xem Tùy Biến Bếp</Text>
                </TouchableOpacity>

                {isPending && (
                  <TouchableOpacity
                    style={styles.startCookBtn}
                    onPress={() => handleUpdateStatus(order.ma_don_hang, 'dang_che_bien', 'Bắt đầu nấu')}
                    disabled={updatingOrderId === order.ma_don_hang}
                  >
                    {updatingOrderId === order.ma_don_hang ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.startCookBtnText}>🍳 Nhận & Nấu</Text>
                    )}
                  </TouchableOpacity>
                )}

                {isCooking && (
                  <TouchableOpacity
                    style={styles.finishCookBtn}
                    onPress={() => handleUpdateStatus(order.ma_don_hang, 'san_sang_giao', 'Báo hoàn tất')}
                    disabled={updatingOrderId === order.ma_don_hang}
                  >
                    {updatingOrderId === order.ma_don_hang ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.finishCookBtnText}>✅ Đã Nấu Xong</Text>
                    )}
                  </TouchableOpacity>
                )}

                {isReady && (
                  <View style={styles.readyBadgeCard}>
                    <Text style={styles.readyBadgeCardText}>📦 Chờ Shipper đến lấy</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Render Màn hình Hồ sơ & Quản lý Kho Bếp
  const renderProfileTab = () => (
    <ScrollView contentContainerStyle={styles.profileScroll}>
      {/* Thẻ định danh đầu bếp */}
      <View style={styles.kitchenProfileCard}>
        <TouchableOpacity 
          style={styles.kitchenAvatarCircle}
          onPress={handleOpenEditProfile}
          activeOpacity={0.8}
        >
          <Text style={styles.kitchenAvatarEmoji}>👨‍🍳</Text>
          <View style={styles.avatarEditPencilBadge}>
            <Text style={styles.avatarEditPencilIcon}>✏️</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.kitchenStaffName}>{currentUser?.ho_ten || 'Đầu Bếp Trưởng'}</Text>
        <View style={styles.staffRoleBadge}>
          <Text style={styles.staffRoleBadgeText}>
            {currentUser?.ma_vai_tro === 5 ? '👨‍🍳 Bếp Trưởng / Chế Biến' : '🧑‍🍳 Nhân Viên Quán'}
          </Text>
        </View>
        <Text style={styles.kitchenStaffInfoRow}>📞 SĐT: {currentUser?.so_dien_thoai || 'Chưa cập nhật'}</Text>
        <Text style={styles.kitchenStaffInfoRow}>📧 Email: {currentUser?.email || 'Chưa cập nhật'}</Text>
        
        <View style={styles.kitchenStatusPill}>
          <View style={styles.onlineDot} />
          <Text style={styles.kitchenStatusText}>Bếp Đang Trực Tuyến & Nhận Đơn</Text>
        </View>
      </View>

      {/* Quản lý tình trạng nguyên liệu & món ăn nhanh */}
      <View style={styles.stockSectionCard}>
        <Text style={styles.stockSectionTitle}>📦 Bật / Tắt Tồn Kho Món Nhanh</Text>

        {menuItems.map((item) => {
          const isAvailable = item.trang_thai === 'con_hang';
          return (
            <View key={item.ma_mon_an} style={styles.stockRow}>
              <View style={styles.stockInfoCol}>
                <Text style={styles.stockItemName}>{item.ten_mon}</Text>
                <Text style={styles.stockItemPrice}>{parseFloat(item.gia_ban).toLocaleString('vi-VN')} đ</Text>
              </View>
              <View style={styles.stockActionCol}>
                <Text style={[styles.stockStatusLabel, isAvailable ? styles.textAvailable : styles.textOutOfStock]}>
                  {isAvailable ? 'Còn hàng' : 'Tạm hết'}
                </Text>
                <TouchableOpacity
                  style={[styles.toggleBtnPill, isAvailable ? styles.togglePillActive : styles.togglePillInactive]}
                  onPress={() => handleToggleItem(item.ma_mon_an, item.trang_thai, item.ten_mon)}
                >
                  <Text style={[styles.toggleBtnPillText, isAvailable ? styles.toggleTextActive : styles.toggleTextInactive]}>
                    {isAvailable ? 'ĐANG BÁN' : 'HẾT MÓN'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#B91C1C" />

      {/* Top Header Chuyên Dụng Cho Nhà Bếp */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeftCol}>
          <Text style={styles.brandTitle}>👨‍🍳 FASTFOOD KITCHEN VIEW</Text>
          <Text style={styles.brandSubtitle}>Màn Hình Điều Phối Bếp & Chế Biến</Text>
        </View>

        <TouchableOpacity style={styles.syncBtn} onPress={handleRefresh}>
          <Text style={styles.syncBtnText}>🔄 Làm mới</Text>
        </TouchableOpacity>
      </View>

      {/* Thân Màn Hình Dựa Vào 3 Bottom Tabs */}
      <View style={styles.bodyContent}>
        {loading && !refreshing ? (
          <View style={styles.loaderCenter}>
            <ActivityIndicator size="large" color="#DC2626" />
            <Text style={styles.loaderText}>Đang đồng bộ hóa đơn bếp...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#DC2626']} />}
            contentContainerStyle={styles.scrollBody}
          >
            {activeBottomTab === 'pending' && renderOrderList(pendingOrders, true)}
            {activeBottomTab === 'cooking' && renderOrderList(cookingOrders, false)}
            {activeBottomTab === 'profile' && renderProfileTab()}
          </ScrollView>
        )}
      </View>

      {/* ========================================================================= */}
      {/* 3 BOTTOM TABS CHUẨN UX CHECKLIST: Đơn mới (Pending), Đang nấu, Hồ sơ */}
      {/* ========================================================================= */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'pending' && styles.bottomTabItemActive]}
          onPress={() => setActiveBottomTab('pending')}
          activeOpacity={0.8}
        >
          <View style={styles.tabIconBadgeWrap}>
            <Text style={styles.bottomTabIcon}>🔔</Text>
            {pendingOrders.length > 0 && (
              <View style={styles.badgeCounter}>
                <Text style={styles.badgeCounterText}>{pendingOrders.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomTabText, activeBottomTab === 'pending' && styles.bottomTabTextActive]}>
            Đơn mới
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'cooking' && styles.bottomTabItemActive]}
          onPress={() => setActiveBottomTab('cooking')}
          activeOpacity={0.8}
        >
          <View style={styles.tabIconBadgeWrap}>
            <Text style={styles.bottomTabIcon}>🍳</Text>
            {cookingOrders.length > 0 && (
              <View style={[styles.badgeCounter, { backgroundColor: '#EA580C' }]}>
                <Text style={styles.badgeCounterText}>{cookingOrders.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomTabText, activeBottomTab === 'cooking' && styles.bottomTabTextActive]}>
            Đang nấu ({cookingOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'profile' && styles.bottomTabItemActive]}
          onPress={() => setActiveBottomTab('profile')}
          activeOpacity={0.8}
        >
          <Text style={styles.bottomTabIcon}>👤</Text>
          <Text style={[styles.bottomTabText, activeBottomTab === 'profile' && styles.bottomTabTextActive]}>
            Hồ sơ & Kho
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* MODAL CHI TIẾT ĐƠN (ORDER DETAIL) - KILLER FEATURE CHO ĐẦU BẾP */}
      {/* ========================================================================= */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedOrder(null)}
      >
        <SafeAreaView style={styles.modalSafeContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalHeaderTitle}>📋 CHI TIẾT ĐƠN #{selectedOrder?.ma_don_hang}</Text>
              <Text style={styles.modalHeaderSubtitle}>
                Khách: {selectedOrder?.ten_khach_hang} • {selectedOrder?.dia_chi_giao || 'Tại quán'}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setSelectedOrder(null)}
            >
              <Text style={styles.modalCloseText}>✕ Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {/* Banner Ghi Chú Đặc Biệt (Nếu có) */}
            {selectedOrder?.ghi_chu ? (
              <View style={styles.alertNoteBanner}>
                <Text style={styles.alertNoteTitle}>🚨 LƯU Ý ĐẶC BIỆT TỪ KHÁCH HÀNG:</Text>
                <Text style={styles.alertNoteDesc}>{selectedOrder.ghi_chu}</Text>
              </View>
            ) : null}

            {/* BẢNG TÙY BIẾN CÔNG THỨC & NGUYÊN LIỆU THỰC TẾ THEO TỪNG MÓN ĐƠN HÀNG */}
            <View style={styles.killerFeatureCard}>
              <View style={styles.killerHeaderRow}>
                <Text style={styles.killerHeaderTitle}>🥗 TÙY CHỌN NGUYÊN LIỆU & CÔNG THỨC NẤU</Text>
                <Text style={styles.killerHeaderSub}>Kiểm tra chi tiết từng món trước khi chế biến</Text>
              </View>

              {Array.isArray(selectedOrder?.danh_sach_mon) && selectedOrder.danh_sach_mon.length > 0 ? (
                selectedOrder.danh_sach_mon.map((dish, dishIdx) => {
                  const hasCustom = !!dish.dinh_duong_tuy_bien;
                  const customNutri = dish.dinh_duong_tuy_bien || {};
                  const adjustedLabels = Array.isArray(customNutri.adjusted_labels)
                    ? customNutri.adjusted_labels
                    : (Array.isArray(customNutri.tuy_bien_labels) ? customNutri.tuy_bien_labels : []);
                  const stepKey = `dish_${dish.ma_chi_tiet || dishIdx}`;
                  const isChecked = !!checkedItems[stepKey];

                  return (
                    <View key={stepKey} style={styles.dishSectionBlock}>
                      {/* Tiêu đề món */}
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => toggleCheckStep(stepKey)}
                        style={[
                          styles.dishHeaderRow,
                          isChecked && styles.stepCheckboxRowDone
                        ]}
                      >
                        <View style={[styles.largeCheckboxBox, isChecked && styles.largeCheckboxBoxDone]}>
                          {isChecked ? (
                            <Text style={styles.checkmarkIcon}>✓</Text>
                          ) : (
                            <View style={styles.emptyCheckboxHole} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dishItemNameHeading, isChecked && styles.stepLabelDone]}>
                            {dish.so_luong}x {dish.ten_mon}
                          </Text>
                          <Text style={styles.dishItemStatusHint}>
                            {isChecked ? 'Đã hoàn thành món này' : 'Chạm vào ô để đánh dấu đã nấu xong món'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Nội dung Tùy Biến Hoặc Làm Bình Thường */}
                      <View style={styles.dishCustomizationBody}>
                        {hasCustom ? (
                          <View style={styles.customizedNoticeCard}>
                            <View style={styles.customizedBadgeHeader}>
                              <Text style={styles.customizedBadgeTitle}>🔥 CÓ TÙY BIẾN THEO YÊU CẦU CỦA KHÁCH:</Text>
                              {customNutri.calo ? (
                                <Text style={styles.customizedCaloText}>Tổng calo: {customNutri.calo} kcal</Text>
                              ) : null}
                            </View>

                            {adjustedLabels.length > 0 ? (
                              <View style={styles.adjustedLabelsList}>
                                {adjustedLabels.map((lbl, lIdx) => (
                                  <View key={lIdx} style={styles.adjustedLabelItem}>
                                    <Text style={styles.adjustedLabelText}>👉 {lbl}</Text>
                                  </View>
                                ))}
                              </View>
                            ) : (
                              <Text style={styles.customizedFallbackText}>
                                Khách đã điều chỉnh lượng nguyên liệu riêng cho món này (xem chi tiết calo).
                              </Text>
                            )}
                          </View>
                        ) : (
                          <View style={styles.standardNoticeCard}>
                            <Text style={styles.standardNoticeIcon}>✅</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.standardNoticeTitle}>Món làm bình thường (Không có tùy biến)</Text>
                              <Text style={styles.standardNoticeDesc}>
                                Món này là "{dish.ten_mon}", chế biến theo món chuẩn của quán.
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.standardNoticeCard}>
                  <Text style={styles.standardNoticeTitle}>Món làm bình thường theo thực đơn của quán.</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* NÚT CTA TRÀN VIỀN XANH LÁ "BÁO MÓN HOÀN TẤT" */}
          <View style={styles.modalFooterCTA}>
            {selectedOrder?.trang_thai_don_hang === 'cho_xac_nhan' ? (
              <TouchableOpacity
                style={styles.fullWidthStartBtn}
                onPress={() => handleUpdateStatus(selectedOrder.ma_don_hang, 'dang_che_bien', 'Bắt đầu nấu')}
                disabled={updatingOrderId === selectedOrder?.ma_don_hang}
              >
                {updatingOrderId === selectedOrder?.ma_don_hang ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.fullWidthCtaText}>🍳 NHẬN & NẤU NGAY</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.fullWidthCompleteBtn}
                onPress={() => handleUpdateStatus(selectedOrder?.ma_don_hang, 'san_sang_giao', 'Báo món hoàn tất')}
                disabled={updatingOrderId === selectedOrder?.ma_don_hang}
              >
                {updatingOrderId === selectedOrder?.ma_don_hang ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.fullWidthCtaText}>✅ BÁO MÓN HOÀN TẤT ➔ CHUYỂN SHIPPER</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL THAY ĐỔI THÔNG TIN CỦA NHÂN VIÊN/BẾP TRỰC TIẾP */}
      <Modal
        visible={showEditProfileModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editProfileCard}>
            <View style={styles.editProfileHeader}>
              <Text numberOfLines={1} style={styles.editProfileTitle}>👤 Thông Tin Nhân Viên</Text>
              <TouchableOpacity 
                style={styles.modalCircleCloseBtn}
                onPress={() => setShowEditProfileModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCircleCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.inputFieldLabel}>Họ và tên *</Text>
              <TextInput
                style={styles.profileTextInput}
                placeholder="Nhập họ và tên..."
                value={profileForm.ho_ten}
                onChangeText={(t) => setProfileForm({ ...profileForm, ho_ten: t })}
              />

              <Text style={styles.inputFieldLabel}>Số điện thoại *</Text>
              <TextInput
                style={styles.profileTextInput}
                placeholder="Nhập số điện thoại..."
                keyboardType="phone-pad"
                value={profileForm.so_dien_thoai}
                onChangeText={(t) => setProfileForm({ ...profileForm, so_dien_thoai: t })}
              />

              <Text style={styles.inputFieldLabel}>Email</Text>
              <TextInput
                style={styles.profileTextInput}
                placeholder="Nhập địa chỉ email..."
                keyboardType="email-address"
                autoCapitalize="none"
                value={profileForm.email}
                onChangeText={(t) => setProfileForm({ ...profileForm, email: t })}
              />

              <View style={styles.editProfileActions}>
                <TouchableOpacity
                  style={styles.editProfileCancelBtn}
                  onPress={() => setShowEditProfileModal(false)}
                  disabled={savingProfile}
                >
                  <Text style={styles.editProfileCancelText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editProfileSubmitBtn}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.editProfileSubmitText}>💾 Lưu Thay Đổi</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* NÚT ĐĂNG XUẤT NẰM TRONG POPUP AVATAR */}
              <View style={styles.modalLogoutDivider} />
              <TouchableOpacity
                style={styles.modalLogoutBtn}
                onPress={handleLogout}
              >
                <Text style={styles.modalLogoutBtnText}>🚪 Đăng Xuất Ca Làm Việc</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topHeader: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 14,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#B91C1C',
  },
  headerLeftCol: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#FEE2E2',
    marginTop: 2,
    fontWeight: '500',
  },
  syncBtn: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bodyContent: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollBody: {
    padding: 14,
    paddingBottom: 24,
  },
  loaderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  cardsContainer: {
    gap: 14,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  urgentCardBorder: {
    borderLeftWidth: 8,
    borderLeftColor: '#EF4444', // Viền đỏ = Đơn chờ lâu
  },
  normalCardBorder: {
    borderLeftWidth: 8,
    borderLeftColor: '#10B981', // Viền xanh = Đơn mới
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderIdBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  urgentBadgeBg: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  urgentBadgeText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 12,
  },
  normalBadgeBg: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  normalBadgeText: {
    color: '#15803D',
    fontWeight: '800',
    fontSize: 12,
  },
  customerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  orderTimeText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  quickItemList: {
    paddingVertical: 8,
  },
  quickItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  quickItemText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  cardDishesContainer: {
    marginTop: 6,
    gap: 4,
  },
  cardDishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  cardDishName: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },
  cardCustomTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cardCustomTagText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
  },
  cardNoteBox: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cardNoteLabel: {
    color: '#92400E',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 2,
  },
  cardNoteText: {
    color: '#B45309',
    fontWeight: '700',
    fontSize: 13,
  },
  dishSectionBlock: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  dishHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  dishItemNameHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  dishItemStatusHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dishCustomizationBody: {
    marginTop: 8,
    paddingLeft: 4,
  },
  customizedNoticeCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 12,
  },
  customizedBadgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 4,
  },
  customizedBadgeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#B45309',
  },
  customizedCaloText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EA580C',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adjustedLabelsList: {
    gap: 6,
  },
  adjustedLabelItem: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  adjustedLabelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  customizedFallbackText: {
    fontSize: 13,
    color: '#78350F',
    fontWeight: '600',
  },
  standardNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
  },
  standardNoticeIcon: {
    fontSize: 18,
  },
  standardNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  standardNoticeDesc: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 2,
  },
  modalCircleCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCircleCloseText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#64748B',
  },
  editProfileCard: {
    backgroundColor: '#FFFFFF',
    width: '90%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  editProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  editProfileTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    flex: 1,
    marginRight: 10,
  },
  editProfileCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  inputFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 10,
    marginBottom: 6,
  },
  profileTextInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  editProfileActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  editProfileCancelBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileCancelText: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 14,
  },
  editProfileSubmitBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  detailTouchBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minHeight: 44, // Touch target chuẩn
    justifyContent: 'center',
  },
  detailTouchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  startCookBtn: {
    flex: 1,
    backgroundColor: '#EA580C',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  startCookBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  finishCookBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  finishCookBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  readyBadgeCard: {
    flex: 1,
    backgroundColor: '#E0F2FE',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  readyBadgeCardText: {
    color: '#0284C7',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  emptyIcon: {
    fontSize: 44,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyReloadBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  emptyReloadText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  bottomNavContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 48,
  },
  bottomTabItemActive: {
    borderTopWidth: 3,
    borderTopColor: '#DC2626',
  },
  tabIconBadgeWrap: {
    position: 'relative',
  },
  bottomTabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  badgeCounter: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeCounterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  bottomTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  bottomTabTextActive: {
    color: '#DC2626',
    fontWeight: '800',
  },
  modalSafeContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  modalHeaderSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  alertNoteBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  alertNoteTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#B45309',
    marginBottom: 4,
  },
  alertNoteDesc: {
    fontSize: 15,
    color: '#78350F',
    fontWeight: '700',
  },
  killerFeatureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  killerHeaderRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 14,
  },
  killerHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  killerHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  stepCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minHeight: 64, // Touch target cực lớn cho đầu bếp
  },
  stepCheckboxRowDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  stepAlertBorder: {
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
  },
  largeCheckboxBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  largeCheckboxBoxDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmarkIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  emptyCheckboxHole: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepLabelText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  stepTextBold: {
    fontWeight: '900',
    fontSize: 16, // SIÊU TO, IN ĐẬM THEO YÊU CẦU
    color: '#0F172A',
  },
  stepTextAlert: {
    color: '#DC2626',
  },
  stepLabelDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  stepHintText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalFooterCTA: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  fullWidthStartBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  fullWidthCompleteBtn: {
    backgroundColor: '#10B981', // XANH LÁ TRÀN VIỀN
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  fullWidthCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileScroll: {
    padding: 16,
  },
  kitchenProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kitchenAvatarCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  kitchenAvatarEmoji: {
    fontSize: 36,
  },
  kitchenStaffName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  kitchenStaffRole: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  kitchenStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  kitchenStatusText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 12,
  },
  stockSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  stockSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  stockSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stockInfoCol: {
    flex: 1,
  },
  stockItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  stockItemPrice: {
    fontSize: 12,
    color: '#64748B',
  },
  stockActionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockStatusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  textAvailable: {
    color: '#16A34A',
  },
  textOutOfStock: {
    color: '#DC2626',
  },
  toggleBtnPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  togglePillActive: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  togglePillInactive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  toggleBtnPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  toggleTextActive: {
    color: '#15803D',
  },
  toggleTextInactive: {
    color: '#DC2626',
  },
  exitKitchenBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  exitKitchenBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  staffRoleBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  staffRoleBadgeText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  kitchenStaffInfoRow: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    textAlign: 'center',
  },
  editProfileTouchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 18,
    shadowColor: '#DC2626',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  editProfileTouchBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  logoutDirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  logoutDirectBtnText: {
    color: '#D32F2F',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalLogoutDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 18,
    marginBottom: 12,
  },
  modalLogoutBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLogoutBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
  },
});
