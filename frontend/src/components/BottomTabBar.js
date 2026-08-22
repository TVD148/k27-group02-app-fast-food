import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BottomTabBar({ activeTab, navigation }) {
  const checkAuthAndNavigate = async (targetScreen, featureName) => {
    const token = await AsyncStorage.getItem('user_token');
    if (!token && (targetScreen === 'Cart' || targetScreen === 'OrdersList')) {
      Alert.alert(
        'Yêu cầu đăng nhập 🔒',
        `Bạn cần đăng nhập tài khoản để ${featureName}!`,
        [
          { text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') },
          { text: 'Để sau', style: 'cancel' }
        ]
      );
      return;
    }
    navigation.navigate(targetScreen);
  };

  const handleAccountPress = async () => {
    const token = await AsyncStorage.getItem('user_token');
    if (token) {
      const storedUser = await AsyncStorage.getItem('user_info');
      const user = storedUser ? JSON.parse(storedUser) : {};
      Alert.alert(
        'Thông tin tài khoản 👤',
        `Xin chào: ${user.ho_ten || 'Khách hàng'}\nEmail: ${user.email || 'N/A'}\nSĐT: ${user.so_dien_thoai || 'N/A'}`,
        [
          { text: 'Đóng', style: 'cancel' },
          { 
            text: 'Đăng xuất', 
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.removeItem('user_token');
              await AsyncStorage.removeItem('user_info');
              Alert.alert('Thông báo', 'Đã đăng xuất tài khoản thành công.');
              navigation.navigate('Home');
            }
          }
        ]
      );
    } else {
      navigation.navigate('Login');
    }
  };

  const tabs = [
    { key: 'Home', label: 'Home', icon: '🏠', action: () => navigation.navigate('Home') },
    { key: 'Cart', label: 'Cart', icon: '🛒', action: () => checkAuthAndNavigate('Cart', 'xem giỏ hàng và mua hàng') },
    { key: 'OrdersList', label: 'Orders', icon: '📋', action: () => checkAuthAndNavigate('OrdersList', 'xem lịch sử đơn hàng') },
    { key: 'Account', label: 'Account', icon: '👤', action: handleAccountPress },
  ];

  return (
    <View style={styles.tabBarContainer}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={tab.action}
          >
            <View style={[styles.iconContainer, isActive && styles.activeIconBg]}>
              <Text style={[styles.tabIcon, isActive && styles.activeTabIcon]}>{tab.icon}</Text>
            </View>
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#FFF8F0',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  activeIconBg: {
    backgroundColor: '#FFF3E0',
  },
  tabIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  activeTabIcon: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#FF5722',
    fontWeight: 'bold',
  },
});
