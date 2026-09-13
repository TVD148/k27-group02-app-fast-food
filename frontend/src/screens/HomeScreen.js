import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  SafeAreaView,
  Image,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCategories, fetchItems, logoutUser } from '../services/api';
import BottomTabBar from '../components/BottomTabBar';
import EmptyState from '../components/EmptyState';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [userInfo, setUserInfo] = useState(null);
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [categories, setCategories] = useState([]);
  const [foods, setFoods] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingFoods, setLoadingFoods] = useState(true);

  useEffect(() => {
    loadUserData();
    loadCategoriesData();
    loadFoodsData('', '');

    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
      loadFoodsData(selectedCategory, searchQuery, true);
    });

    return () => {
      unsubscribe();
    };
  }, [navigation]);

  const loadUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user_info');
      const token = await AsyncStorage.getItem('user_token');
      if (storedUser && token) {
        const user = JSON.parse(storedUser);
        const userRole = parseInt(user.ma_vai_tro || 1, 10);
        if (userRole === 4) {
          navigation.replace('Shipper');
          return;
        } else if (userRole === 2 || userRole === 5) {
          navigation.replace('StaffKitchen');
          return;
        } else if (userRole === 3) {
          navigation.replace('Admin');
          return;
        }
        setUserInfo(user);

        // Tải địa chỉ mặc định của tài khoản hiện tại
        const userKey = user.ma_nguoi_dung || user.id || user.so_dien_thoai;
        let storedAddr = (userKey ? await AsyncStorage.getItem(`default_address_${userKey}`) : null) || await AsyncStorage.getItem('default_address');
        if (storedAddr) {
          setDefaultAddress(JSON.parse(storedAddr));
        } else {
          const savedList = (userKey ? await AsyncStorage.getItem(`saved_addresses_${userKey}`) : null) || await AsyncStorage.getItem('saved_addresses');
          if (savedList) {
            const list = JSON.parse(savedList);
            if (Array.isArray(list) && list.length > 0) {
              const def = list.find(a => a.isDefault) || list[0];
              setDefaultAddress(def);
            } else {
              setDefaultAddress(null);
            }
          } else {
            setDefaultAddress(null);
          }
        }
      } else {
        // Chưa đăng nhập -> KHÔNG hiển thị địa chỉ của tài khoản khác
        setUserInfo(null);
        setDefaultAddress(null);
      }
    } catch (e) {
      console.log('Lỗi tải dữ liệu người dùng & địa chỉ');
    }
  };

  const loadCategoriesData = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetchCategories();
      if (response && response.success && Array.isArray(response.data)) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.log('Lỗi tải danh mục từ Database:', error.message);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadFoodsData = async (catId, search, silent = false) => {
    if (!silent) setLoadingFoods(true);
    try {
      const response = await fetchItems(catId, search);
      if (response && response.success && Array.isArray(response.data)) {
        setFoods(response.data);
      } else {
        setFoods([]);
      }
    } catch (error) {
      console.log('Lỗi tải món ăn từ Database:', error.message);
      if (!silent) setFoods([]);
    } finally {
      if (!silent) setLoadingFoods(false);
    }
  };

  const handleCategorySelect = (categoryId) => {
    const newCatId = selectedCategory === categoryId ? '' : categoryId;
    setSelectedCategory(newCatId);
    loadFoodsData(newCatId, searchQuery);
  };

  const handleSearch = () => {
    loadFoodsData(selectedCategory, searchQuery);
  };

  const checkAuthGuard = async (onAuthorized, featureName) => {
    const token = await AsyncStorage.getItem('user_token');
    if (!token) {
      Alert.alert(
        'Yêu cầu đăng nhập 🔒',
        `Bạn cần đăng nhập tài khoản để ${featureName}!`,
        [
          { text: 'Đăng nhập ngay', onPress: () => navigation.navigate('Login') },
          { text: 'Để sau', style: 'cancel' }
        ]
      );
      return false;
    }
    onAuthorized();
    return true;
  };

  const handleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất tài khoản?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Đăng xuất', 
          onPress: async () => {
            await logoutUser();
            await AsyncStorage.removeItem('default_address');
            setUserInfo(null);
            setDefaultAddress(null);
            Alert.alert('Thông báo', 'Đã đăng xuất tài khoản.');
          } 
        }
      ]
    );
  };

  // Helper render icon danh mục dạng hình tròn đẹp mắt
  const getCategoryEmoji = (name) => {
    const n = name.toLowerCase();
    if (n.includes('burger')) return '🍔';
    if (n.includes('gà') || n.includes('chicken')) return '🍗';
    if (n.includes('uống') || n.includes('drink')) return '🥤';
    if (n.includes('combo')) return '🍱';
    return '🍟';
  };

  const renderFoodItem = ({ item }) => {
    const isOutOfStock = item.trang_thai === 'het_hang';
    return (
      <TouchableOpacity 
        style={[styles.foodCard, isOutOfStock && styles.foodCardOutOfStock]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ProductDetail', { itemId: item.ma_mon_an })}
      >
        <View style={[styles.foodImageContainer, isOutOfStock && styles.foodImageOutOfStock]}>
          <Text style={[styles.foodEmoji, isOutOfStock && { opacity: 0.4 }]}>🍔</Text>
          {isOutOfStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Ngưng bán</Text>
            </View>
          )}
        </View>
        
        <View style={styles.foodInfo}>
          <Text style={[styles.foodName, isOutOfStock && styles.foodTextOutOfStock]} numberOfLines={1}>
            {item.ten_mon}
          </Text>
          <Text style={styles.categoryBadge}>{item.ten_danh_muc || 'Fast Food'}</Text>
          
          <View style={styles.foodCardFooter}>
            <Text style={[styles.foodPrice, isOutOfStock && styles.foodPriceOutOfStock]}>
              {parseInt(item.gia_ban).toLocaleString('vi-VN')} đ
            </Text>
            <TouchableOpacity 
              style={[styles.addPlusBtn, isOutOfStock && styles.addPlusBtnOutOfStock]}
              onPress={() => {
                if (isOutOfStock) {
                  Alert.alert('Thông báo', `Món '${item.ten_mon}' hiện đang tạm hết hàng / ngưng bán!`);
                  return;
                }
                navigation.navigate('ProductDetail', { itemId: item.ma_mon_an });
              }}
            >
              <Text style={[styles.addPlusText, isOutOfStock && styles.addPlusTextOutOfStock]}>
                {isOutOfStock ? 'Hết' : '+'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Teal Curved Header Ghim Cố Định Trên Cùng (Sticky) - Khi lướt trang vẫn luôn hiển thị */}
      <View style={styles.tealHeader}>
        <View style={styles.topRow}>
          <TouchableOpacity 
            style={styles.locationContainer} 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Address')}
          >
            <Text style={styles.locationPin}>📍</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.locationTitle}>
                  Giao tới • {defaultAddress?.label || 'Địa chỉ nhận hàng'}
                </Text>
                <Text style={styles.changeAddressTag}>{defaultAddress ? 'Đổi ▾' : 'Chọn ▾'}</Text>
              </View>
              <Text style={styles.locationAddress} numberOfLines={1}>
                {defaultAddress ? defaultAddress.address : 'Nhấn để thêm hoặc chọn địa chỉ nhận hàng'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRightActions}>
            <TouchableOpacity 
              style={styles.headerBadgeBtn}
              onPress={() => navigation.navigate('OrdersList')}
            >
              <Text style={styles.headerBadgeIcon}>📋</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Thanh tìm kiếm pill trắng ghim cố định - Bấm vào chuyển sang phần tìm kiếm luôn */}
        <TouchableOpacity 
          style={styles.searchBarContainer}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Search')}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholderText}>Tìm món ăn, trà sữa, gà rán, pizza...</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 2. Banner khuyến mãi cam nổi bật (Get $5 off / Code FAST30) */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerTitle}>GIẢM NGAY 30% 🎉</Text>
            <Text style={styles.bannerSubtitle}>Áp dụng cho đơn hàng đầu tiên của bạn</Text>
            <View style={styles.codeTag}>
              <Text style={styles.codeText}>CODE: FAST30</Text>
            </View>
          </View>
          <Text style={styles.bannerEmoji}>🍜</Text>
        </View>

        {/* 3. Phân loại danh mục thực đơn hình tròn chuẩn Mockup */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Danh mục nổi bật</Text>
        </View>

        {loadingCategories ? (
          <ActivityIndicator color="#00A896" style={styles.loader} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScrollView}>
            <TouchableOpacity 
              style={[styles.categoryCircleCard, selectedCategory === '' && styles.categoryCircleActive]}
              onPress={() => handleCategorySelect('')}
            >
              <View style={[styles.categoryCircle, selectedCategory === '' && styles.categoryCircleBgActive]}>
                <Text style={styles.categoryEmoji}>🔥</Text>
              </View>
              <Text style={[styles.categoryName, selectedCategory === '' && styles.categoryNameActive]}>Tất cả</Text>
            </TouchableOpacity>

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.ma_danh_muc;
              return (
                <TouchableOpacity 
                  key={cat.ma_danh_muc} 
                  style={[styles.categoryCircleCard, isSelected && styles.categoryCircleActive]}
                  onPress={() => handleCategorySelect(cat.ma_danh_muc)}
                >
                  <View style={[styles.categoryCircle, isSelected && styles.categoryCircleBgActive]}>
                    <Text style={styles.categoryEmoji}>{getCategoryEmoji(cat.ten_danh_muc)}</Text>
                  </View>
                  <Text style={[styles.categoryName, isSelected && styles.categoryNameActive]} numberOfLines={1}>
                    {cat.ten_danh_muc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* 4. Danh sách món ăn nức lòng (Giao diện Card bo tròn mịn đẹp) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Món ăn ngon dành cho bạn 🌟</Text>
        </View>

        {loadingFoods ? (
          <ActivityIndicator color="#00A896" style={styles.loader} />
        ) : foods.length === 0 ? (
          <EmptyState
            icon="🍽️"
            title="Không tìm thấy món ăn nào!"
            description="Rất tiếc, chúng tôi không tìm thấy kết quả phù hợp cho tìm kiếm của bạn. Hãy thử chọn danh mục khác hoặc tải lại nhé!"
            buttonText="Tải lại thực đơn 🔄"
            onButtonPress={() => {
              setSelectedCategory('');
              setSearchQuery('');
              loadFoodsData('', '');
            }}
          />
        ) : (
          <FlatList
            data={foods}
            renderItem={renderFoodItem}
            keyExtractor={item => item.ma_mon_an.toString()}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.foodRow}
          />
        )}
      </ScrollView>

      {/* Thanh điều hướng Bottom Tab chuẩn Mockup UI */}
      <BottomTabBar activeTab="Home" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FA',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  tealHeader: {
    backgroundColor: '#00A896',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 16,
    paddingBottom: 18,
    zIndex: 100,
    elevation: 6,
    shadowColor: '#004D40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  locationPin: {
    fontSize: 20,
    marginRight: 8,
  },
  locationTitle: {
    fontSize: 11,
    color: '#E0F2F1',
    fontWeight: '500',
  },
  changeAddressTag: {
    fontSize: 10,
    color: '#FFE082',
    fontWeight: 'bold',
    marginLeft: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  locationAddress: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBadgeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  headerBadgeIcon: {
    fontSize: 16,
  },
  logoutHeaderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 14,
    marginLeft: 8,
  },
  logoutHeaderText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  loginHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF5722',
    borderRadius: 14,
    marginLeft: 8,
  },
  loginHeaderText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchPlaceholderText: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#999',
    paddingHorizontal: 6,
  },
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: '#FF5722',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  bannerLeft: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bannerSubtitle: {
    color: '#FFE0B2',
    fontSize: 12,
    marginTop: 4,
  },
  codeTag: {
    marginTop: 10,
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeText: {
    color: '#FF5722',
    fontWeight: 'bold',
    fontSize: 12,
  },
  bannerEmoji: {
    fontSize: 48,
    marginLeft: 10,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1D1E',
  },
  categoriesScrollView: {
    paddingLeft: 16,
  },
  categoryCircleCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 68,
  },
  categoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryCircleBgActive: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF5722',
  },
  categoryEmoji: {
    fontSize: 26,
  },
  categoryName: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryNameActive: {
    color: '#FF5722',
    fontWeight: 'bold',
  },
  foodRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  foodCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 10,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  foodImageContainer: {
    width: '100%',
    height: 110,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  foodEmoji: {
    fontSize: 50,
  },
  ratingTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  foodInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  foodName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginBottom: 2,
  },
  categoryBadge: {
    fontSize: 11,
    color: '#6C757D',
    marginBottom: 6,
  },
  foodCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  foodPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FF5722',
  },
  addPlusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPlusText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: -2,
  },
  foodCardOutOfStock: {
    opacity: 0.85,
    backgroundColor: '#F9FAFB',
  },
  foodImageOutOfStock: {
    backgroundColor: '#F3F4F6',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  outOfStockText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  foodTextOutOfStock: {
    color: '#9CA3AF',
  },
  foodPriceOutOfStock: {
    color: '#9CA3AF',
  },
  addPlusBtnOutOfStock: {
    backgroundColor: '#E5E7EB',
    width: 36,
  },
  addPlusTextOutOfStock: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 0,
  },
  loader: {
    marginVertical: 20,
  },
  emptySearchContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyPlateContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ECEFF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyPlateEmoji: {
    fontSize: 50,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1D1E',
    marginBottom: 4,
  },
  emptySearchSubtitle: {
    fontSize: 13,
    color: '#78909C',
    textAlign: 'center',
  },
});
