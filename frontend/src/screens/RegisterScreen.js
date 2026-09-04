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
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!hoTen || !password) {
      Alert.alert('Lỗi', 'Vui lòng điền họ tên và mật khẩu!');
      return;
    }

    if (!email && !phone) {
      Alert.alert('Lỗi', 'Vui lòng cung cấp Email hoặc Số điện thoại!');
      return;
    }

    setLoading(true);
    try {
      const response = await registerUser(hoTen, email, password, phone, '');
      if (response.success) {
        Alert.alert(
          'Đăng ký thành công 🎉',
          'Tài khoản của bạn đã được khởi tạo! Hãy đăng nhập để trải nghiệm ngay.',
          [
            { 
              text: 'Đăng nhập ngay', 
              onPress: () => navigation.navigate('Login') 
            }
          ]
        );
      } else {
        Alert.alert('Đăng ký thất bại', response.message || 'Có lỗi xảy ra!');
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Đăng ký tài khoản thất bại!');
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
          {/* Header màu Đỏ Đậm Nổi Bật theo Mockup */}
          <View style={styles.redHeaderSection}>
            <Text style={styles.registerTitleText}>Register</Text>
            <Text style={styles.registerSubtitleText}>Tạo tài khoản mới để đặt món ngon thần tốc</Text>
          </View>

          {/* Form Card màu Trắng Bo Tròn bên dưới */}
          <View style={styles.whiteFormCard}>
            <Text style={styles.inputLabel}>Họ và tên *</Text>
            <TextInput 
              style={styles.textInput}
              placeholder="Nhập họ và tên đầy đủ..."
              placeholderTextColor="#9E9E9E"
              value={hoTen}
              onChangeText={setHoTen}
            />

            <Text style={styles.inputLabel}>Địa chỉ Email</Text>
            <TextInput 
              style={styles.textInput}
              placeholder="Nhập địa chỉ email..."
              placeholderTextColor="#9E9E9E"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <TextInput 
              style={styles.textInput}
              placeholder="Nhập số điện thoại..."
              placeholderTextColor="#9E9E9E"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Mật khẩu *</Text>
            <TextInput 
              style={styles.textInput}
              placeholder="Nhập mật khẩu an toàn..."
              placeholderTextColor="#9E9E9E"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {/* Nút Sign Up màu Đỏ Đậm */}
            <TouchableOpacity 
              style={[styles.signUpBtn, loading && styles.btnDisabled]} 
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.signUpBtnText}>Sign Up</Text>
              )}
            </TouchableOpacity>

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
    backgroundColor: '#D32F2F', // Màu đỏ thương hiệu theo mockup
  },
  scrollContent: {
    flexGrow: 1,
  },
  redHeaderSection: {
    height: 160,
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  registerTitleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
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
    paddingTop: 28,
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
    marginBottom: 6,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1D1E',
    marginBottom: 10,
  },
  signUpBtn: {
    backgroundColor: '#D32F2F',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
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
  signUpBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginFooterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  footerNormalText: {
    fontSize: 14,
    color: '#616161',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: 'bold',
  },
});
