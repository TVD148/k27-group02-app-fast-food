import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Dimensions, 
  SafeAreaView 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    emoji: '🍔',
    badge: 'Fast Food Delivery',
    title: 'Thực Đơn Nóng Hổi & Đa Dạng',
    subtitle: 'Thưởng thức hàng ngàn món ăn ngon lành chuẩn vị Fast Food giao tận nơi chỉ trong ít phút.',
    bgColor: '#FFF8E1'
  },
  {
    id: 2,
    emoji: '🍟',
    badge: 'Killer Feature',
    title: 'Tùy Biến Dinh Dưỡng Chuẩn Gu',
    subtitle: 'Tự do tăng/giảm khẩu phần và theo dõi chỉ số Calo, Protein, Carbs, Fat tức thì theo nhu cầu của bạn.',
    bgColor: '#FFE0B2'
  },
  {
    id: 3,
    emoji: '🍕',
    badge: 'VietQR & Voucher',
    title: 'Thanh Toán Nhanh & Ưu Đãi',
    subtitle: 'Quét mã VietQR chuyển khoản tự động kèm dải mã giảm giá hấp dẫn đang chờ bạn khám phá.',
    bgColor: '#FFCDD2'
  }
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const finishOnboarding = async (targetScreen) => {
    try {
      await AsyncStorage.setItem('has_seen_onboarding', 'true');
    } catch (e) {
      console.log('Không thể lưu trạng thái onboarding');
    }
    navigation.replace(targetScreen);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const slide = SLIDES[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header nút Bỏ qua */}
      <View style={styles.headerRow}>
        {currentIndex < SLIDES.length - 1 ? (
          <TouchableOpacity onPress={() => finishOnboarding('Home')}>
            <Text style={styles.skipText}>Bỏ qua</Text>
          </TouchableOpacity>
        ) : <View />}
      </View>

      {/* 2. Vùng Minh họa Hình ảnh Món Ăn ở Giữa */}
      <View style={styles.illustrationContainer}>
        <View style={[styles.imageCircleBlob, { backgroundColor: slide.bgColor }]}>
          <Text style={styles.foodEmoji}>{slide.emoji}</Text>
        </View>
      </View>

      {/* 3. Vùng Nội dung Tiêu đề & Mô tả */}
      <View style={styles.contentContainer}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{slide.badge}</Text>
        </View>

        <Text style={styles.titleText}>{slide.title}</Text>
        <Text style={styles.subtitleText}>{slide.subtitle}</Text>

        {/* Dải chấm trang (Pagination Dots) */}
        <View style={styles.paginationRow}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index ? styles.activeDot : styles.inactiveDot
              ]}
            />
          ))}
        </View>
      </View>

      {/* 4. Vùng Hành động ở Đáy (Nút Đăng Nhập Ngay / Lúc Khác) */}
      <View style={styles.footerContainer}>
        {currentIndex === SLIDES.length - 1 ? (
          // Ở slide cuối cùng: Hiển thị 2 lựa chọn "Đăng nhập ngay" hoặc "Lúc khác"
          <View style={styles.finalActionBox}>
            <TouchableOpacity 
              style={styles.primaryLoginBtn}
              onPress={() => finishOnboarding('Login')}
            >
              <Text style={styles.primaryLoginBtnText}>Đăng Nhập Ngay 🔐</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryHomeBtn}
              onPress={() => finishOnboarding('Home')}
            >
              <Text style={styles.secondaryHomeBtnText}>Để lúc khác (Vào Trang Chủ) 🍔</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Ở các slide 1 & 2: Hiển thị nút "Tiếp theo"
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>Tiếp theo ➔</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    height: 50,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '600',
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCircleBlob: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: (width * 0.7) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  foodEmoji: {
    fontSize: 100,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  badgeContainer: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: '#D32F2F',
    fontSize: 12,
    fontWeight: 'bold',
  },
  titleText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1D1E',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitleText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#D32F2F', // Màu đỏ chấm chủ đạo
  },
  inactiveDot: {
    width: 8,
    backgroundColor: '#E0E0E0',
  },
  footerContainer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  nextBtn: {
    backgroundColor: '#D32F2F',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  finalActionBox: {
    width: '100%',
  },
  primaryLoginBtn: {
    backgroundColor: '#D32F2F',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryLoginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryHomeBtn: {
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryHomeBtnText: {
    color: '#424242',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
