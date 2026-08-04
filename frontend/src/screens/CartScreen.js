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

        {/* Danh sách tùy chọn đã chọn (Size, Toppings) */}
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
              style={styles.qtyBtn} 
              onPress={() => handleUpdateQty(item.ma_chi_tiet_gio, item.so_luong, -1)}
            >
              <Text style={styles.qtyBtnText}>-</Text>
            </TouchableOpacity>
            
            <Text style={styles.qtyText}>{item.so_luong}</Text>
            
            <TouchableOpacity 
              style={styles.qtyBtn} 
              onPress={() => handleUpdateQty(item.ma_chi_tiet_gio, item.so_luong, 1)}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF8F00" />
      </View>
    );
  }

  const items = cartData?.items || [];
  const shippingFee = items.length > 0 ? 15000 : 0;
  const grandTotal = (cartData?.tong_tien || 0) + shippingFee;

  return (
    <SafeAreaView style={styles.container}>
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Giỏ hàng của bạn đang trống!</Text>
          <Text style={styles.emptySubtitle}>Hãy quay lại thực đơn và chọn cho mình những món ăn siêu ngon nhé.</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.browseBtnText}>Khám phá thực đơn 🍔</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.cartHeader}>
            <Text style={styles.cartCountText}>Bạn có {cartData?.tong_so_luong || 0} món trong giỏ</Text>
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

          {/* Thanh toán & Tổng tiền */}
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
              <Text style={styles.totalLabel}>TỔNG THANH TOÁN:</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF3E0',
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
    paddingBottom: 8,
  },
  cartCountText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  clearAllText: {
    fontSize: 13,
    color: '#D84315',
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cartItemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  foodEmojiContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#FFE0B2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  foodEmoji: {
    fontSize: 32,
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
    color: '#333',
    flex: 1,
  },
  deleteText: {
    fontSize: 16,
    color: '#999',
    paddingLeft: 8,
  },
  optionsContainer: {
    marginTop: 4,
    marginBottom: 6,
  },
  optionText: {
    fontSize: 12,
    color: '#888',
  },
  cartItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#D84315',
  },
  qtyControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    color: '#333',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
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
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
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
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D84315',
  },
  checkoutBtn: {
    backgroundColor: '#FF8F00',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
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
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseBtn: {
    backgroundColor: '#FF8F00',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  browseBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
