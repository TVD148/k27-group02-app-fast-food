import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  SafeAreaView 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!emailOrPhone || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập email/số điện thoại và mật khẩu!');
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser(emailOrPhone, password);
      if (response.success) {
        Alert.alert(
          'Đăng nhập thành công 🎉',
          `Chào mừng ${response.data?.user?.ho_ten || ''} đến với GrabFast!`,
          [
            { 
              text: 'Bắt đầu đặt món', 
              onPress: () => navigation.replace('Home')
            }
          ]
        );
      } else {
        Alert.alert('Thất bại', response.message || 'Sai thông tin đăng nhập!');
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Đăng nhập thất bại, vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header màu Vàng Nổi Bật theo Mockup */}
          <View style={styles.yellowHeaderSection}>
            <Text style={styles.loginTitleText}>Log in</Text>
            <Text style={styles.loginSubtitleText}>Đăng nhập để nhận ngập tràn ưu đãi voucher</Text>
          </View>

          {/* Form Card màu Trắng Bo Tròn bên dưới */}
          <View style={styles.whiteFormCard}>
            <Text style={styles.inputLabel}>Email hoặc Số điện thoại</Text>
            <TextInput 
              style={styles.textInput}
              placeholder="Nhập email hoặc số điện thoại..."
              placeholderTextColor="#9E9E9E"
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.inputLabel}>Mật khẩu</Text>
            <View style={styles.passwordContainer}>
              <TextInput 
                style={styles.passwordInput}
                placeholder="Nhập mật khẩu của bạn..."
                placeholderTextColor="#9E9E9E"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotPassBtn} onPress={() => Alert.alert('Thông báo', 'Vui lòng liên hệ quản trị viên để lấy lại mật khẩu!')}>
              <Text style={styles.forgotPassText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            {/* Nút Sign In màu Đỏ Đậm */}
            <TouchableOpacity 
              style={[styles.signInBtn, loading && styles.btnDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.signInBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerFooterRow}>
              <Text style={styles.footerNormalText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLinkText}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>

            {/* Nút Xem Trang Chủ (Lúc khác) cho Khách */}
            <TouchableOpacity 
              style={styles.browseGuestBtn} 
              onPress={() => navigation.replace('Home')}
            >
              <Text style={styles.browseGuestBtnText}>Để lúc khác ➔ Khám phá Trang Chủ 🍔</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFC107', // Màu vàng rực rỡ theo mockup
  },
  scrollContent: {
    flexGrow: 1,
  },
  yellowHeaderSection: {
    height: 180,
    backgroundColor: '#FFC107',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loginTitleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginBottom: 6,
  },
  loginSubtitleText: {
    fontSize: 13,
    color: '#424242',
    fontWeight: '600',
  },
  whiteFormCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginBottom: 8,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#1A1D1E',
    marginBottom: 12,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#1A1D1E',
  },
  eyeBtn: {
    paddingHorizontal: 14,
  },
  eyeIcon: {
    fontSize: 16,
  },
  forgotPassBtn: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPassText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: 'bold',
  },
  signInBtn: {
    backgroundColor: '#D32F2F', // Màu đỏ nút Sign In
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: '#EF9A9A',
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerFooterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  footerNormalText: {
    fontSize: 14,
    color: '#616161',
  },
  registerLinkText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: 'bold',
  },
  browseGuestBtn: {
    backgroundColor: '#FFF8E1',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  browseGuestBtnText: {
    color: '#F57F17',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
