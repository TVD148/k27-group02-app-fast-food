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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchItemNutrition, calculateNutrition, addToCart } from '../services/api';

export default function CustomNutritionScreen({ route, navigation }) {
  const { itemId, foodName: initialFoodName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [adding, setAdding] = useState(false);

  const [foodData, setFoodData] = useState(null);
  const [recipe, setRecipe] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [nutrition, setNutrition] = useState({
    calo: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    phu_thu_nguyen_lieu: 0,
    gia_sau_tuy_bien: 0
  });

  useEffect(() => {
    loadDefaultRecipe();
  }, [itemId]);

  const loadDefaultRecipe = async () => {
    setLoading(true);
    try {
      const response = await fetchItemNutrition(itemId);
      if (response.success) {
        setFoodData(response.data);
        const recipeList = response.data.cong_thuc_nguyen_lieu || [];
        setRecipe(recipeList);

        // Khởi tạo map số lượng mặc định
        const initialQty = {};
        recipeList.forEach(item => {
          initialQty[item.ma_nguyen_lieu] = parseFloat(item.so_luong_mac_dinh);
        });
        setQuantities(initialQty);

        // Tính toán thông số khởi đầu
        fetchCalculatedNutrition(itemId, initialQty);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tải công thức nguyên liệu!');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalculatedNutrition = async (mId, qtyMap) => {
    setCalculating(true);
    try {
      const payload = Object.keys(qtyMap).map(maNL => ({
        ma_nguyen_lieu: parseInt(maNL),
        so_luong: qtyMap[maNL]
      }));

      const response = await calculateNutrition(mId, payload);
      if (response.success) {
        setNutrition({
          calo: response.data.dinh_duong_tong_hop.calo,
          protein: response.data.dinh_duong_tong_hop.protein,
          carbs: response.data.dinh_duong_tong_hop.carbs,
          fat: response.data.dinh_duong_tong_hop.fat,
          phu_thu_nguyen_lieu: response.data.phu_thu_nguyen_lieu,
          gia_sau_tuy_bien: response.data.gia_sau_tuy_bien
        });
      }
    } catch (error) {
      console.log('Lỗi tính dinh dưỡng:', error.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleQtyChange = (maNL, delta, maxQty = 3) => {
    const current = quantities[maNL] || 0;
    const newQty = Math.max(0, Math.min(maxQty, current + delta));
    const newMap = { ...quantities, [maNL]: newQty };
    setQuantities(newMap);
    fetchCalculatedNutrition(itemId, newMap);
  };

  const handleAddToCart = async () => {
    const token = await AsyncStorage.getItem('user_token');
    if (!token) {
      Alert.alert(
        'Yêu cầu đăng nhập 🔒',
        'Bạn cần đăng nhập tài khoản để thêm món vào giỏ!',
        [
          { text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') },
          { text: 'Để sau', style: 'cancel' }
        ]
      );
      return;
    }

    setAdding(true);
    try {
      // Gọi API thêm món vào giỏ
      const response = await addToCart(itemId, 1, []);
      if (response.success) {
        Alert.alert(
          'Thành công 🎉',
          `Đã thêm '${foodData?.ten_mon}' tùy chỉnh dinh dưỡng vào giỏ hàng!`,
          [
            { text: 'Xem giỏ hàng', onPress: () => navigation.navigate('Cart') },
            { text: 'Tiếp tục xem món', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể thêm món tùy biến vào giỏ!');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00A896" />
        <Text style={styles.loadingText}>Đang tải công thức dinh dưỡng...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Card ảnh & thông tin món ăn thu nhỏ */}
        <View style={styles.headerFoodCard}>
          <View style={styles.foodImageContainer}>
            <Text style={styles.foodEmoji}>🥗</Text>
          </View>
          <View style={styles.foodHeaderInfo}>
            <Text style={styles.foodTitle}>{foodData?.ten_mon || initialFoodName}</Text>
            <Text style={styles.foodBadge}>Chế độ Tùy biến Dinh dưỡng (Killer Feature)</Text>
            <Text style={styles.basePriceText}>Giá gốc: {foodData?.gia_ban_goc?.toLocaleString('vi-VN')} đ</Text>
          </View>
        </View>

        {/* 2. Danh sách các nguyên liệu tùy biến */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🥬 Tùy chỉnh khẩu phần nguyên liệu</Text>
          <Text style={styles.sectionSubtitle}>
            Tăng/giảm nguyên liệu để điều chỉnh lượng Calo, Đạm, Tinh bột & Chất béo theo nhu cầu sức khỏe của bạn.
          </Text>

          {recipe.map((item) => {
            const currentQty = quantities[item.ma_nguyen_lieu] || 0;
            const isFixed = item.co_the_tuy_bien === 0;

            return (
              <View key={item.ma_nguyen_lieu} style={styles.ingredientRow}>
                <View style={styles.ingredientInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.ingredientName}>{item.ten_nguyen_lieu}</Text>
                    {isFixed ? (
                      <View style={styles.fixedBadge}>
                        <Text style={styles.fixedBadgeText}>Cố định</Text>
                      </View>
                    ) : item.don_gia_thay_doi > 0 ? (
                      <Text style={styles.extraPriceTag}>+{(parseFloat(item.don_gia_thay_doi)).toLocaleString('vi-VN')}đ/{item.don_vi_tinh}</Text>
                    ) : null}
                  </View>

                  <Text style={styles.macroDetailText}>
                    🔥 {item.calo} kcal | 🥩 {item.protein}g P | 🌾 {item.carbs}g C | 🥑 {item.fat}g F
                  </Text>
                </View>

                {/* Bộ điều khiển tăng giảm số lượng */}
                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, isFixed && styles.btnDisabled]}
                    disabled={isFixed || currentQty <= 0}
                    onPress={() => handleQtyChange(item.ma_nguyen_lieu, -1, item.so_luong_toi_da)}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>

                  <Text style={styles.qtyValueText}>{currentQty} {item.don_vi_tinh}</Text>

                  <TouchableOpacity
                    style={[styles.qtyBtn, isFixed && styles.btnDisabled]}
                    disabled={isFixed || currentQty >= item.so_luong_toi_da}
                    onPress={() => handleQtyChange(item.ma_nguyen_lieu, 1, item.so_luong_toi_da)}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 3. Bottom Bar Cố Định ở Đáy: Thanh Thước Đo Dinh Dưỡng Dộng (Macro Bar) */}
      <View style={styles.macroBottomBar}>
        <View style={styles.macroHeaderRow}>
          <Text style={styles.macroTitle}>📊 Thước đo chỉ số dinh dưỡng</Text>
          {calculating && <ActivityIndicator size="small" color="#FF5722" />}
        </View>

        {/* Bảng 4 chỉ số Calo, Protein, Carbs, Fat */}
        <View style={styles.macroGrid}>
          <View style={styles.macroCardCalo}>
            <Text style={styles.macroEmoji}>🔥 Calo</Text>
            <Text style={styles.macroValCalo}>{nutrition.calo} <Text style={styles.unitText}>kcal</Text></Text>
          </View>

          <View style={styles.macroCardProtein}>
            <Text style={styles.macroEmoji}>🥩 Đạm (P)</Text>
            <Text style={styles.macroValProtein}>{nutrition.protein} <Text style={styles.unitText}>g</Text></Text>
          </View>

          <View style={styles.macroCardCarbs}>
            <Text style={styles.macroEmoji}>🌾 Carbs (C)</Text>
            <Text style={styles.macroValCarbs}>{nutrition.carbs} <Text style={styles.unitText}>g</Text></Text>
          </View>

          <View style={styles.macroCardFat}>
            <Text style={styles.macroEmoji}>🥑 Fat (F)</Text>
            <Text style={styles.macroValFat}>{nutrition.fat} <Text style={styles.unitText}>g</Text></Text>
          </View>
        </View>

        {/* Nút thêm vào giỏ hàng + Giá tiền tính toán động */}
        <TouchableOpacity
          style={[styles.addToCartBtn, adding && styles.btnDisabled]}
          onPress={handleAddToCart}
          disabled={adding}
        >
          {adding ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <View style={styles.addToCartBtnContent}>
              <Text style={styles.addToCartBtnText}>Thêm vào giỏ hàng</Text>
              <Text style={styles.addToCartPriceText}>{nutrition.gia_sau_tuy_bien?.toLocaleString('vi-VN')} đ</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6C757D',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 230,
  },
  headerFoodCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    alignItems: 'center',
  },
  foodImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  foodEmoji: {
    fontSize: 34,
  },
  foodHeaderInfo: {
    flex: 1,
  },
  foodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  foodBadge: {
    fontSize: 11,
    color: '#00A896',
    fontWeight: 'bold',
    marginTop: 2,
  },
  basePriceText: {
    fontSize: 13,
    color: '#FF5722',
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#78909C',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
  },
  ingredientRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  ingredientInfo: {
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginRight: 8,
  },
  fixedBadge: {
    backgroundColor: '#ECEFF1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fixedBadgeText: {
    fontSize: 10,
    color: '#607D8B',
    fontWeight: 'bold',
  },
  extraPriceTag: {
    fontSize: 11,
    color: '#FF5722',
    fontWeight: 'bold',
  },
  macroDetailText: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 3,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: '#CFD8DC',
  },
  qtyBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qtyValueText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1D1E',
    paddingHorizontal: 12,
  },
  macroBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  macroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  macroTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  macroCardCalo: {
    flex: 1,
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    marginRight: 4,
  },
  macroCardProtein: {
    flex: 1,
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    marginRight: 4,
  },
  macroCardCarbs: {
    flex: 1,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    marginRight: 4,
  },
  macroCardFat: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  macroEmoji: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#555',
  },
  macroValCalo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D84315',
    marginTop: 2,
  },
  macroValProtein: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C62828',
    marginTop: 2,
  },
  macroValCarbs: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F57F17',
    marginTop: 2,
  },
  macroValFat: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 2,
  },
  unitText: {
    fontSize: 9,
    fontWeight: 'normal',
  },
  addToCartBtn: {
    backgroundColor: '#FF5722',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  addToCartBtnContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addToCartBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  addToCartPriceText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
