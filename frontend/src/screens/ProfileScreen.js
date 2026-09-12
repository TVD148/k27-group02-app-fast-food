import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert, 
  SafeAreaView, 
  Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomTabBar from '../components/BottomTabBar';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [currentAddress, setCurrentAddress] = useState(null);
  
  // Các state công tắc Switch thông báo chuẩn UX Checklist
  const [orderNotif, setOrderNotif] = useState(true);
  const [promoNotif, setPromoNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserInfo();
    });
    loadUserInfo();
    return unsubscribe;
  }, [navigation]);

  const loadUserInfo = async () => {
    try {
      const stored = await AsyncStorage.getItem('user_info');
      const token = await AsyncStorage.getItem('user_token');
      if (stored && token) {
        setUser(JSON.parse(stored));
      } else {
        setUser(null);
      }

      const storedAddr = await AsyncStorage.getItem('default_address');
      if (storedAddr) {
        setCurrentAddress(JSON.parse(storedAddr));
      }
    } catch (e) {
      setUser(null);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Xác nhận đăng xuất ⚠️',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không?',
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        { 
          text: 'Đăng xuất', 
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('user_token');
            await AsyncStorage.removeItem('user_info');
            setUser(null);
            Alert.alert('Thành công', 'Đã đăng xuất khỏi tài khoản.');
            navigation.navigate('Home');
          }
        }
      ]
    );
  };

  const menuSections = [
    {
      title: 'Tài khoản & Đơn hàng',
      items: [
        { 
          icon: '📋', 
          label: 'Lịch sử đơn hàng', 
          desc: 'Theo dõi tiến trình & đơn đã mua', 
          action: () => navigation.navigate('OrdersList') 
        },
        { 
          icon: '📍', 
          label: 'Sổ địa chỉ nhận hàng', 
          desc: currentAddress ? `${currentAddress.label}: ${currentAddress.address}` : (user?.dia_chi || 'Quản lý & thêm địa chỉ bằng GPS'), 
          action: () => navigation.navigate('Address') 
        },
        { 
          icon: '💳', 
          label: 'Phương thức thanh toán & VietQR', 
          desc: 'Quản lý tài khoản ngân hàng / MoMo', 
          action: () => navigation.navigate('Checkout') 
        },
        { 
          icon: '🥗', 
          label: 'Mục tiêu dinh dưỡng cá nhân', 
          desc: 'Tùy biến hàm lượng Calo, Đạm, Tinh bột', 
          action: () => navigation.navigate('CustomNutrition', { itemId: 1, foodName: 'Burger Bò Cực Hạn' }) 
        },
      ]
    },
    {
      title: 'Hỗ trợ & Ứng dụng',
      items: [
        { 
          icon: '🎁', 
          label: 'Ví Voucher & Ưu đãi', 
          desc: 'Mã giảm giá hấp dẫn dành cho bạn', 
          action: () => navigation.navigate('Checkout') 
        },
        { 
          icon: '📞', 
          label: 'Trung tâm hỗ trợ khách hàng', 
          desc: 'Hotline 1900 8888 (24/7)', 
          action: () => Alert.alert('Hỗ trợ', 'Hotline CSKH Fast Food: 1900 8888\nEmail: cskh@fastfood.com') 
        },
      ]
    }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Hồ Sơ & Cài Đặt Không Có Nút Quay Về (Dùng BottomTabBar) */}
        <View style={styles.screenHeader}>
          <Text style={styles.screenHeaderTitle}>Hồ Sơ & Cài Đặt</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Header Hồ Sơ & Avatar */}
          <View style={styles.profileHeaderCard}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>{user ? '🧑‍🍳' : '👤'}</Text>
              </View>
              <View style={styles.statusDot} />
            </View>

            {user ? (
              <View style={styles.userInfoBox}>
                <Text style={styles.userName}>{user.ho_ten || 'Khách hàng FastFood'}</Text>
                <Text style={styles.userSubText}>{user.email || user.so_dien_thoai || 'Thành viên thân thiết'}</Text>
                <View style={[
                  styles.memberBadge, 
                  user.ma_vai_tro === 3 && { backgroundColor: '#EDE7F6' },
                  (user.ma_vai_tro === 2 || user.ma_vai_tro === 5) && { backgroundColor: '#FBE9E7' },
                  user.ma_vai_tro === 4 && { backgroundColor: '#E0F2F1' },
                ]}>
                  <Text style={[
                    styles.memberBadgeText,
                    user.ma_vai_tro === 3 && { color: '#6A1B9A' },
                    (user.ma_vai_tro === 2 || user.ma_vai_tro === 5) && { color: '#D84315' },
                    user.ma_vai_tro === 4 && { color: '#00897B' },
                  ]}>
                    {user.ma_vai_tro === 3 ? '👑 Quản Trị Viên (Admin)' :
                     (user.ma_vai_tro === 2 || user.ma_vai_tro === 5) ? '🧑‍🍳 Nhân Viên Bếp / Quán' :
                     user.ma_vai_tro === 4 ? '🛵 Tài Xế Shipper' : '⭐ Khách Hàng Thân Thiết'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.userInfoBox}>
                <Text style={styles.userName}>Khách ghé thăm</Text>
                <Text style={styles.userSubText}>Đăng nhập để nhận voucher 30% và tích điểm</Text>
                <TouchableOpacity 
                  style={styles.loginCtaBtn}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.loginCtaText}>Đăng nhập / Đăng ký ngay ➔</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 2. CHỨC NĂNG NGHIỆP VỤ CHUYÊN TRÁCH THEO VAI TRÒ (Chỉ hiển thị cho Nhân viên bếp, Shipper, hoặc Admin) */}
          {user && (user.ma_vai_tro === 2 || user.ma_vai_tro === 3 || user.ma_vai_tro === 4 || user.ma_vai_tro === 5) && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Chức năng nghiệp vụ chuyên trách</Text>
              <View style={styles.menuCard}>
                {user?.ma_vai_tro === 3 && (
                  <TouchableOpacity 
                    style={[styles.menuItemRow, styles.menuItemBorder]}
                    onPress={() => navigation.navigate('Admin')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#EDE7F6' }]}>
                      <Text style={styles.menuIconText}>👑</Text>
                    </View>
                    <View style={styles.menuTextBox}>
                      <Text style={[styles.menuLabel, { color: '#6A1B9A', fontWeight: 'bold' }]}>FastFood Admin Portal</Text>
                      <Text style={styles.menuDesc}>Quản lý món, tùy biến, voucher, nhân sự, doanh thu</Text>
                    </View>
                    <Text style={styles.chevronIcon}>›</Text>
                  </TouchableOpacity>
                )}

                {(user?.ma_vai_tro === 2 || user?.ma_vai_tro === 5 || user?.ma_vai_tro === 3) && (
                  <TouchableOpacity 
                    style={[styles.menuItemRow, user?.ma_vai_tro === 3 ? styles.menuItemBorder : null]}
                    onPress={() => navigation.navigate('StaffKitchen')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#FBE9E7' }]}>
                      <Text style={styles.menuIconText}>🍳</Text>
                    </View>
                    <View style={styles.menuTextBox}>
                      <Text style={[styles.menuLabel, { color: '#D84315', fontWeight: 'bold' }]}>Màn Hình Bếp & Cửa Hàng</Text>
                      <Text style={styles.menuDesc}>Nhận đơn, nấu món, xem dinh dưỡng, báo shipper</Text>
                    </View>
                    <Text style={styles.chevronIcon}>›</Text>
                  </TouchableOpacity>
                )}

                {(user?.ma_vai_tro === 4 || user?.ma_vai_tro === 3) && (
                  <TouchableOpacity 
                    style={styles.menuItemRow}
                    onPress={() => navigation.navigate('Shipper')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#E0F2F1' }]}>
                      <Text style={styles.menuIconText}>🛵</Text>
                    </View>
                    <View style={styles.menuTextBox}>
                      <Text style={[styles.menuLabel, { color: '#00897B', fontWeight: 'bold' }]}>Màn Hình Shipper Giao Hàng</Text>
                      <Text style={styles.menuDesc}>Nhận đơn chờ, gọi khách, thu tiền COD</Text>
                    </View>
                    <Text style={styles.chevronIcon}>›</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* 4. Menu List theo cấu trúc nhóm chuẩn Checklist.design */}
          {menuSections.map((section, sIndex) => (
            <View key={sIndex} style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.menuCard}>
                {section.items.map((item, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={[styles.menuItemRow, index < section.items.length - 1 && styles.menuItemBorder]}
                    onPress={item.action}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuIconCircle}>
                      <Text style={styles.menuIconText}>{item.icon}</Text>
                    </View>
                    <View style={styles.menuTextBox}>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      <Text style={styles.menuDesc} numberOfLines={1}>{item.desc}</Text>
                    </View>
                    <Text style={styles.chevronIcon}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* 3. Cài đặt Cấu hình & Công tắc gạt (Toggle/Switch) */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Cài đặt thông báo & Ứng dụng</Text>
            <View style={styles.menuCard}>
              <View style={[styles.switchRow, styles.menuItemBorder]}>
                <View style={styles.switchTextBox}>
                  <Text style={styles.switchLabel}>🔔 Thông báo tiến trình đơn hàng</Text>
                  <Text style={styles.switchDesc}>Cập nhật khi bếp nhận đơn và shipper giao</Text>
                </View>
                <Switch 
                  value={orderNotif} 
                  onValueChange={setOrderNotif}
                  trackColor={{ false: '#CBD5E1', true: '#00A896' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.switchRow, styles.menuItemBorder]}>
                <View style={styles.switchTextBox}>
                  <Text style={styles.switchLabel}>🏷️ Khuyến mãi & Voucher mới</Text>
                  <Text style={styles.switchDesc}>Nhận thông báo ưu đãi giảm giá độc quyền</Text>
                </View>
                <Switch 
                  value={promoNotif} 
                  onValueChange={setPromoNotif}
                  trackColor={{ false: '#CBD5E1', true: '#00A896' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchTextBox}>
                  <Text style={styles.switchLabel}>🌙 Chế độ ban đêm</Text>
                  <Text style={styles.switchDesc}>Giao diện dịu mắt khi dùng buổi tối</Text>
                </View>
                <Switch 
                  value={darkMode} 
                  onValueChange={setDarkMode}
                  trackColor={{ false: '#CBD5E1', true: '#00A896' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* 4. Nút Đăng xuất Nổi Bật theo yêu cầu */}
          {user && (
            <View style={styles.logoutContainer}>
              <TouchableOpacity 
                style={styles.logoutButton}
                activeOpacity={0.8}
                onPress={handleLogout}
              >
                <Text style={styles.logoutIcon}>🚪</Text>
                <Text style={styles.logoutText}>Đăng xuất tài khoản</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>GrabFast Mobile App • Phiên bản 3.0.1</Text>
          </View>
        </ScrollView>

        {/* 5. Khung Bottom Navigation */}
        <BottomTabBar activeTab="Profile" navigation={navigation} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#00A896',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  screenHeader: {
    backgroundColor: '#00A896',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E0F2F1',
    borderWidth: 2,
    borderColor: '#00A896',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 34,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userInfoBox: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  userSubText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
  },
  memberBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  memberBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  loginCtaBtn: {
    backgroundColor: '#00A896',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  loginCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuIconText: {
    fontSize: 18,
  },
  menuTextBox: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  menuDesc: {
    fontSize: 12,
    color: '#94A3B8',
  },
  chevronIcon: {
    fontSize: 22,
    color: '#CBD5E1',
    fontWeight: '300',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  switchTextBox: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  switchDesc: {
    fontSize: 12,
    color: '#94A3B8',
  },
  logoutContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  versionText: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
