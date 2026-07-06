import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCategories, fetchItems, logoutUser } from '../services/api';

export default function HomeScreen({ navigation, route }) {
  const [userInfo, setUserInfo] = useState(null);
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
  }, []);

  const loadUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user_info');
      if (storedUser) {
        setUserInfo(JSON.parse(storedUser));
      }
    } catch (e) {
      console.log('Không lấy được thông tin người dùng.');
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

  const handleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất không?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Đăng xuất', 
          onPress: async () => {
            await logoutUser();
            if (route.params?.onLogout) {
              route.params.onLogout();
            }
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
      {/* Trong môi trường thật sẽ dùng URI hinh_anh từ DB, ở đây làm mock/fallback */}
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
      {/* 1. Header: Chào hỏi & Đăng xuất */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingText}>Xin chào,</Text>
          <Text style={styles.userName}>{userInfo?.ho_ten || 'Khách hàng'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Đăng xuất</Text>
        </TouchableOpacity>
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
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.categoriesContainer}
          >
            <TouchableOpacity 
              style={[styles.categoryCard, selectedCategory === '' && styles.categoryCardSelected]}
              onPress={() => handleCategorySelect('')}
            >
              <Text style={[styles.categoryText, selectedCategory === '' && styles.categoryTextSelected]}>
                Tất cả 🍽️
              </Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.ma_danh_muc}
                style={[
                  styles.categoryCard, 
                  selectedCategory === cat.ma_danh_muc && styles.categoryCardSelected
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
            scrollEnabled={false} // Chạy scroll của ScrollView cha
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  greetingText: {
    fontSize: 14,
    color: '#888',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#D84315',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  logoutButtonText: {
    color: '#D84315',
    fontWeight: 'bold',
    fontSize: 12,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 16,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchButton: {
    backgroundColor: '#FF8F00',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bannerContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E65100', // Đỏ cam đậm
  },
  bannerContent: {
    padding: 20,
    alignItems: 'flex-start',
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD54F',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#FFF',
    marginBottom: 10,
  },
  bannerCode: {
    backgroundColor: '#FF8F00',
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  categoriesContainer: {
    paddingLeft: 20,
    paddingRight: 8,
    paddingBottom: 4,
  },
  categoryCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryCardSelected: {
    backgroundColor: '#FF8F00',
    borderColor: '#FF8F00',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  foodRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  foodCard: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  foodImageContainer: {
    height: 120,
    backgroundColor: '#FFE0B2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodEmoji: {
    fontSize: 48,
  },
  foodInfo: {
    padding: 10,
  },
  foodName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryBadge: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  foodPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D84315',
    marginTop: 6,
  },
  loader: {
    marginTop: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
});
