import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, SafeAreaView } from 'react-native';

/**
 * BottomTabBar Component chuẩn hóa theo Checklist.design:
 * - 4 Tab: Home, Search, Cart, Profile
 * - Trạng thái Active: Màu chủ đạo (#00A896), in đậm
 * - Trạng thái Inactive: Màu xám (#9E9E9E)
 * - Tối ưu SafeArea cho iOS Home Indicator & tai thỏ
 */
export default function BottomTabBar({ activeTab, navigation }) {
  const tabs = [
    { 
      key: 'Home', 
      label: 'Home', 
      icon: '🏠', 
      action: () => navigation.navigate('Home') 
    },
    { 
      key: 'Search', 
      label: 'Search', 
      icon: '🔍', 
      action: () => navigation.navigate('Search') 
    },
    { 
      key: 'Cart', 
      label: 'Cart', 
      icon: '🛒', 
      action: () => navigation.navigate('Cart') 
    },
    { 
      key: 'Profile', 
      label: 'Profile', 
      icon: '👤', 
      action: () => navigation.navigate('Profile') 
    },
  ];

  return (
    <View style={styles.safeContainer}>
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
                <Text style={[styles.tabIcon, isActive && styles.activeTabIcon]}>
                  {tab.icon}
                </Text>
              </View>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 10,
  },
  tabBarContainer: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 76 : 64,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  activeIconBg: {
    backgroundColor: '#E0F2F1', // Nền xanh bạc hà nhạt cho tab đang chọn
  },
  tabIcon: {
    fontSize: 19,
    opacity: 0.5,
  },
  activeTabIcon: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: '#94A3B8', // Màu xám cho Inactive
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#00A896', // Màu chủ đạo của app cho Active
    fontWeight: '700',
  },
});
