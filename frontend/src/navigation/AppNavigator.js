import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import OrdersListScreen from '../screens/OrdersListScreen';

const Stack = createStackNavigator();

// 1. STACK XÁC THỰC (Dành cho người dùng chưa đăng nhập)
export function AuthNavigator({ onLoginSuccess }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#FF8F00' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        cardStyle: { backgroundColor: '#FAF3E0' },
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ title: 'Đăng Nhập' }}
        initialParams={{ onLoginSuccess }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen} 
        options={{ title: 'Đăng Ký' }}
      />
    </Stack.Navigator>
  );
}

// 2. STACK CHÍNH (Dành cho người dùng đã đăng nhập)
export function MainNavigator({ onLogout }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#FF8F00' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        cardStyle: { backgroundColor: '#fff' },
      }}
    >
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Trang Chủ Fast Food' }}
        initialParams={{ onLogout }}
      />
      <Stack.Screen 
        name="ProductDetail" 
        component={ProductDetailScreen} 
        options={{ title: 'Chi Tiết Món Ăn' }}
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
        name="OrderTracking" 
        component={OrderTrackingScreen} 
        options={{ title: 'Theo Dõi Đơn Hàng' }}
      />
      <Stack.Screen 
        name="OrdersList" 
        component={OrdersListScreen} 
        options={{ title: 'Lịch Sử Đơn Hàng' }}
      />
    </Stack.Navigator>
  );
}
