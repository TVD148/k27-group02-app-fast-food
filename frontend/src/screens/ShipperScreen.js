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
  Linking,
  Modal,
  PanResponder,
  Animated,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { fetchOrders, acceptOrderDelivery, updateOrderStatus, fetchShipperStats, fetchStoreLandmark } from '../services/api';

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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Thành phần Swipe to Confirm (Vuốt để xác nhận) chuẩn Checklist.design
function SwipeToConfirmButton({ onConfirm, title, icon = '➔', color = '#00897B' }) {
  const [swiped, setSwiped] = useState(false);
  const slideX = React.useRef(new Animated.Value(0)).current;
  const sliderWidth = SCREEN_WIDTH - 64; // padding 32
  const thumbWidth = 56;
  const maxSlide = sliderWidth - thumbWidth;

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx <= maxSlide) {
          slideX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= maxSlide * 0.75) {
          Animated.timing(slideX, {
            toValue: maxSlide,
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            setSwiped(true);
            onConfirm();
            setTimeout(() => {
              slideX.setValue(0);
              setSwiped(false);
            }, 1000);
          });
        } else {
          Animated.spring(slideX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={[styles.swipeTrack, { borderColor: color }]}>
      <Animated.View
        style={[
          styles.swipeFill,
          {
            backgroundColor: color,
            width: slideX.interpolate({
              inputRange: [0, maxSlide],
              outputRange: [thumbWidth, sliderWidth],
            }),
          },
        ]}
      />
      <Text style={styles.swipeTrackText}>{swiped ? 'Đã xác nhận thành công! ✅' : title}</Text>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeThumb,
          {
            transform: [
              {
                translateX: slideX.interpolate({
                  inputRange: [0, maxSlide],
                  outputRange: [0, maxSlide],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.swipeThumbIcon}>{icon}</Text>
      </Animated.View>
    </View>
  );
}

export default function ShipperScreen({ navigation }) {
  // 4 Bottom Tabs chuẩn: 'available' (Đơn chờ nhận), 'delivering' (Đơn đang giao), 'earnings' (Thu nhập), 'profile' (Hồ sơ)
  const [activeBottomTab, setActiveBottomTab] = useState('available');

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total_delivered: 0, total_cod: 0, total_delivering: 0, total_available: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOrderId, setActingOrderId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Trạng thái Shipper trực tuyến & Contextual Permissions
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
  const [showCameraPermissionModal, setShowCameraPermissionModal] = useState(false);

  // Mốc quán và phạm vi nhận đơn
  const [storeLandmark, setStoreLandmark] = useState({
    dia_chi_quan: '504 Đại lộ Bình Dương, Phường Hiệp Thành, TP. Thủ Dầu Một, Bình Dương',
    vi_do: 10.9805,
    kinh_do: 106.6745,
    ban_kinh_phuc_vu_km: 3.0,
    gia_ship_moi_km: 5000
  });

  // Modal Chụp ảnh minh chứng giao hàng
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [orderToDeliver, setOrderToDeliver] = useState(null);

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

      const [orderRes, statsRes, landmarkRes] = await Promise.all([
        fetchOrders(),
        fetchShipperStats(),
        fetchStoreLandmark().catch(() => null)
      ]);

      if (orderRes.success) {
        setOrders(orderRes.data || []);
      }
      if (statsRes.success) {
        setStats(statsRes.data || {});
      }
      if (landmarkRes && landmarkRes.success && landmarkRes.data) {
        setStoreLandmark(landmarkRes.data);
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

  // 1. Contextual Location Permission: Bấm "Bắt đầu làm việc" -> Hiển thị Popup giải thích trước khi gọi OS
  const handleToggleOnlineStatus = () => {
    if (!isOnline) {
      setShowLocationPermissionModal(true);
    } else {
      setIsOnline(false);
      Alert.alert('Đã tắt trực tuyến', 'Bạn đã tạm dừng nhận đơn giao hàng.');
    }
  };

  const handleGrantLocationPermission = async () => {
    setShowLocationPermissionModal(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation(loc.coords);
        setIsOnline(true);
        Alert.alert('Đã BẬT trực tuyến! 🟢', 'Bạn đang ở trạng thái sẵn sàng nhận các cuốc đơn giao quanh khu vực.');
      } else {
        setIsOnline(true);
        Alert.alert('Đã BẬT trực tuyến (Vị trí xấp xỉ)', 'Hệ thống sẽ định vị đơn theo khu vực phục vụ của quán.');
      }
    } catch (e) {
      setIsOnline(true);
      Alert.alert('Đã BẬT trực tuyến', 'Sẵn sàng nhận đơn giao.');
    }
  };

  // Shipper bấm nhận đơn giao (Kiểm tra phạm vi 3km từ quán & Tính phí ship 5.000đ/1km)
  const handleAcceptOrder = async (orderId) => {
    if (!isOnline) {
      Alert.alert('Chưa trực tuyến ⚠️', 'Vui lòng nhấn nút "Bắt đầu làm việc" phía trên để bật trực tuyến trước khi nhận đơn!');
      return;
    }

    setActingOrderId(orderId);
    try {
      // 1. Lấy vị trí GPS hiện tại của Shipper
      let shipperCoords = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc && loc.coords) {
            shipperCoords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          }
        }
      } catch (locErr) {
        console.log('GPS không sẵn sàng, sử dụng vị trí ước tính:', locErr.message);
      }

      // Nếu không lấy được GPS (VD chạy web hoặc giả lập), lấy vị trí gần mốc quán (~0.5km)
      if (!shipperCoords) {
        shipperCoords = { lat: storeLandmark.vi_do + 0.003, lng: storeLandmark.kinh_do + 0.003 };
      }

      // 2. Kiểm tra khoảng cách từ Shipper đến Mốc Quán (Phạm vi 3km)
      const distToStore = calculateHaversine(storeLandmark.vi_do, storeLandmark.kinh_do, shipperCoords.lat, shipperCoords.lng);
      if (distToStore !== null && distToStore > (storeLandmark.ban_kinh_phuc_vu_km || 3.0)) {
        Alert.alert(
          'Ngoài phạm vi nhận đơn 🚫',
          `Bạn đang ở cách quán ${distToStore}km (vượt quá bán kính 3km của quán). Shipper chỉ được nhận đơn khi trong phạm vi 3km từ quán (${storeLandmark.dia_chi_quan}). Vui lòng di chuyển lại gần quán!`
        );
        return;
      }

      const res = await acceptOrderDelivery(orderId, shipperCoords);
      if (res.success) {
        const distKm = res.data?.khoang_cach_km || '1.5';
        const fee = res.data?.phi_giao_hang ? res.data.phi_giao_hang.toLocaleString('vi-VN') : '10.000';
        Alert.alert(
          'Nhận đơn thành công! 🚀',
          `Khoảng cách ban đầu tới khách: ${distKm} km\nTiền ship thù lao: +${fee} đ (5.000đ/1km)\nHãy tới quán nhận đồ ăn và giao cho khách!`
        );
        setActiveBottomTab('delivering');
        loadShipperData();
      }
    } catch (err) {
      Alert.alert('Không thể nhận đơn', err.message || 'Đơn hàng này có thể đã được tài xế khác nhận!');
    } finally {
      setActingOrderId(null);
    }
  };

  // Xác nhận đã lấy hàng tại quán (Bước 1 của Stepper)
  const handleConfirmPickedUp = async (orderId) => {
    try {
      const res = await updateOrderStatus(orderId, 'dang_giao', 'Shipper đã lấy đồ ăn tại quán và đang trên đường giao');
      if (res.success) {
        Alert.alert('Đã lấy hàng 🛵', 'Bắt đầu di chuyển tới địa chỉ khách hàng!');
        loadShipperData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể cập nhật trạng thái lấy hàng!');
    }
  };

  // 2. Contextual Camera Permission: Bước 2 hoàn thành giao -> Xin quyền Camera để chụp minh chứng
  const handleInitiateDeliveryCompletion = (order) => {
    setOrderToDeliver(order);
    setShowCameraPermissionModal(true);
  };

  const handleGrantCameraPermission = () => {
    setShowCameraPermissionModal(false);
    setCapturedPhoto(null);
    setCameraModalVisible(true);
  };

  // Giả lập chụp ảnh biên lai/gói hàng
  const handleCapturePhoto = () => {
    setCapturedPhoto('https://images.unsplash.com/photo-1526367790999-0150786686a2?w=500&auto=format&fit=crop&q=60');
  };

  // Hoàn tất giao hàng sau khi đã có minh chứng
  const handleFinalizeDeliveryWithProof = async () => {
    if (!orderToDeliver) return;
    try {
      const res = await updateOrderStatus(orderToDeliver.ma_don_hang, 'da_giao', 'Đã giao thành công kèm ảnh minh chứng biên lai');
      if (res.success) {
        setCameraModalVisible(false);
        Alert.alert(
          'Giao hàng hoàn tất 🎉',
          `Đã ghi nhận giao thành công đơn #${orderToDeliver.ma_don_hang} và thu tiền COD: ${parseFloat(orderToDeliver.tong_tien).toLocaleString('vi-VN')} đ!`
        );
        setOrderToDeliver(null);
        setCapturedPhoto(null);
        loadShipperData();
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể hoàn tất đơn hàng!');
    }
  };

  // Phân loại đơn:
  // Available: 'san_sang_giao' (Đã xong bếp, chưa ai nhận)
  // Delivering: 'dang_giao' (Đơn do shipper này đảm nhận)
  const availableOrders = orders.filter(o => o.trang_thai_don_hang === 'san_sang_giao');
  const myDeliveringOrders = orders.filter(o => 
    (o.trang_thai_don_hang === 'dang_giao' || (o.trang_thai_don_hang === 'san_sang_giao' && o.ma_shipper === currentUser?.id))
  );

  // Render Tab 1: Đơn Chờ Nhận (Available Orders)
  const renderAvailableOrdersTab = () => {
    if (availableOrders.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIcon}>🛵💤</Text>
          </View>
          <Text style={styles.emptyTitle}>Chưa có đơn hàng mới!</Text>
          <Text style={styles.emptySubtitle}>
            Hiện tại quán đang chuẩn bị món ăn hoặc chưa có đơn nào sẵn sàng giao. Vui lòng kéo xuống để làm mới.
          </Text>
          <TouchableOpacity style={styles.emptyRefreshBtn} onPress={handleRefresh}>
            <Text style={styles.emptyRefreshText}>🔄 Quét Đơn Mới</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cardsList}>
        {availableOrders.map(order => {
          const orderDistance = order.khoang_cach_km 
            ? parseFloat(order.khoang_cach_km).toFixed(1) 
            : (1.5 + (order.ma_don_hang % 3) * 0.5).toFixed(1);
          // Đơn giá 5.000đ mỗi 1km khoảng cách
          const shipperFee = order.phi_giao_hang 
            ? parseFloat(order.phi_giao_hang) 
            : Math.max(5000, Math.round(parseFloat(orderDistance) * (storeLandmark?.gia_ship_moi_km || 5000)));
          const codAmount = parseFloat(order.tong_tien || order.tong_thanh_toan || 0);

          return (
            <View key={order.ma_don_hang} style={styles.availableCard}>
              <View style={styles.cardTopRow}>
                <View style={styles.orderPill}>
                  <Text style={styles.orderPillText}>Đơn #{order.ma_don_hang}</Text>
                </View>
                <View style={styles.readyBadge}>
                  <Text style={styles.readyBadgeText}>✅ Bếp đã nấu xong</Text>
                </View>
              </View>

              {/* Thông số khoảng cách & thù lao nổi bật theo yêu cầu */}
              <View style={styles.metricGrid}>
                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>Khoảng cách</Text>
                  <Text style={styles.metricValue}>📍 {orderDistance} km</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>Thù lao (5k/km)</Text>
                  <Text style={[styles.metricValue, { color: '#00897B' }]}>
                    💰 +{shipperFee.toLocaleString('vi-VN')} đ
                  </Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>Thu tiền COD</Text>
                  <Text style={[styles.metricValue, { color: '#E53935' }]}>
                    💵 {codAmount.toLocaleString('vi-VN')} đ
                  </Text>
                </View>
              </View>

              <View style={styles.addressBox}>
                <Text style={styles.addressStoreText}>🏬 Lấy tại: {storeLandmark?.dia_chi_quan || 'Cửa hàng FastFood (504 Đại Lộ Bình Dương)'}</Text>
                <Text style={styles.addressCustomerText}>🎯 Giao tới: {order.dia_chi_giao || order.dia_chi_giao_hang || 'Địa chỉ khách hàng'}</Text>
              </View>

              {/* Nút CTA Nhận đơn ngay */}
              <TouchableOpacity
                style={styles.acceptOrderCtaBtn}
                onPress={() => handleAcceptOrder(order.ma_don_hang)}
                disabled={actingOrderId === order.ma_don_hang}
              >
                {actingOrderId === order.ma_don_hang ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.acceptOrderCtaText}>🛵 NHẬN ĐƠN GIAO NGAY (+{shipperFee.toLocaleString('vi-VN')} đ)</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  // Render Tab 2: Đơn Đang Giao (Active Delivery with Mini-Map, Touch Targets >= 44pt & Stepper Slider)
  const renderDeliveringTab = () => {
    if (myDeliveringOrders.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: '#E0F2F1' }]}>
            <Text style={styles.emptyIcon}>📦✨</Text>
          </View>
          <Text style={styles.emptyTitle}>Không có đơn đang giao!</Text>
          <Text style={styles.emptySubtitle}>
            Bạn chưa nhận đơn hàng nào. Hãy chuyển sang tab "Đơn chờ nhận" để chọn đơn gần bạn nhất.
          </Text>
          <TouchableOpacity 
            style={[styles.emptyRefreshBtn, { backgroundColor: '#00897B' }]} 
            onPress={() => setActiveBottomTab('available')}
          >
            <Text style={styles.emptyRefreshText}>👉 Tìm Đơn Sẵn Sàng</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cardsList}>
        {myDeliveringOrders.map(order => {
          const isAtRestaurant = order.trang_thai_don_hang === 'san_sang_giao';

          return (
            <View key={order.ma_don_hang} style={styles.deliveringCard}>
              {/* 1. Bản Đồ Nhỏ Phía Trên (Interactive Mini-Map Route) */}
              <View style={styles.miniMapContainer}>
                <View style={styles.miniMapHeader}>
                  <Text style={styles.miniMapTitle}>🗺️ LỘ TRÌNH GIAO HÀNG TRỰC TIẾP</Text>
                  <Text style={styles.miniMapEta}>Dự kiến: 12 phút (2.4 km)</Text>
                </View>

                {/* Giả lập lộ trình trên bản đồ với Quán - Shipper Bike - Khách hàng */}
                <View style={styles.mockMapCanvas}>
                  <View style={styles.mapRoadLine} />
                  <View style={styles.storePin}>
                    <Text style={styles.pinEmoji}>🏬</Text>
                    <Text style={styles.pinLabel}>Quán</Text>
                  </View>

                  <View style={styles.shipperPin}>
                    <Text style={styles.pinEmoji}>🛵</Text>
                    <Text style={styles.pinLabel}>Bạn</Text>
                  </View>

                  <View style={styles.customerPin}>
                    <Text style={styles.pinEmoji}>🏡</Text>
                    <Text style={styles.pinLabel}>Khách</Text>
                  </View>
                </View>
              </View>

              {/* 2. Cụm Thông Tin Khách Hàng & Nút Bấm Nhanh Vùng Chạm Lớn (Touch Target >= 44pt) */}
              <View style={styles.customerActionBox}>
                <View style={styles.customerDetailCol}>
                  <Text style={styles.activeCustomerName}>👤 {order.ten_khach_hang || 'Khách hàng FastFood'}</Text>
                  <Text style={styles.activeCustomerAddress}>📍 {order.dia_chi_giao || '123 Đường Số 5, Thủ Dầu Một'}</Text>
                  <Text style={styles.activeCodText}>💵 Thu hộ COD: {parseFloat(order.tong_tien).toLocaleString('vi-VN')} đ</Text>
                </View>

                {/* Hai nút Gọi điện & Nhắn tin có Touch Area >= 48x48pt */}
                <View style={styles.largeTouchBtnGroup}>
                  <TouchableOpacity
                    style={styles.largePhoneTouchBtn}
                    onPress={() => Linking.openURL(`tel:${order.so_dien_thoai || '0912345678'}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.largeTouchIcon}>📞</Text>
                    <Text style={styles.largeTouchLabel}>Gọi</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.largeSmsTouchBtn}
                    onPress={() => Linking.openURL(`sms:${order.so_dien_thoai || '0912345678'}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.largeTouchIcon}>💬</Text>
                    <Text style={styles.largeTouchLabel}>Nhắn</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. NÚT CTA ĐA BƯỚC (STEPPER) VUỐT ĐỂ XÁC NHẬN (SWIPE TO CONFIRM) */}
              <View style={styles.stepperSection}>
                <Text style={styles.stepperHeading}>
                  {isAtRestaurant ? 'BƯỚC 1: LẤY ĐỒ ĂN TẠI QUÁN' : 'BƯỚC 2: TRAO TẬN TAY KHÁCH HÀNG'}
                </Text>

                {isAtRestaurant ? (
                  <SwipeToConfirmButton
                    color="#EA580C"
                    icon="👉"
                    title="Vuốt để xác nhận: ĐÃ LẤY HÀNG TẠI QUÁN"
                    onConfirm={() => handleConfirmPickedUp(order.ma_don_hang)}
                  />
                ) : (
                  <SwipeToConfirmButton
                    color="#00897B"
                    icon="📸"
                    title="Vuốt để: HOÀN THÀNH & CHỤP MINH CHỨNG"
                    onConfirm={() => handleInitiateDeliveryCompletion(order)}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Render Tab 3: Thu nhập & Thống kê COD
  const renderEarningsTab = () => (
    <ScrollView contentContainerStyle={styles.earningsScroll}>
      <View style={styles.earningsSummaryCard}>
        <Text style={styles.earningsCardTitle}>💰 Thu Nhập Ca Làm Việc</Text>
        <Text style={styles.earningsBigAmount}>
          {((stats.total_delivered || 0) * 25000).toLocaleString('vi-VN')} đ
        </Text>
        <Text style={styles.earningsSubText}>Ước tính 25.000 đ / đơn hoàn tất</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statBoxNumber}>{stats.total_delivered || 0}</Text>
          <Text style={styles.statBoxLabel}>Đơn đã giao thành công</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statBoxNumber, { color: '#E53935' }]}>
            {parseFloat(stats.total_cod || 0).toLocaleString('vi-VN')} đ
          </Text>
          <Text style={styles.statBoxLabel}>Tiền COD đang giữ cần nộp</Text>
        </View>
      </View>
    </ScrollView>
  );

  // Render Tab 4: Hồ sơ Shipper
  const renderProfileTab = () => (
    <ScrollView contentContainerStyle={styles.profileScroll}>
      <View style={styles.shipperProfileHeaderCard}>
        <View style={styles.shipperAvatarBox}>
          <Text style={styles.shipperAvatarEmoji}>🛵</Text>
        </View>
        <Text style={styles.shipperName}>{currentUser?.ho_ten || 'Tài Xế FastFood'}</Text>
        <Text style={styles.shipperPhone}>{currentUser?.so_dien_thoai || '0945678901'}</Text>
        <View style={styles.shipperRatingRow}>
          <Text style={styles.shipperStars}>⭐⭐⭐⭐⭐</Text>
          <Text style={styles.shipperRatingScore}>4.9/5.0 (128 chuyến)</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.exitToHomeBtn}
        onPress={() => navigation.navigate('Profile')}
      >
        <Text style={styles.exitToHomeBtnText}>➔ Mở Hồ Sơ Cá Nhân & Đăng Xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#00695C" />

      {/* Top Header Shipper View */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.shipperAppTitle}>🛵 FASTFOOD SHIPPER</Text>
          <Text style={styles.shipperAppSubtitle}>Hệ Thống Giao Vận Công Nghệ</Text>
        </View>

        {/* Nút Chuyển Đổi Trực Tuyến & Xin Quyền Contextual */}
        <TouchableOpacity
          style={[styles.onlineToggleBtn, isOnline ? styles.onlineBtnActive : styles.onlineBtnInactive]}
          onPress={handleToggleOnlineStatus}
          activeOpacity={0.8}
        >
          <View style={[styles.statusLightDot, isOnline ? styles.lightDotGreen : styles.lightDotRed]} />
          <Text style={styles.onlineToggleText}>
            {isOnline ? 'ĐANG TRỰC TUYẾN' : 'BẮT ĐẦU LÀM VIỆC'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Thân Màn Hình */}
      <View style={styles.mainBody}>
        {loading && !refreshing ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#00897B" />
            <Text style={styles.loaderText}>Đang quét đơn hàng mới...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#00897B']} />}
            contentContainerStyle={styles.scrollContainer}
          >
            {activeBottomTab === 'available' && renderAvailableOrdersTab()}
            {activeBottomTab === 'delivering' && renderDeliveringTab()}
            {activeBottomTab === 'earnings' && renderEarningsTab()}
            {activeBottomTab === 'profile' && renderProfileTab()}
          </ScrollView>
        )}
      </View>

      {/* ========================================================================= */}
      {/* 4 BOTTOM TABS CHUẨN UX: Đơn chờ nhận, Đơn đang giao, Thu nhập, Hồ sơ */}
      {/* ========================================================================= */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'available' && styles.bottomTabActive]}
          onPress={() => setActiveBottomTab('available')}
        >
          <View style={styles.badgeWrap}>
            <Text style={styles.bottomIcon}>📋</Text>
            {availableOrders.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{availableOrders.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomTabLabel, activeBottomTab === 'available' && styles.bottomTabLabelActive]}>
            Chờ nhận
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'delivering' && styles.bottomTabActive]}
          onPress={() => setActiveBottomTab('delivering')}
        >
          <View style={styles.badgeWrap}>
            <Text style={styles.bottomIcon}>🛵</Text>
            {myDeliveringOrders.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: '#EA580C' }]}>
                <Text style={styles.tabBadgeText}>{myDeliveringOrders.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomTabLabel, activeBottomTab === 'delivering' && styles.bottomTabLabelActive]}>
            Đang giao
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'earnings' && styles.bottomTabActive]}
          onPress={() => setActiveBottomTab('earnings')}
        >
          <Text style={styles.bottomIcon}>💰</Text>
          <Text style={[styles.bottomTabLabel, activeBottomTab === 'earnings' && styles.bottomTabLabelActive]}>
            Thu nhập
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, activeBottomTab === 'profile' && styles.bottomTabActive]}
          onPress={() => setActiveBottomTab('profile')}
        >
          <Text style={styles.bottomIcon}>👤</Text>
          <Text style={[styles.bottomTabLabel, activeBottomTab === 'profile' && styles.bottomTabLabelActive]}>
            Hồ sơ
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 1. CONTEXTUAL POP-UP: XIN QUYỀN VỊ TRÍ (LOCATION PERMISSION) */}
      {/* ========================================================================= */}
      <Modal
        visible={showLocationPermissionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLocationPermissionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.permissionPopupCard}>
            <View style={styles.permissionIconCircle}>
              <Text style={styles.permissionIcon}>📍</Text>
            </View>
            <Text style={styles.permissionTitle}>Cho phép truy cập Vị trí</Text>
            <Text style={styles.permissionBody}>
              Để nhận đơn hàng gần bạn và tính khoảng cách chính xác từ quán đến khách hàng, FastFood Shipper cần sử dụng vị trí GPS của thiết bị khi bạn bật trực tuyến.
            </Text>

            <View style={styles.permissionButtonGroup}>
              <TouchableOpacity
                style={styles.cancelPermissionBtn}
                onPress={() => setShowLocationPermissionModal(false)}
              >
                <Text style={styles.cancelPermissionText}>Để sau</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptPermissionBtn}
                onPress={handleGrantLocationPermission}
              >
                <Text style={styles.acceptPermissionText}>Đồng ý cấp quyền</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 2. CONTEXTUAL POP-UP: XIN QUYỀN CAMERA (CAMERA PERMISSION) */}
      {/* ========================================================================= */}
      <Modal
        visible={showCameraPermissionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCameraPermissionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.permissionPopupCard}>
            <View style={[styles.permissionIconCircle, { backgroundColor: '#EDE7F6' }]}>
              <Text style={styles.permissionIcon}>📸</Text>
            </View>
            <Text style={styles.permissionTitle}>Chụp ảnh minh chứng giao hàng</Text>
            <Text style={styles.permissionBody}>
              Ứng dụng cần quyền sử dụng máy ảnh để chụp hình ảnh gói hàng hoặc biên lai đã trao tận tay khách hàng nhằm đảm bảo an toàn đơn hàng và đối soát tiền COD.
            </Text>

            <View style={styles.permissionButtonGroup}>
              <TouchableOpacity
                style={styles.cancelPermissionBtn}
                onPress={() => setShowCameraPermissionModal(false)}
              >
                <Text style={styles.cancelPermissionText}>Để sau</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.acceptPermissionBtn, { backgroundColor: '#6A1B9A' }]}
                onPress={handleGrantCameraPermission}
              >
                <Text style={styles.acceptPermissionText}>Mở Máy Ảnh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. MÀN HÌNH CHỤP ẢNH MINH CHỨNG VỚI KHUNG CANH GÓC BIÊN LAI */}
      {/* ========================================================================= */}
      <Modal
        visible={cameraModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setCameraModalVisible(false)}
      >
        <SafeAreaView style={styles.cameraScreenSafe}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraHeaderTitle}>📸 CHỤP ẢNH MINH CHỨNG GIAO HÀNG</Text>
            <TouchableOpacity onPress={() => setCameraModalVisible(false)}>
              <Text style={styles.cameraCloseBtnText}>✕ Thoát</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.viewFinderContainer}>
            {/* Khung canh góc biên lai/gói hàng chuẩn UI Checklist */}
            <View style={styles.guideFrame}>
              <View style={[styles.cornerGuide, styles.topLeft]} />
              <View style={[styles.cornerGuide, styles.topRight]} />
              <View style={[styles.cornerGuide, styles.bottomLeft]} />
              <View style={[styles.cornerGuide, styles.bottomRight]} />

              {capturedPhoto ? (
                <View style={styles.capturedPhotoPreview}>
                  <Text style={styles.capturedEmoji}>🧾📦</Text>
                  <Text style={styles.capturedSuccessText}>Đã chụp minh chứng gói hàng & biên lai!</Text>
                </View>
              ) : (
                <View style={styles.aimCenter}>
                  <Text style={styles.aimInstruction}>Canh biên lai hoặc đồ ăn vào giữa khung hình</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.cameraFooter}>
            {!capturedPhoto ? (
              <TouchableOpacity style={styles.shutterButton} onPress={handleCapturePhoto}>
                <View style={styles.shutterInnerCircle} />
              </TouchableOpacity>
            ) : (
              <View style={styles.afterCaptureActions}>
                <TouchableOpacity 
                  style={styles.retakeBtn} 
                  onPress={() => setCapturedPhoto(null)}
                >
                  <Text style={styles.retakeBtnText}>🔄 Chụp lại</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.confirmFinalDeliveryBtn}
                  onPress={handleFinalizeDeliveryWithProof}
                >
                  <Text style={styles.confirmFinalDeliveryText}>✅ Xác nhận & Thu COD</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#004D40',
  },
  topHeader: {
    backgroundColor: '#00897B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#00796B',
  },
  shipperAppTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  shipperAppSubtitle: {
    color: '#E0F2F1',
    fontSize: 12,
    marginTop: 2,
  },
  onlineToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 40,
  },
  onlineBtnActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  onlineBtnInactive: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1.5,
    borderColor: '#EF5350',
  },
  statusLightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  lightDotGreen: {
    backgroundColor: '#2E7D32',
  },
  lightDotRed: {
    backgroundColor: '#C62828',
  },
  onlineToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  mainBody: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    padding: 14,
    paddingBottom: 24,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  cardsList: {
    gap: 14,
  },
  availableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderPillText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  readyBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  readyBadgeText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#CBD5E1',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  addressBox: {
    marginBottom: 14,
    gap: 4,
  },
  addressStoreText: {
    fontSize: 13,
    color: '#475569',
  },
  addressCustomerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  acceptOrderCtaBtn: {
    backgroundColor: '#00897B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  acceptOrderCtaText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  deliveringCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  miniMapContainer: {
    height: 160,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    padding: 10,
  },
  miniMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
  },
  miniMapTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00897B',
  },
  miniMapEta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  mockMapCanvas: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  mapRoadLine: {
    height: 6,
    backgroundColor: '#00897B',
    borderRadius: 3,
    marginHorizontal: 30,
  },
  storePin: {
    position: 'absolute',
    left: 20,
    alignItems: 'center',
  },
  shipperPin: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -15 }],
    alignItems: 'center',
  },
  customerPin: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
  },
  pinEmoji: {
    fontSize: 22,
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
    borderRadius: 4,
    marginTop: 2,
  },
  customerActionBox: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  customerDetailCol: {
    flex: 1,
  },
  activeCustomerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeCustomerAddress: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  activeCodText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 4,
  },
  largeTouchBtnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  largePhoneTouchBtn: {
    width: 50,
    height: 50, // Touch target chuẩn >= 44pt
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeSmsTouchBtn: {
    width: 50,
    height: 50, // Touch target chuẩn >= 44pt
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeTouchIcon: {
    fontSize: 18,
  },
  largeTouchLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
  },
  stepperSection: {
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  stepperHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  swipeTrack: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  swipeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.18,
  },
  swipeTrackText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    paddingHorizontal: 56,
  },
  swipeThumb: {
    position: 'absolute',
    left: 2,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00897B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  swipeThumbIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 42,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyRefreshBtn: {
    backgroundColor: '#00897B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  emptyRefreshText: {
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
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  bottomTabActive: {
    borderTopWidth: 3,
    borderTopColor: '#00897B',
  },
  badgeWrap: {
    position: 'relative',
  },
  bottomIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#00897B',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  bottomTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  bottomTabLabelActive: {
    color: '#00897B',
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  permissionPopupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  permissionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  permissionIcon: {
    fontSize: 32,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  permissionButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelPermissionBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  cancelPermissionText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  acceptPermissionBtn: {
    flex: 1,
    backgroundColor: '#00897B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  acceptPermissionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  cameraScreenSafe: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
  },
  cameraHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cameraCloseBtnText: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  viewFinderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideFrame: {
    width: SCREEN_WIDTH - 60,
    height: SCREEN_WIDTH * 0.9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerGuide: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#00E676',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  aimCenter: {
    padding: 20,
  },
  aimInstruction: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  capturedPhotoPreview: {
    alignItems: 'center',
    padding: 20,
  },
  capturedEmoji: {
    fontSize: 50,
    marginBottom: 8,
  },
  capturedSuccessText: {
    color: '#00E676',
    fontWeight: '800',
    fontSize: 15,
  },
  cameraFooter: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00897B',
  },
  afterCaptureActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retakeBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  confirmFinalDeliveryBtn: {
    flex: 2,
    backgroundColor: '#00897B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmFinalDeliveryText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  earningsScroll: {
    padding: 16,
  },
  earningsSummaryCard: {
    backgroundColor: '#00897B',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  earningsCardTitle: {
    color: '#E0F2F1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  earningsBigAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 6,
  },
  earningsSubText: {
    color: '#B2DFDB',
    fontSize: 12,
  },
  statsGrid: {
    gap: 12,
  },
  statBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statBoxNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  statBoxLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  profileScroll: {
    padding: 16,
  },
  shipperProfileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  shipperAvatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  shipperAvatarEmoji: {
    fontSize: 40,
  },
  shipperName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  shipperPhone: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  shipperRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  shipperStars: {
    fontSize: 14,
  },
  shipperRatingScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  exitToHomeBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  exitToHomeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
