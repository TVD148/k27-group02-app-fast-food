import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  SafeAreaView
} from 'react-native';
import { fetchItemDetail } from '../services/api';

export default function ProductDetailScreen({ route, navigation }) {
  const { itemId } = route.params;
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);

  // Trạng thái lưu trữ các tùy chọn đã chọn
  // Cấu trúc: { [ma_nhom]: [ma_gia_tri_1, ma_gia_tri_2, ...] }
  const [selectedOptions, setSelectedOptions] = useState({});
  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    loadFoodDetail();
  }, [itemId]);

  const loadFoodDetail = async () => {
    try {
      const response = await fetchItemDetail(itemId);
      if (response.success) {
        setFood(response.data);
        setTotalPrice(response.data.gia_ban);
        
        // Khởi tạo các giá trị tùy chọn mặc định (bắt buộc chọn size hoặc vị)
        const initialSelected = {};
        response.data.item_options.forEach(group => {
          if (group.la_bat_buoc && group.values.length > 0) {
            // Mặc định chọn giá trị đầu tiên của nhóm bắt buộc
            initialSelected[group.ma_nhom] = [group.values[0].ma_gia_tri];
          } else {
            initialSelected[group.ma_nhom] = [];
          }
        });
        setSelectedOptions(initialSelected);
        recalculatePrice(response.data.gia_ban, initialSelected, response.data.item_options);
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải chi tiết món ăn!');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Tính toán lại tổng tiền dựa trên các tùy chọn được chọn
  const recalculatePrice = (basePrice, selections, optionGroups) => {
    let extraCost = 0;
    optionGroups.forEach(group => {
      const groupSelections = selections[group.ma_nhom] || [];
      groupSelections.forEach(valId => {
        const optionVal = group.values.find(v => v.ma_gia_tri === valId);
        if (optionVal) {
          extraCost += parseFloat(optionVal.gia_tang_them);
        }
      });
    });
    setTotalPrice(basePrice + extraCost);
  };

  const handleOptionToggle = (group, optionVal) => {
    const groupSelections = selectedOptions[group.ma_nhom] || [];
    let newSelections = [...groupSelections];

    if (group.chon_toi_da === 1) {
      // Nhóm chọn 1 (ví dụ Size, Vị)
      newSelections = [optionVal.ma_gia_tri];
    } else {
      // Nhóm chọn nhiều (ví dụ Topping)
      const index = newSelections.indexOf(optionVal.ma_gia_tri);
      if (index > -1) {
        // Hủy chọn
        newSelections.splice(index, 1);
      } else {
        // Kiểm tra xem đã vượt quá số lượng tối đa cho phép chưa
        if (newSelections.length >= group.chon_toi_da) {
          Alert.alert('Thông báo', `Bạn chỉ được chọn tối đa ${group.chon_toi_da} tùy chọn trong nhóm này!`);
          return;
        }
        newSelections.push(optionVal.ma_gia_tri);
      }
    }

    const updatedSelected = {
      ...selectedOptions,
      [group.ma_nhom]: newSelections
    };
    
    setSelectedOptions(updatedSelected);
    recalculatePrice(food.gia_ban, updatedSelected, food.item_options);
  };

  const handleAddToCart = () => {
    // Chức năng giỏ hàng sẽ phát triển ở Sprint 2.
    // Ở Sprint 1 chỉ hiển thị thông báo mô phỏng thành công
    Alert.alert(
      'Sprint 1 Demo',
      `Đã chọn: ${food.ten_mon}\nTổng tiền: ${totalPrice.toLocaleString('vi-VN')} đ\n\n(Chức năng Giỏ hàng & Thanh toán sẽ hoàn thiện ở Sprint 2 & 3!)`
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF8F00" />
      </View>
    );
  }

  if (!food) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 1. Hình ảnh món ăn */}
        <View style={styles.imageSection}>
          <Text style={styles.foodEmoji}>🍔</Text>
        </View>

        <View style={styles.infoSection}>
          {/* 2. Tên và giá món ăn */}
          <Text style={styles.foodName}>{food.ten_mon}</Text>
          <Text style={styles.categoryName}>{food.ten_danh_muc}</Text>
          <Text style={styles.foodPrice}>{totalPrice.toLocaleString('vi-VN')} đ</Text>
          
          {/* 3. Mô tả món ăn */}
          <Text style={styles.sectionTitle}>Mô tả món ăn</Text>
          <Text style={styles.descriptionText}>{food.mo_ta || 'Món ăn ngon đậm đà hương vị, được chế biến từ nguyên liệu sạch đảm bảo vệ sinh an toàn thực phẩm.'}</Text>
          
          {/* 4. Danh sách tùy chọn (Size, Toppings, Vị) */}
          {food.item_options.map(group => (
            <View key={group.ma_nhom} style={styles.optionGroup}>
              <View style={styles.optionGroupHeader}>
                <Text style={styles.optionGroupTitle}>{group.ten_nhom}</Text>
                {group.la_bat_buoc && <Text style={styles.requiredText}>(Bắt buộc)</Text>}
              </View>
              
              <View style={styles.optionsList}>
                {group.values.map(optionVal => {
                  const isSelected = (selectedOptions[group.ma_nhom] || []).includes(optionVal.ma_gia_tri);
                  return (
                    <TouchableOpacity
                      key={optionVal.ma_gia_tri}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => handleOptionToggle(group, optionVal)}
                    >
                      <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                        {optionVal.ten_gia_tri}
                      </Text>
                      {parseFloat(optionVal.gia_tang_them) > 0 && (
                        <Text style={[styles.optionPrice, isSelected && styles.optionPriceSelected]}>
                          +{parseInt(optionVal.gia_tang_them).toLocaleString('vi-VN')} đ
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 5. Nút Thêm vào giỏ ở cạnh dưới */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>TỔNG CỘNG</Text>
          <Text style={styles.priceValue}>{totalPrice.toLocaleString('vi-VN')} đ</Text>
        </View>
        <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
          <Text style={styles.addToCartButtonText}>Thêm vào giỏ 🛒</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 100, // Tạo khoảng trống cho BottomBar
  },
  imageSection: {
    height: 240,
    backgroundColor: '#FFE0B2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodEmoji: {
    fontSize: 96,
  },
  infoSection: {
    padding: 20,
  },
  foodName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryName: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  foodPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D84315',
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  optionGroup: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
  },
  optionGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionGroupTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  requiredText: {
    color: '#D84315',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  optionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionCard: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionCardSelected: {
    backgroundColor: '#FFE0B2',
    borderColor: '#FF8F00',
  },
  optionName: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  optionNameSelected: {
    color: '#E65100',
    fontWeight: 'bold',
  },
  optionPrice: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  optionPriceSelected: {
    color: '#E65100',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: 'bold',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D84315',
    marginTop: 2,
  },
  addToCartButton: {
    backgroundColor: '#FF8F00',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
