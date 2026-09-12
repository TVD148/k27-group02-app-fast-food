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
import { registerUser } from '../services/api';

export default function RegisterScreen({ navigation }) {
  const [hoTen, setHoTen] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Trạng thái Error States theo chuẩn Checklist.design
  const [errors, setErrors] = useState({
    hoTen: '',
    email: '',
    phone: '',
    password: '',
  });

  const validateForm = () => {
    let isValid = true;
    const newErrors = { hoTen: '', email: '', phone: '', password: '' };

    if (!hoTen.trim()) {
      newErrors.hoTen = 'Họ và tên không được để trống!';
      isValid = false;
    }

    if (!email.trim() && !phone.trim()) {
      newErrors.email = 'Vui lòng nhập Email hoặc Số điện thoại!';
      newErrors.phone = 'Vui lòng nhập Email hoặc Số điện thoại!';
      isValid = false;
    } else {
      if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
        newErrors.email = 'Địa chỉ email không đúng định dạng!';
        isValid = false;
      }
      if (phone.trim() && !/^[0-9]{9,11}$/.test(phone.trim())) {
        newErrors.phone = 'Số điện thoại phải từ 9-11 chữ số!';
        isValid = false;
      }
    }

    if (!password) {
      newErrors.password = 'Vui lòng tạo mật khẩu!';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự!';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await registerUser(hoTen.trim(), email.trim(), password, phone.trim(), '');
      if (response.success) {
        Alert.alert(
          'Đăng ký thành công 🎉',
          'Tài khoản của bạn đã được khởi tạo! Hãy đăng nhập để nhận ưu đãi ngay.',
          [
            { 
              text: 'Đăng nhập ngay', 
              onPress: () => navigation.navigate('Login') 
            }
          ]
        );
      } else {
        Alert.alert('Đăng ký thất bại', response.message || 'Có lỗi xảy ra trong quá trình đăng ký!');
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Đăng ký tài khoản thất bại, vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialRegister = (platformName) => {
    Alert.alert(
      `Đăng ký với ${platformName}`,
      `Tính năng đăng ký nhanh qua ${platformName} đang được chuẩn bị phát hành!`,
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
          {/* Header màu Đỏ Đậm Nổi Bật theo Mockup */}
          <View style={styles.redHeaderSection}>
            <Text style={styles.registerTitleText}>Register</Text>
            <Text style={styles.registerSubtitleText}>Tạo tài khoản mới để nhận ngập tràn ưu đãi</Text>
          </View>

          {/* Form Card màu Trắng Bo Tròn bên dưới */}
          <View style={styles.whiteFormCard}>
            {/* Họ và tên */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Họ và tên *</Text>
              <TextInput 
                style={[
                  styles.textInput,
                  errors.hoTen ? styles.inputErrorBorder : null
                ]}
                placeholder="Nhập họ và tên đầy đủ..."
                placeholderTextColor="#94A3B8"
                value={hoTen}
                onChangeText={(text) => {
                  setHoTen(text);
                  if (errors.hoTen) setErrors(prev => ({ ...prev, hoTen: '' }));
                }}
              />
              {errors.hoTen !== '' && (
                <Text style={styles.errorHelperText}>⚠️ {errors.hoTen}</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Địa chỉ Email</Text>
              <TextInput 
                style={[
                  styles.textInput,
                  errors.email ? styles.inputErrorBorder : null
                ]}
                placeholder="Nhập địa chỉ email của bạn..."
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors(prev => ({ ...prev, email: '', phone: '' }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email !== '' && (
                <Text style={styles.errorHelperText}>⚠️ {errors.email}</Text>
              )}
            </View>

            {/* Số điện thoại */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Số điện thoại</Text>
              <TextInput 
                style={[
                  styles.textInput,
                  errors.phone ? styles.inputErrorBorder : null
                ]}
                placeholder="Nhập số điện thoại liên hệ..."
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: '', email: '' }));
                }}
                keyboardType="phone-pad"
              />
              {errors.phone !== '' && (
                <Text style={styles.errorHelperText}>⚠️ {errors.phone}</Text>
              )}
            </View>

            {/* Mật khẩu kèm Nút Eye */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu *</Text>
              <View style={[
                styles.passwordContainer,
                errors.password ? styles.inputErrorBorder : null
              ]}>
                <TextInput 
                  style={styles.passwordInput}
                  placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)..."
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

            {/* Nút Sign Up màu Đỏ Đậm */}
            <TouchableOpacity 
              style={[styles.signUpBtn, loading && styles.btnDisabled]} 
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.signUpBtnText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            {/* Phân cách Social Register */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Hoặc đăng ký nhanh</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Nút Social Register */}
            <View style={styles.socialButtonsRow}>
              <TouchableOpacity 
                style={styles.googleBtn}
                onPress={() => handleSocialRegister('Google')}
                activeOpacity={0.8}
              >
                <Text style={styles.socialIcon}>🇬</Text>
                <Text style={styles.googleBtnText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.appleBtn}
                onPress={() => handleSocialRegister('Apple')}
                activeOpacity={0.8}
              >
                <Text style={styles.socialIcon}>🍎</Text>
                <Text style={styles.appleBtnText}>Apple</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.loginFooterRow}>
              <Text style={styles.footerNormalText}>Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLinkText}>Đăng nhập ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D32F2F',
  },
  scrollContent: {
    flexGrow: 1,
  },
  redHeaderSection: {
    height: 150,
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  registerTitleText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  registerSubtitleText: {
    fontSize: 13,
    color: '#FFCDD2',
    fontWeight: '600',
  },
  whiteFormCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  eyeBtn: {
    paddingHorizontal: 14,
  },
  eyeIcon: {
    fontSize: 18,
  },
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
  signUpBtn: {
    backgroundColor: '#D32F2F',
    borderRadius: 24,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: '#FCA5A5',
  },
  signUpBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
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
    marginBottom: 16,
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
  loginFooterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  footerNormalText: {
    fontSize: 14,
    color: '#64748B',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '700',
  },
});
