import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { Circle } from '../../models/Circle';
import { calculateDistance } from '../../utils/locationUtils';
import { RouteProp } from '@react-navigation/native';
import { User } from '../../models/User';

type CirclesScreenNavigationProp = StackNavigationProp<DiscoverStackParamList, 'Discover' | 'Search'>;

type CirclesScreenRouteProp = RouteProp<
  {
    Discover: { refresh?: boolean; newCircleId?: string };
    Search: { filter: 'users' | 'circles' | 'events' };
  },
  'Discover' | 'Search'
>;

const DEFAULT_CIRCLE_IMAGE = 'https://via.placeholder.com/150';

const CATEGORIES = [
  { id: 'all', name: 'すべて' },
  { id: 'art', name: 'アート、クリエイティブ系' },
  { id: 'music', name: '音楽' },
  { id: 'sports', name: 'スポーツ、アウトドア' },
  { id: 'game', name: 'ゲーム、エンタメ系' },
  { id: 'food', name: '料理、グルメ' },
  { id: 'science', name: '科学、サイエンス' },
  { id: 'fashion', name: 'ファッション、美容' },
  { id: 'vehicle', name: '乗り物、コレクション' },
  { id: 'literature', name: '文学、言語' },
  { id: 'animal', name: 'ペット、動物' },
  { id: 'social', name: '社会、文化' },
  { id: 'business', name: '起業、イベント' },
];

interface CircleWithDistance extends Circle {
  distance: string;
  numericDistance: number;
}

const CirclesScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<CirclesScreenNavigationProp>();
  const route = useRoute<CirclesScreenRouteProp>();
  
  // パラメータの安全な取得
  const isSearchMode = route.name === 'Search';
  const refreshParam = route.params && 'refresh' in route.params ? route.params.refresh : false;
  const newCircleId = route.params && 'newCircleId' in route.params ? route.params.newCircleId : undefined;
  const filterParam = route.params && 'filter' in route.params ? route.params.filter : undefined;
  
  const [circles, setCircles] = useState<CircleWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [noMoreCircles, setNoMoreCircles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState(''); // 入力中のテキスト用
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // コンポーネントマウント状態の追跡用
  const isMounted = useRef(true);
  
  // クリーンアップ関数
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // fetchCircles関数を先に定義
  const fetchCircles = useCallback(async (isRefresh = false) => {
    if (!isMounted.current) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
        // リフレッシュ時は必ず配列をクリア
        setCircles([]);
      } else if (!loading) {
        setLoadingMore(true);
      }

      // サークルを取得するクエリを構築
      const circlesRef = firestore().collection('circles');
      
      // まず作成日順でソート
      let circlesQuery = circlesRef.orderBy('createdAt', 'desc');
      
      // カテゴリフィルター
      if (selectedCategory !== 'all') {
        circlesQuery = circlesQuery.where('categories', 'array-contains', selectedCategory);
      }
      
      // 検索フィルター (サークル名)
      if (searchQuery && searchQuery.trim() !== '') {
        // Firebaseは大文字小文字を区別する検索のため、簡易的な大文字小文字を区別しない検索
        const trimmedQuery = searchQuery.trim();
        const lowerQuery = trimmedQuery.toLowerCase();
        
        if (selectedCategory === 'all') {
          circlesQuery = circlesQuery.where('name', '>=', lowerQuery)
            .where('name', '<=', lowerQuery + '\uf8ff');
        }
      }
      
      // より少ない量のデータを取得（速度優先）
      circlesQuery = circlesQuery.limit(15);
      
      // ページネーション
      if (lastVisible && !isRefresh) {
        circlesQuery = circlesQuery.startAfter(lastVisible);
      }
      
      // Firestoreクエリを実行
      const snapshot = await circlesQuery.get();
      
      if (!isMounted.current) return;
      
      if (snapshot.empty) {
        if (isMounted.current) {
        setNoMoreCircles(true);
        setRefreshing(false);
        setLoading(false);
        setLoadingMore(false);
          setInitialLoadComplete(true);
        
          // リフレッシュの場合は空の配列をセット
          if (isRefresh) {
          setCircles([]);
          }
        }
        return;
      }
      
      // 最後の表示アイテムを設定
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (isMounted.current) {
        setLastVisible(lastDoc);
      }
      
      // サークルデータの処理と距離計算
      const circlesData = snapshot.docs.map(doc => {
        const data = doc.data();
        const circleData = { id: doc.id, ...data } as Circle;
          
          // ユーザーとサークルの距離を計算
          if (user?.location && circleData.location) {
            const distanceInKm = calculateDistance(
              user.location.latitude,
              user.location.longitude,
              circleData.location.latitude,
              circleData.location.longitude
            );
            
            // 距離表示用の文字列を作成
            let distanceStr;
            if (distanceInKm >= 1) {
              distanceStr = `${distanceInKm}km`;
            } else {
              // 1km未満はm表記
              const distanceInM = Math.round(distanceInKm * 1000);
              distanceStr = `${distanceInM}m`;
            }
            
            return {
              ...circleData,
              distance: distanceStr,
              numericDistance: distanceInKm
            };
          }
          
          return {
            ...circleData,
            distance: '',
            numericDistance: Number.MAX_VALUE
          } as CircleWithDistance;
        });
      
      // 新規作成されたサークルがある場合は追加
      let processedData = [...circlesData];
      if (newCircleId && !circlesData.some(c => c.id === newCircleId)) {
          try {
            const newCircleDoc = await firestore().collection('circles').doc(newCircleId).get();
            if (newCircleDoc.exists) {
              const newCircleData = { id: newCircleDoc.id, ...newCircleDoc.data() } as Circle;
            processedData.unshift({
                ...newCircleData,
                distance: '',
              numericDistance: 0
              } as CircleWithDistance);
            }
          } catch (error) {
          console.error('新規サークル取得エラー:', error);
        }
      }
      
      // ブロックフィルタリング
      const blockedByMeSet = user?.blockedUsers ? new Set(user.blockedUsers) : new Set();
      const filteredData = processedData.filter(circle => {
        // 新規サークルと自分のサークルは常に表示
        if ((newCircleId && circle.id === newCircleId) || circle.createdBy === user?.id) {
          return true;
        }
        return !blockedByMeSet.has(circle.createdBy);
      });
      
      if (!isMounted.current) return;
      
      // ステート更新
      if (isRefresh) {
        // 完全に置き換え
        setCircles(filteredData);
      } else {
        // 既存配列と結合して重複排除
        setCircles(prevCircles => {
          const circleMap = new Map();
          
          // 既存のサークルをマップに追加
          prevCircles.forEach(circle => {
            if (circle && circle.id) {
              circleMap.set(circle.id, circle);
            }
          });
          
          // 新しいサークルを追加または上書き
          filteredData.forEach(circle => {
            if (circle && circle.id) {
              circleMap.set(circle.id, circle);
            }
          });
          
          // マップから配列に変換
          return Array.from(circleMap.values());
        });
      }
      
      // その他のステートを更新
      setInitialLoadComplete(true);
      setNoMoreCircles(filteredData.length < 15);
      
    } catch (error) {
      console.error('サークル取得エラー:', error);
    } finally {
      if (isMounted.current) {
      setRefreshing(false);
      setLoading(false);
      setLoadingMore(false);
    }
    }
  }, [lastVisible, searchQuery, selectedCategory, user, newCircleId]);
  
  // 状態リセット関数
  const resetAndRefetch = useCallback(() => {
    if (!isMounted.current) return;
    
    // 状態をリセット
    setCircles([]);
    setLastVisible(null);
    setNoMoreCircles(false);
    setLoading(true);
    
    // 直接呼び出し
    fetchCircles(true);
  }, [fetchCircles]);
  
  // 初期ロード
  useEffect(() => {
    resetAndRefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // カテゴリ変更時にリセット
  useEffect(() => {
    if (initialLoadComplete) {
      resetAndRefetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);
  
  // 検索クエリ変更時にリセット
  useEffect(() => {
    if (initialLoadComplete && searchQuery) {
      resetAndRefetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);
  
  // refresh パラメータ変更時にリセット
  useEffect(() => {
    if (refreshParam) {
      resetAndRefetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshParam]);
  
  // 新規サークル作成時の処理
  useEffect(() => {
    if (newCircleId && circles.length > 0) {
      const newCircle = circles.find(c => c.id === newCircleId);
      if (newCircle) {
        setTimeout(() => {
          if (isMounted.current) {
            navigation.navigate('CircleDetails', { circleId: newCircleId });
          }
        }, 500);
      }
    }
  }, [newCircleId, circles, navigation]);
  
  const handleRefresh = () => {
    resetAndRefetch();
  };
  
  const handleLoadMore = () => {
    if (!loadingMore && !noMoreCircles && !loading) {
      fetchCircles();
    }
  };
  
  // カテゴリ選択
  const handleCategorySelect = (categoryId: string) => {
    if (categoryId === selectedCategory && categoryId !== 'all') {
      setSelectedCategory('all');
    } else {
      setSelectedCategory(categoryId);
    }
  };
  
  // カテゴリリストのメモ化レンダリング
  const renderCategoryItem = useCallback(({ item }: { item: typeof CATEGORIES[0] }) => {
    if (!item || !item.id) return null;
    
          const isSelected = selectedCategory === item.id;
    const categoryName = item.name || '';
          
          return (
            <TouchableOpacity
              style={[
                styles.categoryItem,
                isSelected && styles.selectedCategoryItem,
              ]}
              onPress={() => handleCategorySelect(item.id)}
            >
              {item.id !== 'all' && (
                <Icon 
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                  size={14} 
                  color={isSelected ? theme.colors.text.inverse : theme.colors.text.secondary}
                  style={styles.categoryIcon}
                />
              )}
              <Text
                style={[
                  styles.categoryItemText,
                  isSelected && styles.selectedCategoryItemText,
                ]}
              >
                {categoryName}
              </Text>
            </TouchableOpacity>
          );
  }, [selectedCategory]);
  
  // カテゴリタグのレンダリング（サークルカード内）
  const renderCategoryTag = useCallback((category: string, circleId: string, index: number) => {
    if (!category) return null;
    
    const categoryName = CATEGORIES.find(c => c.id === category)?.name || category;
    
    return (
      <View key={`${circleId}-tag-${category}`} style={styles.categoryTag}>
        <Text style={styles.categoryText}>{categoryName}</Text>
      </View>
    );
  }, []);
  
  // サークルアイテムのレンダリング
  const renderCircleItem = useCallback(({ item }: { item: CircleWithDistance }) => {
    if (!item || !item.id) return null;
    
    return (
      <TouchableOpacity
        style={styles.circleCard}
        onPress={() => navigation.navigate('CircleDetails', { circleId: item.id })}
      >
        <Image
          source={{ uri: item.icon || (item as any).iconUrl || DEFAULT_CIRCLE_IMAGE }}
          style={styles.circleIcon}
        />
        <View style={styles.circleInfo}>
          <View style={styles.circleNameContainer}>
            <Text style={styles.circleName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isPrivate && (
              <Icon name="lock-closed" size={14} color={theme.colors.text.secondary} style={styles.lockIcon} />
            )}
          </View>
          
          <View style={styles.categoryTags}>
            {item.categories && Array.isArray(item.categories) && 
              item.categories.slice(0, 2).map((category, index) => 
                renderCategoryTag(category, item.id, index)
              )
            }
          </View>
          
          <View style={styles.circleMetaInfo}>
            <View style={styles.metaItem}>
              <Icon name="people-outline" size={14} color={theme.colors.text.secondary} />
              <Text style={styles.metaText}>
                {(item.members && Array.isArray(item.members) ? item.members.length : 0)}人
              </Text>
            </View>
            
            {item.distance && (
              <View style={styles.metaItem}>
                <Icon name="location-outline" size={14} color={theme.colors.text.secondary} />
                <Text style={styles.metaText}>{item.distance}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);
  
  // カテゴリフィルターのレンダリング
  const renderCategoryFilter = useCallback(() => {
    if (!CATEGORIES || CATEGORIES.length === 0) return null;
    
    return (
      <View>
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => `cat-${item.id}`}
          style={styles.categoryList}
          renderItem={renderCategoryItem}
        />
        {selectedCategory !== 'all' && CATEGORIES.find(c => c.id === selectedCategory) && (
        <View style={styles.activeCategoryIndicator}>
          <Text style={styles.activeCategoryText}>
            フィルター: {CATEGORIES.find(c => c.id === selectedCategory)?.name}
          </Text>
        </View>
      )}
    </View>
  );
  }, [renderCategoryItem, selectedCategory]);

  const renderSearchInput = () => {
    if (!isSearchMode) {
      return (
        <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Search', { filter: 'circles' })}>
          <Icon name="search" size={20} color={theme.colors.text.secondary} />
          <Text style={styles.searchPlaceholder}>サークルを検索...</Text>
        </TouchableOpacity>
      );
    }
    
    return (
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={20} color={theme.colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="サークル名を入力..."
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            onSubmitEditing={() => setSearchQuery(searchInput)}
            autoFocus={isSearchMode && !searchQuery}
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput('')} style={styles.clearButton}>
              <Icon name="close-circle" size={18} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={() => setSearchQuery(searchInput)}>
          <Text style={styles.searchButtonText}>検索</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.emptyText}>サークルを読み込み中...</Text>
        </View>
      );
    }
    
    let emptyMessage = 'サークルがありません';
    
    if (searchQuery) {
      emptyMessage = 'お探しのサークルが見つかりませんでした';
    } else if (selectedCategory !== 'all') {
      // 選択されたカテゴリーの名前を取得
      const categoryName = CATEGORIES.find(c => c.id === selectedCategory)?.name || selectedCategory;
      emptyMessage = `「${categoryName}」のサークルが見つかりませんでした`;
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="people-outline" size={48} color={theme.colors.text.secondary} />
        <Text style={styles.emptyText}>{emptyMessage}</Text>
        <Text style={styles.emptySubText}>新しいサークルを作成してみませんか？</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('CreateCircle')}>
          <Text style={styles.createButtonText}>サークルを作成</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 検索バー */}
      {renderSearchInput()}
      
      {/* カテゴリフィルター */}
      {renderCategoryFilter()}
      
      {/* サークルリスト */}
      <FlatList
        data={circles}
        renderItem={renderCircleItem}
        keyExtractor={item => `circle-${item.id}`}
        numColumns={2}
        contentContainerStyle={[
          styles.circlesList,
          circles.length === 0 && { flexGrow: 1 }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={renderEmptyComponent}
        ListFooterComponent={loadingMore ? renderFooter : null}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        maxToRenderPerBatch={6}
        initialNumToRender={6}
        windowSize={5}
        removeClippedSubviews={true}
        extraData={selectedCategory}
      />
      
      {/* ローディングインジケーター */}
      {loading && !refreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
      
      {/* 作成ボタン */}
      {!isSearchMode && (
      <TouchableOpacity
        style={styles.fabButton}
          onPress={() => navigation.navigate('CreateCircle')}
      >
        <Icon name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchPlaceholder: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
  },
  categoryList: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  categoryItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedCategoryItem: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryItemText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  selectedCategoryItemText: {
    color: theme.colors.text.inverse,
  },
  circlesList: {
    padding: theme.spacing.md,
    paddingBottom: 80, // 下部ナビゲーションバーの高さ+余白
  },
  circleCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    margin: theme.spacing.xs,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    maxWidth: '47%',
    minHeight: 200,
  },
  circleIcon: {
    height: 100,
    width: '100%',
    resizeMode: 'cover',
    backgroundColor: '#E0E0E0',
  },
  circleInfo: {
    padding: theme.spacing.sm,
    flex: 1,
    justifyContent: 'space-between',
  },
  circleNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleName: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    height: 20,
  },
  categoryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
    minHeight: 20,
  },
  categoryTag: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    marginRight: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    maxWidth: '80%',
  },
  categoryText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  circleMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  metaText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.secondary,
    marginLeft: 2,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  emptySubText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignSelf: 'center',
    marginTop: theme.spacing.md,
  },
  createButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  footer: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  highlightedCircleCard: {
    backgroundColor: theme.colors.primary + '10',
  },
  highlightedText: {
    color: theme.colors.primary,
  },
  categoryIcon: {
    marginRight: theme.spacing.xs,
  },
  activeCategoryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    marginTop: -theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.primary + '10',
    borderRadius: theme.borderRadius.md,
  },
  activeCategoryText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  fabButton: {
    position: 'absolute',
    bottom: 80, // 下部ナビゲーションバーの高さ+余白
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000, // 他の要素より前面に表示
  },
  lockIcon: {
    marginLeft: theme.spacing.xs,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: theme.spacing.md,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.primary,
  },
  clearButton: {
    padding: theme.spacing.xs,
  },
  searchButton: {
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
  searchButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
});

export default CirclesScreen; 