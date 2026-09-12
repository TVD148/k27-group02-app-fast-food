import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import OrdersListScreen from '../screens/OrdersListScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import CustomNutritionScreen from '../screens/CustomNutritionScreen';
import PaymentScreen from '../screens/PaymentScreen';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createStackNavigator();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerStyle: { backgroundColor: '#00A896' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        cardStyle: { backgroundColor: '#F7F9FA' },
      }}
    >
      {/* 1. Màn hình Splash Khởi Động */}
      <Stack.Screen 
        name="Splash" 
        component={SplashScreen} 
        options={{ headerShown: false }}
      />

      {/* 2. Màn hình Onboarding Giới Thiệu (Cho Khách Lần Đầu Tải App) */}
      <Stack.Screen 
        name="Onboarding" 
        component={OnboardingScreen} 
        options={{ headerShown: false }}
      />

      {/* 3. Màn hình Đăng Nhập (Header Vàng) */}
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ headerShown: false }}
      />

      {/* 4. Màn hình Đăng Ký (Header Đỏ) */}
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen} 
        options={{ headerShown: false }}
      />

      {/* 5. Màn hình Trang Chủ & Các Chức Năng Khác */}
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Trang Chủ Fast Food' }}
      />
      <Stack.Screen 
        name="ProductDetail" 
        component={ProductDetailScreen} 
        options={{ title: 'Chi Tiết Món Ăn' }}
      />
      <Stack.Screen 
        name="CustomNutrition" 
        component={CustomNutritionScreen} 
        options={{ title: 'Tùy Biến Dinh Dưỡng 🥗' }}
      />
      <Stack.Screen 
        name="Cart" 
        component={CartScreen} 
        options={{ title: 'Giỏ Hàng Của Tôi' }}
      />
      <Stack.Screen 
        name="Checkout" 
        component={CheckoutScreen} 
        options={{ title: 'Xác Nhận Đặt Hàng' }}
      />
      <Stack.Screen 
        name="Payment" 
        component={PaymentScreen} 
        options={{ title: 'Thanh Toán & Voucher 💳' }}
      />
      <Stack.Screen 
        name="OrderTracking" 
        component={OrderTrackingScreen} 
        options={{ title: 'Theo Dõi Đơn Hàng' }}
      />
      <Stack.Screen 
        name="Search" 
        component={SearchScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'Hồ Sơ & Cài Đặt 👤' }}
      />
      <Stack.Screen 
        name="OrdersList" 
        component={OrdersListScreen} 
        options={{ title: 'Lịch Sử Đơn Hàng' }}
      />
    </Stack.Navigator>
  );
}
