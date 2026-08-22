import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  SafeAreaView,
  FlatList
} from 'react-native';
import { fetchCart, updateCartItem, removeCartItem, clearCart } from '../services/api';
import BottomTabBar from '../components/BottomTabBar';

export default function CartScreen({ navigation }) {
  const [cartData, setCartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCart();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCart = async () => {
    setLoading(true);
    try {
      const response = await fetchCart();
      if (response.success) {
        setCartData(response.data);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể lấy thông tin giỏ hàng!');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUpdateQty = async (cartItemId, currentQty, delta) => {
    const newQty = currentQty + delta;
    try {
      const response = await updateCartItem(cartItemId, newQty);
      if (response.success) {
        loadCart();
      }
    } catch (error) {
      Alert.alert('Thông báo', error.message || 'Không thể cập nhật số lượng!');
    }
  };

  const handleRemoveItem = (cartItemId, foodName) => {
    Alert.alert(
      'Xóa món ăn',
      `Bạn có chắc muốn xóa '${foodName}' khỏi giỏ hàng?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await removeCartItem(cartItemId);
              if (response.success) {
                loadCart();
              }
            } catch (error) {
              Alert.alert('Lỗi', error.message || 'Không thể xóa món!');
            }
          }
        }
      ]
    );
  };

  const handleClearCart = () => {
    if (!cartData || cartData.items.length === 0) return;
    Alert.alert(
      'Làm sạch giỏ hàng',
      'Bạn có chắc muốn xóa tất cả các món trong giỏ?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa tất cả', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await clearCart();
              if (response.success) {
                loadCart();
              }
            } catch (error) {
              Alert.alert('Lỗi', error.message || 'Không thể làm sạch giỏ hàng!');
            }
          }
        }
      ]
    );
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartItemCard}>
      <View style={styles.foodEmojiContainer}>
        <Text style={styles.foodEmoji}>🍔</Text>
      </View>

      <View style={styles.cartItemInfo}>
        <View style={styles.cartItemHeader}>
          <Text style={styles.foodName} numberOfLines={1}>{item.ten_mon}</Text>
          <TouchableOpacity onPress={() => handleRemoveItem(item.ma_chi_tiet_gio, item.ten_mon)}>
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        </View>

        {item.tuy_chon_da_chon && item.tuy_chon_da_chon.length > 0 && (
          <View style={styles.optionsContainer}>
            {item.tuy_chon_da_chon.map((opt, idx) => (
              <Text key={idx} style={styles.optionText}>
                • {opt.ten_nhom}: {opt.ten_gia_tri} {opt.gia_tang_them > 0 ? `(+${opt.gia_tang_them.toLocaleString('vi-VN')}đ)` : ''}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.cartItemFooter}>
          <Text style={styles.itemPrice}>{item.gia_tam_tinh.toLocaleString('vi-VN')} đ</Text>
          
          <View style={styles.qtyControlContainer}>
            <TouchableOpacity 
              style={styles.qtyBtnMinus} 
              onPress={() => handleUpdateQty(item.ma_chi_tiet_gio, item.so_luong, -1)}
            >
              <Text style={styles.qtyBtnMinusText}>-</Text>
            </TouchableOpacity>
            
            <Text style={styles.qtyText}>{item.so_luong}</Text>
            
            <TouchableOpacity 
              style={styles.qtyBtnPlus} 
              onPress={() => handleUpdateQty(item.ma_chi_tiet_gio, item.so_luong, 1)}
            >
              <Text style={styles.qtyBtnPlusText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00A896" />
      </View>
    );
  }

  const items = cartData?.items || [];
  const shippingFee = items.length > 0 ? 15000 : 0;
  const grandTotal = (cartData?.tong_tien || 0) + shippingFee;

  return (
    <SafeAreaView style={styles.container}>
      {items.length === 0 ? (
        /* Empty Cart State theo đúng Mockup Design (Paper bag / empty state) */
        <View style={styles.emptyContainer}>
          <View style={styles.paperBagContainer}>
            <Text style={styles.paperBagEmoji}>🛍️</Text>
          </View>
          <Text style={styles.emptyTitle}>Giỏ hàng của bạn đang trống!</Text>
          <Text style={styles.emptySubtitle}>Có vẻ như bạn chưa chọn món ăn nào. Hãy quay lại thực đơn và chọn những món ăn ngon tuyệt nhé.</Text>
          <TouchableOpacity style={styles.orderNowBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.orderNowBtnText}>Khám phá thực đơn 🍔</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.cartHeader}>
            <Text style={styles.cartCountText}>Món ăn đã chọn ({cartData?.tong_so_luong || 0})</Text>
            <TouchableOpacity onPress={handleClearCart}>
              <Text style={styles.clearAllText}>Xóa tất cả</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={items}
            renderItem={renderCartItem}
            keyExtractor={item => item.ma_chi_tiet_gio.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Bottom Card: Review Payment and Address */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tiền hàng tạm tính:</Text>
              <Text style={styles.summaryValue}>{cartData?.tong_tien.toLocaleString('vi-VN')} đ</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phí giao hàng cố định:</Text>
              <Text style={styles.summaryValue}>{shippingFee.toLocaleString('vi-VN')} đ</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>TỔNG THÀNH TIỀN:</Text>
              <Text style={styles.totalValue}>{grandTotal.toLocaleString('vi-VN')} đ</Text>
            </View>

            <TouchableOpacity 
              style={styles.checkoutBtn} 
              onPress={() => navigation.navigate('Checkout', { cartData, grandTotal })}
            >
              <Text style={styles.checkoutBtnText}>Tiến hành Đặt hàng 🚀</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Thanh điều hướng Bottom Tab chuẩn Mockup UI */}
      <BottomTabBar activeTab="Cart" navigation={navigation} />
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
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  cartCountText: {
    fontSize: 15,
    color: '#1A1D1E',
    fontWeight: 'bold',
  },
  clearAllText: {
    fontSize: 13,
    color: '#FF5722',
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cartItemCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  foodEmojiContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  foodEmoji: {
    fontSize: 34,
  },
  cartItemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1D1E',
    flex: 1,
  },
  deleteText: {
    fontSize: 16,
    color: '#9E9E9E',
    paddingLeft: 8,
  },
  optionsContainer: {
    marginTop: 4,
    marginBottom: 6,
  },
  optionText: {
    fontSize: 12,
    color: '#6C757D',
  },
  cartItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FF5722',
  },
  qtyControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtnMinus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  qtyBtnMinusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#616161',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    color: '#1A1D1E',
  },
  qtyBtnPlus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnPlusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6C757D',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1A1D1E',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF5722',
  },
  checkoutBtn: {
    backgroundColor: '#FF5722',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
    elevation: 2,
  },
  checkoutBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  paperBagContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  paperBagEmoji: {
    fontSize: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#78909C',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  orderNowBtn: {
    backgroundColor: '#FF5722',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  orderNowBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
