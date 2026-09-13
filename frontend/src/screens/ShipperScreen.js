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

function calculateShippingFee(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return 5000;
  const d = parseFloat(distanceKm);
  if (isNaN(d) || d <= 0) return 5000;
  if (d <= 1.0) return 5000;
  const extraKm = d - 1.0;
  const extra100m = Math.ceil(Math.round(extraKm * 1000) / 100);
  return 5000 + extra100m * 500;
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

    // Tự động quét đơn mới định kỳ mỗi 6 giây khi tài xế đang trực tuyến (Online) và ở tab chờ nhận
    const timer = setInterval(() => {
      if (isOnline && activeBottomTab === 'available') {
        fetchOrders()
          .then(res => {
            if (res && res.success && Array.isArray(res.data)) {
              setOrders(res.data);
            }
          })
          .catch(() => {});
      }
    }, 6000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [navigation, isOnline, activeBottomTab]);

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
        setStats(statsRes.stats || statsRes.data || {});
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

  // 1. Bật / Tắt trạng thái làm việc (Bắt đầu chạy)
  const handleToggleOnlineStatus = () => {
    if (!isOnline) {
      setShowLocationPermissionModal(true);
    } else {
      setIsOnline(false);
      setCurrentLocation(null);
      Alert.alert('Đã tắt nhận đơn ⏸️', 'Bạn đã chuyển sang trạng thái ngoại tuyến. Hãy bấm "Bắt đầu chạy" khi muốn nhận đơn trở lại.');
    }
  };

  // Bắt đầu chạy: Bắt buộc kiểm tra GPS và kiểm tra khoảng cách trong bán kính 3km so với quán
  const handleGrantLocationPermission = async () => {
    setShowLocationPermissionModal(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Yêu cầu bật GPS 📍',
          'Bạn bắt buộc phải cấp quyền vị trí và bật GPS trên thiết bị để hệ thống kiểm tra bạn đang ở trong bán kính 3km so với quán trước khi nhận đơn!'
        );
        setIsOnline(false);
        return;
      }

      let lat = null;
      let lng = null;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (loc && loc.coords) {
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch (locErr) {
        console.log('Lỗi lấy toạ độ GPS:', locErr.message);
      }

      // Fallback nếu chạy trên Web simulator
      if (!lat || !lng) {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
              () => resolve(),
              { timeout: 4000 }
            );
          });
        }
      }

      // Fallback môi trường test web nếu không có GPS phần cứng
      if (!lat || !lng) {
        lat = storeLandmark.vi_do + 0.003;
        lng = storeLandmark.kinh_do + 0.003;
      }

      // Kiểm tra khoảng cách từ Shipper đến quán (Bán kính phục vụ 3km)
      const distToStore = calculateHaversine(storeLandmark.vi_do, storeLandmark.kinh_do, lat, lng);
      const maxRadius = storeLandmark.ban_kinh_phuc_vu_km || 3.0;

      if (distToStore !== null && distToStore > maxRadius) {
        Alert.alert(
          'Ngoài bán kính nhận đơn 🚫',
          `Bạn đang ở cách quán ${distToStore} km (vượt quá bán kính ${maxRadius} km của quán).\nQuán chỉ cho phép các tài xế trong bán kính 3km quanh quán nhận đơn. Vui lòng di chuyển lại gần quán hơn để bắt đầu chạy!`
        );
        setIsOnline(false);
        setCurrentLocation(null);
        return;
      }

      setCurrentLocation({ lat, lng });
      setIsOnline(true);
      Alert.alert(
        'ĐÃ BẮT ĐẦU CHẠY! 🟢',
        `Định vị GPS thành công!\nKhoảng cách tới quán: ${distToStore || 0.5} km (Hợp lệ trong 3km).\nBạn đã sẵn sàng nhận các cuốc đơn mới quanh khu vực!`
      );
      loadShipperData();
    } catch (e) {
      Alert.alert('Lỗi định vị', 'Không thể kích hoạt GPS: ' + (e.message || 'Vui lòng kiểm tra cài đặt vị trí'));
      setIsOnline(false);
    }
  };

  // Shipper bấm nhận đơn giao (Cạnh tranh: Ai nhanh tay bấm nhận trước sẽ được)
  const handleAcceptOrder = async (orderId) => {
    if (!isOnline) {
      Alert.alert(
        'Chưa bắt đầu chạy ⚠️',
        'Vui lòng nhấn nút "Bắt đầu chạy" phía trên để bật GPS và kiểm tra vị trí trong 3km trước khi nhận đơn!'
      );
      return;
    }

    setActingOrderId(orderId);
    try {
      // 1. Lấy vị trí GPS thực tế
      let shipperCoords = currentLocation;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc && loc.coords) {
            shipperCoords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
            setCurrentLocation(shipperCoords);
          }
        }
      } catch (locErr) {
        console.log('GPS kiểm tra lại:', locErr.message);
      }

      if (!shipperCoords) {
        shipperCoords = { lat: storeLandmark.vi_do + 0.003, lng: storeLandmark.kinh_do + 0.003 };
      }

      // 2. Kiểm tra lại khoảng cách từ Shipper đến Quán
      const distToStore = calculateHaversine(storeLandmark.vi_do, storeLandmark.kinh_do, shipperCoords.lat, shipperCoords.lng);
      if (distToStore !== null && distToStore > (storeLandmark.ban_kinh_phuc_vu_km || 3.0)) {
        Alert.alert(
          'Ngoài phạm vi nhận đơn 🚫',
          `Bạn đang ở cách quán ${distToStore} km (vượt quá bán kính 3km của quán). Shipper chỉ được nhận đơn khi trong phạm vi 3km từ quán!`
        );
        setIsOnline(false);
        return;
      }

      // 3. Gửi yêu cầu nhận đơn lên Backend (Cơ chế Atomic Update)
      const res = await acceptOrderDelivery(orderId, shipperCoords);
      if (res.success) {
        const distKm = res.data?.khoang_cach_km || '1.0';
        const fee = res.data?.phi_giao_hang ? res.data.phi_giao_hang.toLocaleString('vi-VN') : '5.000';
        Alert.alert(
          'Nhận đơn thành công! 🚀',
          `Bạn đã nhận đơn #${orderId} thành công!\nKhoảng cách từ quán tới khách: ${distKm} km\nThù lao ship: +${fee} đ\nHãy di chuyển tới quán nhận đồ ăn và giao cho khách!`
        );
        setActiveBottomTab('delivering');
        loadShipperData();
      }
    } catch (err) {
      // Báo lỗi khi tài xế khác nhanh tay hơn nhận mất
      Alert.alert(
        'Đơn đã có người nhận',
        err.message || 'Rất tiếc! Đơn hàng này vừa được tài xế khác nhanh tay nhận trước!'
      );
      loadShipperData();
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
    // Nếu Shipper chưa bật GPS & chưa bắt đầu chạy
    if (!isOnline) {
      return (
        <View style={styles.offlineBoxContainer}>
          <View style={styles.offlineCircle}>
            <Text style={styles.offlineBigEmoji}>🛵📍</Text>
          </View>
          <Text style={styles.offlineCardTitle}>BẠN ĐANG NGOẠI TUYẾN</Text>
          <Text style={styles.offlineCardDesc}>
            Để nhận đơn giao, bạn cần bật định vị GPS và nhấn nút "Bắt đầu chạy" bên dưới. Hệ thống sẽ kiểm tra bạn đang ở trong bán kính 3km của quán ({storeLandmark?.dia_chi_quan || '504 Đại lộ Bình Dương'}) trước khi hiển thị đơn.
          </Text>
          <TouchableOpacity 
            style={styles.startRunBtn} 
            onPress={handleToggleOnlineStatus}
            activeOpacity={0.85}
          >
            <Text style={styles.startRunBtnText}>🟢 BẬT GPS & BẮT ĐẦU CHẠY</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const distToStoreCurrent = currentLocation 
      ? calculateHaversine(storeLandmark.vi_do, storeLandmark.kinh_do, currentLocation.lat, currentLocation.lng)
      : null;

    if (availableOrders.length === 0) {
      return (
        <View>
          {/* Thanh trạng thái GPS trực tuyến */}
          <View style={styles.onlineInfoBar}>
            <View style={styles.onlineInfoLeft}>
              <View style={styles.liveGreenDot} />
              <View>
                <Text style={styles.onlineInfoTitle}>🟢 ĐÃ BẬT GPS • SẴN SÀNG NHẬN ĐƠN</Text>
                <Text style={styles.onlineInfoSub}>
                  {distToStoreCurrent !== null ? `Cách quán: ${distToStoreCurrent} km (Trong bán kính 3km)` : 'Vị trí hợp lệ quanh quán'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.quickScanBtn} onPress={handleRefresh}>
              <Text style={styles.quickScanBtnText}>🔄 Quét</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>🛵💤</Text>
            </View>
            <Text style={styles.emptyTitle}>Đang chờ đơn hàng từ bếp...</Text>
            <Text style={styles.emptySubtitle}>
              Hệ thống tự động quét đơn mới trong phạm vi 3km mỗi vài giây. Khi bếp nấu xong đơn sẽ xuất hiện ngay tại đây.
            </Text>
            <TouchableOpacity style={styles.emptyRefreshBtn} onPress={handleRefresh}>
              <Text style={styles.emptyRefreshText}>🔄 Quét Đơn Mới</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.cardsList}>
        {/* Thanh trạng thái GPS trực tuyến */}
        <View style={styles.onlineInfoBar}>
          <View style={styles.onlineInfoLeft}>
            <View style={styles.liveGreenDot} />
            <View>
              <Text style={styles.onlineInfoTitle}>🟢 ĐÃ BẬT GPS • SẴN SÀNG NHẬN ĐƠN</Text>
              <Text style={styles.onlineInfoSub}>
                {distToStoreCurrent !== null ? `Cách quán: ${distToStoreCurrent} km (Hợp lệ trong 3km)` : 'Vị trí hợp lệ quanh quán'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.quickScanBtn} onPress={handleRefresh}>
            <Text style={styles.quickScanBtnText}>🔄 Quét</Text>
          </TouchableOpacity>
        </View>

        {availableOrders.map(order => {
          const orderDistance = order.khoang_cach_km 
            ? parseFloat(order.khoang_cach_km).toFixed(1) 
            : (1.0 + (order.ma_don_hang % 3) * 0.5).toFixed(1);
          // Đơn giá: < 1km = 5.000đ, từ 1km trở đi: +5.000đ/1km (+500đ/100m)
          const shipperFee = order.phi_giao_hang 
            ? parseFloat(order.phi_giao_hang) 
            : calculateShippingFee(orderDistance);
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

              {/* Huy hiệu cạnh tranh */}
              <View style={styles.competitiveBadge}>
                <Text style={styles.competitiveBadgeText}>⚡ Ai nhanh tay bấm nhận trước sẽ được đi giao đơn này!</Text>
              </View>

              {/* Thông số khoảng cách & thù lao nổi bật theo yêu cầu */}
              <View style={styles.metricGrid}>
                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>Từ quán tới khách</Text>
                  <Text style={styles.metricValue}>📍 {orderDistance} km</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>Thù lao ship</Text>
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

              {/* Huy hiệu cạnh tranh */}
              <View style={styles.competitiveBadge}>
                <Text style={styles.competitiveBadgeText}>⚡ Ai nhanh tay bấm nhận trước sẽ được đi giao đơn này!</Text>
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

  // Helper to format date YYYY-MM-DD -> DD/MM/YYYY
  const formatDateVN = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = String(dateStr).split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Render Tab 3: Thu nhập & Thống kê theo ngày + Tổng thu nhập
  const renderEarningsTab = () => {
    const todayStr = getTodayDateString();
    const totalEarnings = stats.total_shipping_earnings !== undefined 
      ? Number(stats.total_shipping_earnings) 
      : ((stats.total_delivered || 0) * 25000);
    const todayEarnings = stats.today_shipping_earnings !== undefined
      ? Number(stats.today_shipping_earnings)
      : 0;
    const dailyList = Array.isArray(stats.daily_earnings) ? stats.daily_earnings : [];

    return (
      <ScrollView contentContainerStyle={styles.earningsScroll} showsVerticalScrollIndicator={false}>
        {/* Thẻ Tổng Thu Nhập Tích Lũy */}
        <View style={styles.earningsSummaryCard}>
          <Text style={styles.earningsCardTitle}>🏆 TỔNG THU NHẬP TÍCH LŨY</Text>
          <Text style={styles.earningsBigAmount}>
            {totalEarnings.toLocaleString('vi-VN')} đ
          </Text>
          <Text style={styles.earningsSubText}>
            Tổng tiền công ship tích lũy từ các đơn đã giao thành công
          </Text>

          {/* Hàng chỉ số phụ: Hôm nay vs Tổng đơn */}
          <View style={styles.summaryMiniGrid}>
            <View style={styles.summaryMiniCol}>
              <Text style={styles.summaryMiniLabel}>Hôm nay kiếm được</Text>
              <Text style={styles.summaryMiniVal}>
                {todayEarnings.toLocaleString('vi-VN')} đ
              </Text>
              <Text style={styles.summaryMiniSub}>({stats.today_delivered || 0} đơn hoàn thành)</Text>
            </View>
            <View style={styles.summaryMiniDivider} />
            <View style={styles.summaryMiniCol}>
              <Text style={styles.summaryMiniLabel}>Tổng đơn đã giao</Text>
              <Text style={styles.summaryMiniVal}>{stats.total_delivered || 0} đơn</Text>
              <Text style={styles.summaryMiniSub}>Giao tận tay thành công</Text>
            </View>
          </View>
        </View>

        {/* Thẻ tiền COD đang giữ */}
        <View style={styles.statBoxCod}>
          <View style={styles.statBoxCodHeader}>
            <Text style={styles.statBoxCodIcon}>💼</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.statBoxLabel}>Tiền mặt COD đang giữ (cần nộp quán)</Text>
              <Text style={styles.statBoxNumberCod}>
                {parseFloat(stats.total_cod || 0).toLocaleString('vi-VN')} đ
              </Text>
            </View>
          </View>
          <Text style={styles.statBoxCodHint}>
            Tiền mặt thu trực tiếp từ khách của các đơn tiền mặt thành công
          </Text>
        </View>

        {/* Thống kê thu nhập theo từng ngày */}
        <View style={styles.dailySectionCard}>
          <View style={styles.dailyHeaderRow}>
            <Text style={styles.dailySectionTitle}>📅 THU NHẬP THEO TỪNG NGÀY</Text>
            <TouchableOpacity style={styles.dailyRefreshBtn} onPress={handleRefresh} activeOpacity={0.7}>
              <Text style={styles.dailyRefreshText}>🔄 Làm mới</Text>
            </TouchableOpacity>
          </View>

          {dailyList.length === 0 ? (
            <View style={styles.dailyEmptyBox}>
              <Text style={styles.dailyEmptyIcon}>📊</Text>
              <Text style={styles.dailyEmptyTitle}>Chưa có lịch sử thu nhập theo ngày</Text>
              <Text style={styles.dailyEmptySub}>
                Sau khi hoàn tất đơn hàng giao thành công, thu nhập chi tiết từng ngày sẽ tự động được ghi nhận tại đây!
              </Text>
            </View>
          ) : (
            <View style={styles.dailyListWrap}>
              {dailyList.map((item, index) => {
                const isToday = item.ngay === todayStr;
                const formattedDate = formatDateVN(item.ngay);
                const shipFee = Number(item.thu_nhap_ship || 0);
                const codAmount = Number(item.cod_thu_ho || 0);
                const orderCount = Number(item.so_don || 0);

                return (
                  <View 
                    key={item.ngay || index} 
                    style={[styles.dailyItemCard, isToday && styles.dailyItemToday]}
                  >
                    <View style={styles.dailyItemTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.dailyItemDate}>🗓️ Ngày {formattedDate}</Text>
                        {isToday && (
                          <View style={styles.todayPill}>
                            <Text style={styles.todayPillText}>Hôm nay</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.dailyItemOrdersCount}>{orderCount} đơn</Text>
                    </View>

                    <View style={styles.dailyMetricRow}>
                      <View style={styles.dailyMetricCol}>
                        <Text style={styles.dailyMetricLabel}>Tiền công ship nhận:</Text>
                        <Text style={styles.dailyMetricValueGreen}>
                          +{shipFee.toLocaleString('vi-VN')} đ
                        </Text>
                      </View>

                      {codAmount > 0 && (
                        <View style={[styles.dailyMetricCol, { alignItems: 'flex-end' }]}>
                          <Text style={styles.dailyMetricLabel}>COD thu hộ:</Text>
                          <Text style={styles.dailyMetricValueCod}>
                            {codAmount.toLocaleString('vi-VN')} đ
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

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

        {/* Nút Chuyển Đổi Trực Tuyến & Bắt đầu chạy */}
        <TouchableOpacity
          style={[styles.onlineToggleBtn, isOnline ? styles.onlineBtnActive : styles.onlineBtnInactive]}
          onPress={handleToggleOnlineStatus}
          activeOpacity={0.8}
        >
          <View style={[styles.statusLightDot, isOnline ? styles.lightDotGreen : styles.lightDotRed]} />
          <Text style={styles.onlineToggleText}>
            {isOnline ? '🟢 ĐANG CHẠY' : '▶ BẮT ĐẦU CHẠY'}
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

  // Offline Container (Shipper chưa bật GPS & chạy)
  offlineBoxContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginVertical: 12,
  },
  offlineCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  offlineBigEmoji: {
    fontSize: 42,
  },
  offlineCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#B45309',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  offlineCardDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  startRunBtn: {
    backgroundColor: '#00897B',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#00897B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  startRunBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  // Online GPS Status Bar
  onlineInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  onlineInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  liveGreenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  onlineInfoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  onlineInfoSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
  },
  quickScanBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickScanBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Competitive badge on available orders
  competitiveBadge: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  competitiveBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    textAlign: 'center',
  },

  // Earnings Summary Cards
  summaryMiniGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  summaryMiniCol: {
    alignItems: 'center',
    flex: 1,
  },
  summaryMiniLabel: {
    fontSize: 11,
    color: '#E0F2F1',
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryMiniVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  summaryMiniSub: {
    fontSize: 10,
    color: '#B2DFDB',
    marginTop: 2,
  },
  summaryMiniDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },

  // COD Box
  statBoxCod: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECDD3',
    marginBottom: 16,
  },
  statBoxCodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statBoxCodIcon: {
    fontSize: 28,
  },
  statBoxNumberCod: {
    fontSize: 20,
    fontWeight: '900',
    color: '#E11D48',
    marginTop: 2,
  },
  statBoxCodHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },

  // Daily Section Card
  dailySectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  dailyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dailySectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  dailyRefreshBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dailyRefreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dailyEmptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  dailyEmptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  dailyEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  dailyEmptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  dailyListWrap: {
    gap: 10,
  },
  dailyItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dailyItemToday: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  dailyItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dailyItemDate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  todayPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  dailyItemOrdersCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  dailyMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dailyMetricCol: {
    flex: 1,
  },
  dailyMetricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  dailyMetricValueGreen: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
  },
  dailyMetricValueCod: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
});
