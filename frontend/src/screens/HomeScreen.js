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
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCategories, fetchItems, logoutUser } from '../services/api';
import BottomTabBar from '../components/BottomTabBar';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [userInfo, setUserInfo] = useState(null);
  const [categories, setCategories] = useState([]);
  const [foods, setFoods] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingFoods, setLoadingFoods] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
    });
    loadCategoriesData();
    loadFoodsData('', '');
    return unsubscribe;
  }, [navigation]);

  const loadUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user_info');
      const token = await AsyncStorage.getItem('user_token');
      if (storedUser && token) {
        setUserInfo(JSON.parse(storedUser));
      } else {
        setUserInfo(null);
      }
    } catch (e) {
      setUserInfo(null);
    }
  };

  const loadCategoriesData = async () => {
    try {
      const response = await fetchCategories();
      if (response.success) {
        setCategories(response.data);
      }
    } catch (error) {
      console.log('Lỗi tải danh mục:', error.message);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadFoodsData = async (catId, search) => {
    setLoadingFoods(true);
    try {
      const response = await fetchItems(catId, search);
      if (response.success) {
        setFoods(response.data);
      }
    } catch (error) {
      console.log('Lỗi tải món ăn:', error.message);
    } finally {
      setLoadingFoods(false);
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
            setUserInfo(null);
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

  const renderFoodItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.foodCard}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('ProductDetail', { itemId: item.ma_mon_an })}
    >
      <View style={styles.foodImageContainer}>
        <Text style={styles.foodEmoji}>🍔</Text>
        <View style={styles.ratingTag}>
          <Text style={styles.ratingText}>⭐ 4.9 (210)</Text>
        </View>
      </View>
      
      <View style={styles.foodInfo}>
        <Text style={styles.foodName} numberOfLines={1}>{item.ten_mon}</Text>
        <Text style={styles.categoryBadge}>{item.ten_danh_muc || 'Fast Food'}</Text>
        
        <View style={styles.foodCardFooter}>
          <Text style={styles.foodPrice}>{parseInt(item.gia_ban).toLocaleString('vi-VN')} đ</Text>
          <TouchableOpacity 
            style={styles.addPlusBtn}
            onPress={() => navigation.navigate('ProductDetail', { itemId: item.ma_mon_an })}
          >
            <Text style={styles.addPlusText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 1. Teal Curved Header theo đúng Mockup Design */}
        <View style={styles.tealHeader}>
          <View style={styles.topRow}>
            <View style={styles.locationContainer}>
              <Text style={styles.locationPin}>📍</Text>
              <View>
                <Text style={styles.locationTitle}>Giao tới địa chỉ</Text>
                <Text style={styles.locationAddress} numberOfLines={1}>
                  {userInfo ? `${userInfo.ho_ten} (${userInfo.so_dien_thoai || 'Fast Food'})` : 'Khách ghé thăm (Chọn địa chỉ)'}
                </Text>
              </View>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity 
                style={styles.headerBadgeBtn}
                onPress={() => checkAuthGuard(() => navigation.navigate('OrdersList'), 'xem lịch sử đơn hàng')}
              >
                <Text style={styles.headerBadgeIcon}>📋</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.headerBadgeBtn}
                onPress={() => checkAuthGuard(() => navigation.navigate('Cart'), 'xem giỏ hàng và mua hàng')}
              >
                <Text style={styles.headerBadgeIcon}>🛒</Text>
              </TouchableOpacity>

              {userInfo ? (
                <TouchableOpacity style={styles.logoutHeaderBtn} onPress={handleLogout}>
                  <Text style={styles.logoutHeaderText}>Thoát</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.loginHeaderBtn} onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginHeaderText}>Đăng nhập</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search Bar pill trắng nổi bật */}
          <View style={styles.searchBarContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for food & restaurants..."
              placeholderTextColor="#9E9E9E"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); loadFoodsData(selectedCategory, ''); }}>
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

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
          <View style={styles.emptySearchContainer}>
            <View style={styles.emptyPlateContainer}>
              <Text style={styles.emptyPlateEmoji}>🍽️</Text>
            </View>
            <Text style={styles.emptySearchTitle}>Không tìm thấy món ăn nào!</Text>
            <Text style={styles.emptySearchSubtitle}>Rất tiếc, chúng tôi không tìm thấy kết quả phù hợp cho tìm kiếm của bạn.</Text>
          </View>
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
    paddingTop: 16,
    paddingBottom: 20,
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
    paddingVertical: 10,
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
    lineHeight: 20,
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
