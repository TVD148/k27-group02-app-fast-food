import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  SafeAreaView, 
  Dimensions, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchItems } from '../services/api';
import BottomTabBar from '../components/BottomTabBar';
import EmptyState from '../components/EmptyState';

const { width } = Dimensions.get('window');

const POPULAR_KEYWORDS = [
  'Burger Bò', 'Gà Rán', 'Khoai Tây', 'Pizza', 'Phô Mai', 'Trà Đào'
];

export default function SearchScreen({ navigation, route }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState(['Burger Bò', 'Gà Rán Giòn', 'Khoai Tây Chiên']);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    loadRecentSearches();
    if (route?.params?.query) {
      setSearchQuery(route.params.query);
      executeSearch(route.params.query);
    }
  }, [route?.params?.query]);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem('recent_searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.log('Không thể tải lịch sử tìm kiếm');
    }
  };

  const saveRecentSearch = async (term) => {
    if (!term || !term.trim()) return;
    const cleanTerm = term.trim();
    const updated = [cleanTerm, ...recentSearches.filter(item => item !== cleanTerm)].slice(0, 8);
    setRecentSearches(updated);
    try {
      await AsyncStorage.setItem('recent_searches', JSON.stringify(updated));
    } catch (e) {
      console.log('Lỗi lưu lịch sử tìm kiếm');
    }
  };

  const clearAllRecentSearches = async () => {
    setRecentSearches([]);
    try {
      await AsyncStorage.removeItem('recent_searches');
    } catch (e) {
      console.log('Lỗi xóa lịch sử tìm kiếm');
    }
  };

  const removeSingleRecent = async (termToRemove) => {
    const updated = recentSearches.filter(item => item !== termToRemove);
    setRecentSearches(updated);
    try {
      await AsyncStorage.setItem('recent_searches', JSON.stringify(updated));
    } catch (e) {
      console.log('Lỗi xóa mục tìm kiếm');
    }
  };

  const executeSearch = async (term) => {
    const queryToSearch = term !== undefined ? term : searchQuery;
    if (!queryToSearch.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    saveRecentSearch(queryToSearch);

    try {
      const response = await fetchItems('', queryToSearch);
      if (response && response.success && Array.isArray(response.data)) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.log('Lỗi tìm kiếm món ăn:', error.message);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearText = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const renderFoodItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.foodCard}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('ProductDetail', { itemId: item.ma_mon_an, food: item })}
    >
      <View style={styles.foodEmojiContainer}>
        <Text style={styles.foodEmoji}>{item.hinh_anh || '🍔'}</Text>
      </View>
      <View style={styles.foodInfo}>
        <Text style={styles.foodName} numberOfLines={1}>{item.ten_mon}</Text>
        <Text style={styles.foodCategory}>{item.ten_danh_muc || 'Fast Food'}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.foodPrice}>
            {parseFloat(item.gia_ban).toLocaleString('vi-VN')} đ
          </Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ 4.8</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        {/* 1. Header & Thanh Search Bar chuẩn UX */}
        <View style={styles.headerContainer}>
          <Text style={styles.screenTitle}>Tìm kiếm món ngon 🔍</Text>
          
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên món ăn, danh mục..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              autoFocus={true}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text === '') handleClearText();
              }}
              onSubmitEditing={() => executeSearch(searchQuery)}
              returnKeyType="search"
            />
            {searchQuery !== '' && (
              <TouchableOpacity 
                style={styles.clearBtn} 
                onPress={handleClearText}
                activeOpacity={0.7}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 2. Nội dung chính */}
        <View style={styles.mainContent}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#00A896" />
              <Text style={styles.loadingText}>Đang tìm kiếm món ăn...</Text>
            </View>
          ) : hasSearched ? (
            searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.ma_mon_an.toString()}
                renderItem={renderFoodItem}
                contentContainerStyle={styles.resultsList}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              /* Component EmptyState tái sử dụng */
              <EmptyState
                icon="🍔"
                title="Không tìm thấy món ăn nào!"
                description={`Rất tiếc, chúng tôi không tìm thấy kết quả phù hợp cho "${searchQuery}". Hãy thử từ khóa khác nhé!`}
                buttonText="Xóa từ khóa & Tìm lại"
                onButtonPress={handleClearText}
              />
            )
          ) : (
            /* Khi chưa nhập từ khóa tìm kiếm: Hiển thị Tìm kiếm gần đây & Gợi ý */
            <View style={styles.suggestionsContainer}>
              {/* Lịch sử tìm kiếm gần đây */}
              {recentSearches.length > 0 && (
                <View style={styles.sectionBox}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>🕒 Tìm kiếm gần đây</Text>
                    <TouchableOpacity onPress={clearAllRecentSearches}>
                      <Text style={styles.clearAllText}>Xóa tất cả</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.chipsWrapper}>
                    {recentSearches.map((term, index) => (
                      <View key={index} style={styles.recentChip}>
                        <TouchableOpacity 
                          onPress={() => {
                            setSearchQuery(term);
                            executeSearch(term);
                          }}
                        >
                          <Text style={styles.recentChipText}>{term}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.chipRemoveBtn} 
                          onPress={() => removeSingleRecent(term)}
                        >
                          <Text style={styles.chipRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Gợi ý từ khóa phổ biến */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>🔥 Gợi ý món hot hôm nay</Text>
                <View style={styles.chipsWrapper}>
                  {POPULAR_KEYWORDS.map((keyword, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.popularChip}
                      onPress={() => {
                        setSearchQuery(keyword);
                        executeSearch(keyword);
                      }}
                    >
                      <Text style={styles.popularChipText}>{keyword}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* 3. Khung Bottom Navigation */}
        <BottomTabBar activeTab="Search" navigation={navigation} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    backgroundColor: '#00A896',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  clearBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  suggestionsContainer: {
    padding: 20,
  },
  sectionBox: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  clearAllText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  chipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recentChipText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  chipRemoveBtn: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRemoveText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: 'bold',
    marginTop: -1,
  },
  popularChip: {
    backgroundColor: '#E0F2F1',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  popularChipText: {
    fontSize: 13,
    color: '#00796B',
    fontWeight: '600',
  },
  resultsList: {
    padding: 16,
    paddingBottom: 24,
  },
  foodCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  foodEmojiContainer: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  foodEmoji: {
    fontSize: 32,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  foodCategory: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF5722',
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
});
