import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import OrdersListScreen from '../screens/OrdersListScreen';
import LoginScreen from '../screens/LoginScreen';
import CustomNutritionScreen from '../screens/CustomNutritionScreen';
import PaymentScreen from '../screens/PaymentScreen';

const Stack = createStackNavigator();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#00A896' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        cardStyle: { backgroundColor: '#F7F9FA' },
      }}
    >
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
        name="OrdersList" 
        component={OrdersListScreen} 
        options={{ title: 'Lịch Sử Đơn Hàng' }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ title: 'Đăng Nhập' }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen} 
        options={{ title: 'Đăng Ký Tài Khoản' }}
      />
    </Stack.Navigator>
  );
}
