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
import { fetchItemNutrition, calculateNutrition, addToCart, updateCartItem } from '../services/api';

export default function CustomNutritionScreen({ route, navigation }) {
  const { itemId, foodName: initialFoodName, cartItemId, initialQuantities } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [adding, setAdding] = useState(false);

  const [foodData, setFoodData] = useState(null);
  const [recipe, setRecipe] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [isPrepackaged, setIsPrepackaged] = useState(false);
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
        const isPackaged = response.data.la_mon_dong_san || false;
        setIsPrepackaged(isPackaged);

        // Chỉ lọc các nguyên liệu có thể tùy biến (lọc bỏ các nguyên liệu cố định bắt buộc)
        const recipeList = (response.data.cong_thuc_nguyen_lieu || []).filter(item => item.co_the_tuy_bien === 1);
        setRecipe(recipeList);

        // Khởi tạo map số lượng (nếu đang sửa từ giỏ hàng thì lấy định lượng cũ, ngược lại lấy mặc định)
        const initialQty = {};
        recipeList.forEach(item => {
          if (initialQuantities && initialQuantities[item.ma_nguyen_lieu] !== undefined) {
            initialQty[item.ma_nguyen_lieu] = parseFloat(initialQuantities[item.ma_nguyen_lieu]);
          } else {
            initialQty[item.ma_nguyen_lieu] = Math.max(1, parseFloat(item.so_luong_mac_dinh));
          }
        });
        setQuantities(initialQty);

        // Tính toán thông số khởi đầu
        if (recipeList.length > 0) {
          fetchCalculatedNutrition(itemId, initialQty);
        } else {
          const defNutrition = response.data?.tong_dinh_duong_mac_dinh || {};
          setNutrition({
            calo: defNutrition.calo || 0,
            protein: defNutrition.protein || 0,
            carbs: defNutrition.carbs || 0,
            fat: defNutrition.fat || 0,
            phu_thu_nguyen_lieu: 0,
            gia_sau_tuy_bien: response.data?.gia_ban_goc || 0
          });
        }
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

  // Giới hạn tăng/giảm nguyên liệu: Thấp nhất là 1 (không về 0, tiền không về 0), tối đa là 5
  const handleQtyChange = (maNL, delta) => {
    const current = quantities[maNL] || 1;
    const newQty = Math.max(1, Math.min(5, current + delta));
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
      // Đóng gói cấu hình dinh dưỡng tùy biến và giá sau tùy biến
      const adjusted_labels = [];
      ingredients.forEach(ing => {
        const qty = quantities[ing.ma_nguyen_lieu] !== undefined ? quantities[ing.ma_nguyen_lieu] : 1;
        if (qty > 1) {
          adjusted_labels.push(`Tăng ${ing.ten_nguyen_lieu} (x${qty})`);
        } else if (qty < 1) {
          adjusted_labels.push(`Bớt ${ing.ten_nguyen_lieu} (x${qty})`);
        }
      });

      const customNutritionPayload = {
        calo: nutrition.calo,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        gia_sau_tuy_bien: nutrition.gia_sau_tuy_bien,
        chi_tiet_nguyen_lieu: quantities,
        adjusted_labels
      };

      if (cartItemId) {
        // Đang tùy biến lại từ giỏ hàng => cập nhật chi tiết giỏ hàng hiện tại
        const response = await updateCartItem(cartItemId, undefined, customNutritionPayload);
        if (response.success) {
          Alert.alert(
            'Đã cập nhật giỏ hàng 🎉',
            `Món '${foodData?.ten_mon}' đã được cập nhật dinh dưỡng và giá mới!`,
            [
              { text: 'Về giỏ hàng', onPress: () => navigation.navigate('Cart') }
            ]
          );
        }
      } else {
        // Thêm mới món đã tùy biến vào giỏ hàng
        const response = await addToCart(itemId, 1, [], customNutritionPayload);
        if (response.success) {
          Alert.alert(
            'Thành công 🎉',
            `Đã thêm '${foodData?.ten_mon}' với tùy chỉnh dinh dưỡng vào giỏ hàng!`,
            [
              { text: 'Xem giỏ hàng', onPress: () => navigation.navigate('Cart') },
              { text: 'Tiếp tục xem món', style: 'cancel' }
            ]
          );
        }
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể cập nhật món tùy biến vào giỏ!');
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
        {/* 1. Card ảnh & thông tin món ăn */}
        <View style={styles.headerFoodCard}>
          <View style={styles.foodImageContainer}>
            <Text style={styles.foodEmoji}>{recipe.length === 0 ? '🍽️' : '🥗'}</Text>
          </View>
          <View style={styles.foodHeaderInfo}>
            <Text style={styles.foodTitle}>{foodData?.ten_mon || initialFoodName}</Text>
            <Text style={styles.foodBadge}>
              {cartItemId 
                ? '🔄 Đang chỉnh sửa món trong giỏ hàng' 
                : recipe.length === 0 
                  ? 'Món không có tùy biến dinh dưỡng' 
                  : 'Chế độ Tùy biến Dinh dưỡng'}
            </Text>
            <Text style={styles.basePriceText}>
              Giá gốc: {foodData?.gia_ban_goc?.toLocaleString('vi-VN')} đ
            </Text>
          </View>
        </View>

        {/* 2. Danh sách các nguyên liệu tùy biến */}
        <View style={styles.sectionContainer}>
          {recipe.length === 0 ? (
            <View style={styles.noCustomBox}>
              <Text style={styles.noCustomEmoji}>🍽️</Text>
              <Text style={styles.noCustomTitle}>Món không có tùy biến dinh dưỡng</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>🥬 Tùy chỉnh khẩu phần nguyên liệu</Text>
              <Text style={styles.sectionSubtitle}>
                Tăng/giảm nguyên liệu để điều chỉnh lượng Calo, Đạm, Tinh bột & Chất béo theo nhu cầu sức khỏe của bạn.
              </Text>
              {recipe.map((item) => {
              const currentQty = quantities[item.ma_nguyen_lieu] || 1;
              const defQty = parseFloat(item.so_luong_mac_dinh);
              const delta = currentQty - defQty;

              return (
                <View key={item.ma_nguyen_lieu} style={styles.ingredientRow}>
                  <View style={styles.ingredientInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.ingredientName}>{item.ten_nguyen_lieu}</Text>
                      {item.don_gia_thay_doi > 0 ? (
                        <Text style={styles.extraPriceTag}>
                          {parseFloat(item.don_gia_thay_doi).toLocaleString('vi-VN')} đ/{item.don_vi_tinh}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.macroDetailText}>
                      🔥 {item.calo} kcal | 🥩 {item.protein}g P | 🌾 {item.carbs}g C | 🥑 {item.fat}g F
                    </Text>

                    {/* Hiển thị chênh lệch giá khi tăng hoặc giảm */}
                    {delta !== 0 && (
                      <View style={[styles.deltaBadge, delta > 0 ? styles.deltaPlus : styles.deltaMinus]}>
                        <Text style={[styles.deltaText, delta > 0 ? styles.deltaTextPlus : styles.deltaTextMinus]}>
                          {delta > 0 
                            ? `+${(delta * item.don_gia_thay_doi).toLocaleString('vi-VN')} đ (Thêm ${delta} ${item.don_vi_tinh})`
                            : `-${((-delta) * item.don_gia_thay_doi).toLocaleString('vi-VN')} đ (Giảm ${-delta} ${item.don_vi_tinh})`
                          }
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Bộ điều khiển tăng/giảm số lượng: Min 1, Max 5 */}
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={[styles.qtyBtn, currentQty <= 1 && styles.btnDisabled]}
                      disabled={currentQty <= 1}
                      onPress={() => handleQtyChange(item.ma_nguyen_lieu, -1)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.qtyBtnText, currentQty <= 1 && styles.qtyBtnTextDisabled]}>-</Text>
                    </TouchableOpacity>

                    <Text style={styles.qtyValueText}>{currentQty} {item.don_vi_tinh}</Text>

                    <TouchableOpacity
                      style={[styles.qtyBtn, currentQty >= 5 && styles.btnDisabled]}
                      disabled={currentQty >= 5}
                      onPress={() => handleQtyChange(item.ma_nguyen_lieu, 1)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.qtyBtnText, currentQty >= 5 && styles.qtyBtnTextDisabled]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
      </ScrollView>

      {/* 3. Bottom Bar Cố Định ở Đáy: Thanh Thước Đo Dinh Dưỡng Động (Macro Bar) */}
      <View style={styles.macroBottomBar}>
        <View style={styles.macroHeaderRow}>
          <Text style={styles.macroTitle}>📊 Thước đo chỉ số dinh dưỡng</Text>
          {calculating && <ActivityIndicator size="small" color="#00A896" />}
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

        {/* Nút thêm/cập nhật vào giỏ hàng + Giá tiền tính toán động */}
        <TouchableOpacity
          style={[styles.addToCartBtn, adding && styles.btnDisabled]}
          onPress={handleAddToCart}
          disabled={adding}
          activeOpacity={0.85}
        >
          {adding ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <View style={styles.addToCartBtnContent}>
              <Text style={styles.addToCartBtnText}>
                {cartItemId ? 'Cập nhật món trong giỏ 🔄' : 'Thêm vào giỏ hàng'}
              </Text>
              <Text style={styles.addToCartPriceText}>
                {(nutrition.gia_sau_tuy_bien || foodData?.gia_ban_goc || 0).toLocaleString('vi-VN')} đ
              </Text>
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
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  foodBadge: {
    fontSize: 11,
    color: '#00A896',
    fontWeight: '600',
    marginBottom: 4,
  },
  basePriceText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  noCustomBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 10,
  },
  noCustomEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  noCustomTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  prepackagedInfoBox: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  prepackagedInfoEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  prepackagedInfoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6,
  },
  prepackagedInfoDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  prepackagedBadgeBox: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  prepackagedBadgeText: {
    color: '#00796B',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ingredientInfo: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginRight: 8,
  },
  extraPriceTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  macroDetailText: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  deltaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  deltaPlus: {
    backgroundColor: '#DCFCE7',
  },
  deltaMinus: {
    backgroundColor: '#FEF3C7',
  },
  deltaText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  deltaTextPlus: {
    color: '#16A34A',
  },
  deltaTextMinus: {
    color: '#D97706',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 3,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00A896',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  qtyBtnText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFF',
    lineHeight: 19,
  },
  qtyBtnTextDisabled: {
    color: '#94A3B8',
  },
  qtyValueText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
    paddingHorizontal: 10,
    minWidth: 50,
    textAlign: 'center',
  },
  macroBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  macroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  macroTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  macroGrid: {
    flexDirection: 'row',
    marginBottom: 12,
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
    backgroundColor: '#00A896',
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
