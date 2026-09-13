import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const token = await AsyncStorage.getItem('user_token');
        const userInfoStr = await AsyncStorage.getItem('user_info');
        if (token && userInfoStr) {
          const user = JSON.parse(userInfoStr);
          const userRole = parseInt(user.ma_vai_tro || 1, 10);
          if (userRole === 4) {
            navigation.replace('Shipper');
            return;
          } else if (userRole === 2 || userRole === 5) {
            navigation.replace('StaffKitchen');
            return;
          } else if (userRole === 3) {
            navigation.replace('Admin');
            return;
          } else {
            navigation.replace('Home');
            return;
          }
        }

        const hasSeenOnboarding = await AsyncStorage.getItem('has_seen_onboarding');
        if (hasSeenOnboarding === 'true') {
          navigation.replace('Home');
        } else {
          navigation.replace('Onboarding');
        }
      } catch (e) {
        navigation.replace('Home');
      }
    }, 1600);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Icon Logo vuông màu Đỏ bo góc chứa biểu tượng Burger */}
      <View style={styles.logoSquare}>
        <Text style={styles.logoEmoji}>🍔</Text>
      </View>

      {/* Tên App GrabFast */}
      <Text style={styles.appNameText}>
        <Text style={styles.grabText}>Grab</Text>
        <Text style={styles.fastText}>Fast</Text>
      </Text>
      <Text style={styles.taglineText}>Fast Food & Custom Nutrition</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSquare: {
    width: 90,
    height: 90,
    backgroundColor: '#D32F2F', // Màu đỏ thương hiệu GrabFast
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 20,
  },
  logoEmoji: {
    fontSize: 50,
  },
  appNameText: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  grabText: {
    color: '#D32F2F',
  },
  fastText: {
    color: '#D32F2F',
  },
  taglineText: {
    fontSize: 13,
    color: '#757575',
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.5,
  },
});
