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
  SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCategories, fetchItems, logoutUser } from '../services/api';

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

  // Guard kiểm tra đăng nhập trước khi cho phép vào các chức năng bảo vệ
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

  const renderFoodItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.foodCard}
      onPress={() => navigation.navigate('ProductDetail', { itemId: item.ma_mon_an })}
    >
      <View style={styles.foodImageContainer}>
        <Text style={styles.foodEmoji}>🍔</Text>
      </View>
      <View style={styles.foodInfo}>
        <Text style={styles.foodName} numberOfLines={1}>{item.ten_mon}</Text>
        <Text style={styles.categoryBadge}>{item.ten_danh_muc || 'Món ăn'}</Text>
        <Text style={styles.foodPrice}>{parseInt(item.gia_ban).toLocaleString('vi-VN')} đ</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header: Chào hỏi, Giỏ hàng, Đơn hàng & Đăng xuất / Đăng nhập */}
      <View style={styles.header}>
        <View style={styles.userGreeting}>
          <Text style={styles.greetingText}>Xin chào,</Text>
          <Text style={styles.userName} numberOfLines={1}>{userInfo?.ho_ten || 'Khách ghé thăm 👋'}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconHeaderBtn} 
            onPress={() => checkAuthGuard(() => navigation.navigate('OrdersList'), 'xem lịch sử đơn hàng')}
          >
            <Text style={styles.iconHeaderText}>📋 Đơn hàng</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.iconHeaderBtnCart} 
            onPress={() => checkAuthGuard(() => navigation.navigate('Cart'), 'xem giỏ hàng và mua hàng')}
          >
            <Text style={styles.iconHeaderTextCart}>🛒 Giỏ hàng</Text>
          </TouchableOpacity>

          {userInfo ? (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Thoát</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginButtonText}>Đăng nhập</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 2. Ô tìm kiếm */}
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm burger, gà rán, nước ngọt..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Tìm</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Banner khuyến mãi đẹp mắt */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>GIẢM NGAY 30% 🎉</Text>
            <Text style={styles.bannerSubtitle}>Áp dụng cho đơn hàng đầu tiên của bạn</Text>
            <Text style={styles.bannerCode}>CODE: FAST30</Text>
          </View>
        </View>

        {/* 4. Danh sách danh mục cuộn ngang */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Danh mục thực đơn</Text>
        </View>
        
        {loadingCategories ? (
          <ActivityIndicator color="#FF8F00" style={styles.loader} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
            <TouchableOpacity 
              style={[
                styles.categoryChip, 
                selectedCategory === '' && styles.categoryChipSelected
              ]}
              onPress={() => handleCategorySelect('')}
            >
              <Text style={[
                styles.categoryText, 
                selectedCategory === '' && styles.categoryTextSelected
              ]}>Tất cả</Text>
            </TouchableOpacity>

            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat.ma_danh_muc} 
                style={[
                  styles.categoryChip, 
                  selectedCategory === cat.ma_danh_muc && styles.categoryChipSelected
                ]}
                onPress={() => handleCategorySelect(cat.ma_danh_muc)}
              >
                <Text style={[
                  styles.categoryText, 
                  selectedCategory === cat.ma_danh_muc && styles.categoryTextSelected
                ]}>
                  {cat.ten_danh_muc}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* 5. Danh sách món ăn nổi bật */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Món ăn ngon dành cho bạn</Text>
        </View>

        {loadingFoods ? (
          <ActivityIndicator color="#FF8F00" style={styles.loader} />
        ) : foods.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Không tìm thấy món ăn nào phù hợp!</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userGreeting: {
    flex: 1,
    marginRight: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconHeaderBtn: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 4,
  },
  iconHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FF8F00',
  },
  iconHeaderBtnCart: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 4,
  },
  iconHeaderTextCart: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  greetingText: {
    fontSize: 12,
    color: '#888',
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#D84315',
  },
  logoutButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#D84315',
    fontWeight: 'bold',
    fontSize: 12,
  },
  loginButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FF8F00',
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FAF3E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#FF8F00',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#D84315',
    borderRadius: 14,
    padding: 18,
  },
  bannerContent: {
    alignItems: 'flex-start',
  },
  bannerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bannerSubtitle: {
    color: '#FFE0B2',
    fontSize: 13,
    marginTop: 4,
  },
  bannerCode: {
    marginTop: 10,
    backgroundColor: '#FFF',
    color: '#D84315',
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  categoriesContainer: {
    paddingLeft: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FAF3E0',
    marginRight: 10,
  },
  categoryChipSelected: {
    backgroundColor: '#FF8F00',
  },
  categoryText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  foodRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  foodCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  foodImageContainer: {
    width: '100%',
    height: 100,
    backgroundColor: '#FFE0B2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  foodEmoji: {
    fontSize: 48,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  categoryBadge: {
    fontSize: 11,
    color: '#888',
    marginBottom: 6,
  },
  foodPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#D84315',
  },
  loader: {
    marginVertical: 20,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
});
