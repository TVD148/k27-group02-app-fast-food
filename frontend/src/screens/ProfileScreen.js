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
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateUserProfile, fetchUserAddresses } from '../services/api';
import BottomTabBar from '../components/BottomTabBar';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [currentAddress, setCurrentAddress] = useState(null);
  
  // Các state công tắc Switch thông báo chuẩn UX Checklist
  const [orderNotif, setOrderNotif] = useState(true);
  const [promoNotif, setPromoNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // States chỉnh sửa thông tin cá nhân
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

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
        let userObj = JSON.parse(stored);
        setUser(userObj);

        // Lấy địa chỉ mặc định từ Database MySQL
        try {
          const addrRes = await fetchUserAddresses();
          if (addrRes && addrRes.success && Array.isArray(addrRes.data)) {
            const list = addrRes.data;
            if (list.length > 0) {
              const def = list.find(a => a.isDefault) || list[0];
              setCurrentAddress(def);
              if (def && def.address && userObj.dia_chi !== def.address) {
                userObj = { ...userObj, dia_chi: def.address };
                setUser(userObj);
                await AsyncStorage.setItem('user_info', JSON.stringify(userObj));
              }
              return;
            } else {
              setCurrentAddress(null);
              return;
            }
          }
        } catch (dbErr) {
          console.log('Chưa tải địa chỉ DB trong Profile:', dbErr.message);
        }

        const userKey = userObj.ma_nguoi_dung || userObj.id || userObj.so_dien_thoai;
        const storedAddr = (userKey ? await AsyncStorage.getItem(`default_address_${userKey}`) : null) || await AsyncStorage.getItem('default_address');
        if (storedAddr) {
          setCurrentAddress(JSON.parse(storedAddr));
        } else {
          setCurrentAddress(null);
        }
      } else {
        setUser(null);
        setCurrentAddress(null);
      }
    } catch (e) {
      setUser(null);
      setCurrentAddress(null);
    }
  };

  const handleOpenEditProfile = () => {
    if (!user) {
      Alert.alert(
        'Yêu cầu đăng nhập 🔒',
        'Vui lòng đăng nhập tài khoản để chỉnh sửa thông tin cá nhân!',
        [
          { text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') },
          { text: 'Để sau', style: 'cancel' }
        ]
      );
      return;
    }

    setEditName(user.ho_ten || '');
    setEditPhone(user.so_dien_thoai || '');
    setEditEmail(user.email || '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    const cleanName = (editName || '').trim();
    const cleanPhone = (editPhone || '').trim();
    const cleanEmail = (editEmail || '').trim();

    if (!cleanName) {
      Alert.alert('Thiếu thông tin ⚠️', 'Vui lòng nhập họ và tên!');
      return;
    }

    if (!cleanPhone) {
      Alert.alert('Thiếu thông tin ⚠️', 'Vui lòng nhập số điện thoại!');
      return;
    }

    const phoneRegex = /^0[0-9]{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert('Số điện thoại không hợp lệ ⚠️', 'Vui lòng nhập đúng 10 chữ số (ví dụ: 0912345678)!');
      return;
    }

    setUpdatingProfile(true);
    try {
      const response = await updateUserProfile(cleanName, cleanPhone, cleanEmail);
      if (response && response.success) {
        setUser(response.data);
        setEditModalVisible(false);
        Alert.alert('Thành công 🎉', 'Đã cập nhật thông tin cá nhân thành công!');
      }
    } catch (error) {
      Alert.alert('Lỗi cập nhật ⚠️', error.message || 'Không thể lưu thay đổi!');
    } finally {
      setUpdatingProfile(false);
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
            await AsyncStorage.removeItem('default_address');
            setUser(null);
            setCurrentAddress(null);
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
      ]
    },
    {
      title: 'Hỗ trợ & Ứng dụng',
      items: [
        { 
          icon: '📞', 
          label: 'Trung tâm hỗ trợ khách hàng', 
          desc: 'Hotline 1900 8888 (24/7)', 
          action: () => Alert.alert('Hỗ trợ CSKH 📞', 'Hotline hỗ trợ: 1900 8888\nEmail: cskh@fastfood.com\nPhục vụ 24/7 giải đáp mọi thắc mắc đơn hàng.') 
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
          {/* 1. Header Hồ Sơ & Avatar (Chạm vào để sửa tên, SĐT, Email) */}
          <TouchableOpacity 
            style={styles.profileHeaderCard}
            activeOpacity={user ? 0.85 : 1}
            onPress={user ? handleOpenEditProfile : undefined}
          >
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>{user ? '🧑‍🍳' : '👤'}</Text>
              </View>
              {user && (
                <View style={styles.avatarEditIconBadge}>
                  <Text style={{ fontSize: 11 }}>✏️</Text>
                </View>
              )}
              <View style={styles.statusDot} />
            </View>

            {user ? (
              <View style={styles.userInfoBox}>
                <Text style={styles.userName}>{user.ho_ten || 'Khách hàng FastFood'}</Text>
                <Text style={styles.userSubText}>📞 {user.so_dien_thoai} {user.email ? `• ✉️ ${user.email}` : ''}</Text>
                {user.ma_vai_tro && user.ma_vai_tro !== 1 && (
                  <View style={[
                    styles.memberBadge, 
                    user.ma_vai_tro === 3 && { backgroundColor: '#EDE7F6' },
                    user.ma_vai_tro === 2 && { backgroundColor: '#FBE9E7' },
                    user.ma_vai_tro === 4 && { backgroundColor: '#E0F2F1' },
                  ]}>
                    <Text style={[
                      styles.memberBadgeText,
                      user.ma_vai_tro === 3 && { color: '#6A1B9A' },
                      user.ma_vai_tro === 2 && { color: '#D84315' },
                      user.ma_vai_tro === 4 && { color: '#00897B' },
                    ]}>
                      {user.ma_vai_tro === 3 ? '👑 Quản Trị Viên (Admin)' :
                       user.ma_vai_tro === 2 ? '🧑‍🍳 Nhân Viên Quán & Bếp' :
                       user.ma_vai_tro === 4 ? '🛵 Tài Xế Shipper' : ''}
                    </Text>
                  </View>
                )}
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
          </TouchableOpacity>

          {/* 2. CHỨC NĂNG NGHIỆP VỤ CHUYÊN TRÁCH THEO VAI TRÒ (Chỉ hiển thị cho Nhân viên, Shipper, hoặc Admin) */}
          {user && (user.ma_vai_tro === 2 || user.ma_vai_tro === 3 || user.ma_vai_tro === 4) && (
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

                {(user?.ma_vai_tro === 2 || user?.ma_vai_tro === 3) && (
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

        {/* Modal Chỉnh Sửa Thông Tin Cá Nhân (Tên, SĐT, Email) */}
        <Modal
          visible={editModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            if (!updatingProfile) setEditModalVisible(false);
          }}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <View style={styles.editModalCard}>
              <View style={styles.editModalHeader}>
                <View>
                  <Text style={styles.editModalTitle}>Thông Tin Cá Nhân 👤</Text>
                  <Text style={styles.editModalSubtitle}>Cập nhật tên, số điện thoại hoặc email</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setEditModalVisible(false)}
                  disabled={updatingProfile}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {/* Họ và tên */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Họ và tên <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Nhập họ và tên của bạn..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* Số điện thoại */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Số điện thoại <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="Ví dụ: 0912345678 (10 số)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    maxLength={11}
                  />
                </View>

                {/* Email */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="Nhập email nhận hóa đơn..."
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.infoHintBox}>
                  <Text style={styles.infoHintText}>
                    💡 Lưu ý: Tên và Số điện thoại sẽ được tự động điền sẵn khi bạn thêm địa chỉ nhận hàng mới.
                  </Text>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => setEditModalVisible(false)}
                  disabled={updatingProfile}
                >
                  <Text style={styles.cancelBtnText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveBtn, updatingProfile && { opacity: 0.7 }]} 
                  onPress={handleSaveProfile}
                  disabled={updatingProfile}
                >
                  {updatingProfile ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Lưu Thay Đổi</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  avatarEditIconBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00A896',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  userNameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  editProfileTag: {
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B2F5EA',
  },
  editProfileTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00A896',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  editModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
  },
  formGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  requiredMark: {
    color: '#EF4444',
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  infoHintBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  infoHintText: {
    fontSize: 12,
    color: '#0F766E',
    lineHeight: 16,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#00A896',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
