import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

/**
 * Reusable EmptyState Component theo tiêu chuẩn Checklist.design
 * @param {string} icon - Biểu tượng emoji hoặc icon minh họa
 * @param {string} title - Tiêu đề trạng thái rỗng (VD: "Không tìm thấy món ăn nào!")
 * @param {string} description - Đoạn text giải thích chi tiết
 * @param {string} buttonText - Nhãn nút Call-to-Action (CTA)
 * @param {function} onButtonPress - Hàm thực thi khi bấm nút CTA
 */
export default function EmptyState({
  icon = '🔍',
  title = 'Không tìm thấy kết quả nào!',
  description = 'Rất tiếc, chúng tôi không tìm thấy nội dung phù hợp với yêu cầu của bạn.',
  buttonText = 'Khám phá ngay',
  onButtonPress,
  style
}) {
  return (
    <View style={[styles.container, style]}>
      {/* Hình ảnh / Icon minh họa */}
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>

      {/* Tiêu đề & Giải thích */}
      <Text style={styles.titleText}>{title}</Text>
      <Text style={styles.descriptionText}>{description}</Text>

      {/* Nút Call-to-Action */}
      {buttonText && onButtonPress && (
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.8}
          onPress={onButtonPress}
        >
          <Text style={styles.ctaButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  iconText: {
    fontSize: 42,
  },
  titleText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 280,
  },
  ctaButton: {
    backgroundColor: '#00A896',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 22,
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
