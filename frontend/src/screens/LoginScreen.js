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

  // Trạng thái Error State (Viền đỏ, text đỏ) chuẩn Checklist.design
  const [errors, setErrors] = useState({
    emailOrPhone: '',
    password: '',
  });

  const validateForm = () => {
    let isValid = true;
    const newErrors = { emailOrPhone: '', password: '' };

    if (!emailOrPhone.trim()) {
      newErrors.emailOrPhone = 'Vui lòng nhập email hoặc số điện thoại của bạn!';
      isValid = false;
    } else if (emailOrPhone.includes('@') && !/^\S+@\S+\.\S+$/.test(emailOrPhone.trim())) {
      newErrors.emailOrPhone = 'Địa chỉ email không đúng định dạng!';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu đăng nhập!';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Mật khẩu phải có độ dài tối thiểu 6 ký tự!';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser(emailOrPhone.trim(), password);
      if (response.success) {
        Alert.alert(
          'Đăng nhập thành công 🎉',
          `Chào mừng ${response.data?.user?.ho_ten || ''} trở lại với Fast Food!`,
          [
            { 
              text: 'Bắt đầu đặt món', 
              onPress: () => navigation.replace('Home')
            }
          ]
        );
      } else {
        Alert.alert('Đăng nhập thất bại', response.message || 'Tài khoản hoặc mật khẩu không chính xác!');
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể kết nối đến máy chủ, vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (platformName) => {
    Alert.alert(
      `Đăng nhập với ${platformName}`,
      `Tính năng liên kết tài khoản ${platformName} đang được kích hoạt ở bản thử nghiệm!`,
      [{ text: 'Đồng ý' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Header màu Vàng theo Mockup */}
          <View style={styles.yellowHeaderSection}>
            <Text style={styles.loginTitleText}>Log in</Text>
            <Text style={styles.loginSubtitleText}>Chào mừng bạn quay lại hệ thống đặt món nhanh</Text>
          </View>

          {/* 2. Form Card màu Trắng Bo Tròn bên dưới */}
          <View style={styles.whiteFormCard}>
            {/* Trường Email / Số điện thoại */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email hoặc Số điện thoại *</Text>
              <TextInput 
                style={[
                  styles.textInput,
                  errors.emailOrPhone ? styles.inputErrorBorder : null
                ]}
                placeholder="Nhập email hoặc số điện thoại..."
                placeholderTextColor="#94A3B8"
                value={emailOrPhone}
                onChangeText={(text) => {
                  setEmailOrPhone(text);
                  if (errors.emailOrPhone) setErrors(prev => ({ ...prev, emailOrPhone: '' }));
                }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {errors.emailOrPhone !== '' && (
                <Text style={styles.errorHelperText}>⚠️ {errors.emailOrPhone}</Text>
              )}
            </View>

            {/* Trường Mật khẩu có Icon Show/Hide Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu *</Text>
              <View style={[
                styles.passwordContainer,
                errors.password ? styles.inputErrorBorder : null
              ]}>
                <TextInput 
                  style={styles.passwordInput}
                  placeholder="Nhập mật khẩu của bạn..."
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                  }}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)} 
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
                </TouchableOpacity>
              </View>
              {errors.password !== '' && (
                <Text style={styles.errorHelperText}>⚠️ {errors.password}</Text>
              )}
            </View>

            {/* Quên mật khẩu */}
            <TouchableOpacity 
              style={styles.forgotPassBtn} 
              onPress={() => Alert.alert('Quên mật khẩu', 'Vui lòng liên hệ Hotline 1900 8888 để được hỗ trợ đặt lại mật khẩu.')}
            >
              <Text style={styles.forgotPassText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            {/* Nút Đăng Nhập Chính */}
            <TouchableOpacity 
              style={[styles.signInBtn, loading && styles.btnDisabled]} 
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.signInBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Đường phân cách Social Login */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Hoặc tiếp tục với</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Các nút Social Login: Google & Apple */}
            <View style={styles.socialButtonsRow}>
              <TouchableOpacity 
                style={styles.googleBtn}
                onPress={() => handleSocialLogin('Google')}
                activeOpacity={0.8}
              >
                <Text style={styles.socialIcon}>🇬</Text>
                <Text style={styles.googleBtnText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.appleBtn}
                onPress={() => handleSocialLogin('Apple')}
                activeOpacity={0.8}
              >
                <Text style={styles.socialIcon}>🍎</Text>
                <Text style={styles.appleBtnText}>Apple</Text>
              </TouchableOpacity>
            </View>

            {/* Link chuyển sang trang Đăng Ký */}
            <View style={styles.registerFooterRow}>
              <Text style={styles.footerNormalText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLinkText}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>

            {/* Nút Khách Xem Trang Chủ Lúc Khác */}
            <TouchableOpacity 
              style={styles.browseGuestBtn} 
              onPress={() => navigation.replace('Home')}
            >
              <Text style={styles.browseGuestBtnText}>Để lúc khác ➔ Khám phá món ăn 🍔</Text>
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
    backgroundColor: '#FFC107',
  },
  scrollContent: {
    flexGrow: 1,
  },
  yellowHeaderSection: {
    height: 160,
    backgroundColor: '#FFC107',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loginTitleText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  loginSubtitleText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  whiteFormCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    color: '#0F172A',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    color: '#0F172A',
  },
  eyeBtn: {
    paddingHorizontal: 14,
  },
  eyeIcon: {
    fontSize: 18,
  },
  // Error state viền đỏ & text đỏ chuẩn Checklist
  inputErrorBorder: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorHelperText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },
  forgotPassBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPassText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '700',
  },
  signInBtn: {
    backgroundColor: '#D32F2F',
    borderRadius: 24,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: '#FCA5A5',
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  socialButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  googleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
  },
  appleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
  },
  socialIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  appleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  registerFooterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  footerNormalText: {
    fontSize: 14,
    color: '#64748B',
  },
  registerLinkText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '700',
  },
  browseGuestBtn: {
    backgroundColor: '#FFF8E1',
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  browseGuestBtnText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
  },
});
