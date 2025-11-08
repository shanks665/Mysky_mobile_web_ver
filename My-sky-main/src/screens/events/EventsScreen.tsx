import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { EventsStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';

type EventsNavigationProp = StackNavigationProp<EventsStackParamList, 'Events'>;

const DEFAULT_COVER_IMAGE = 'https://via.placeholder.com/800x300';
const { width } = Dimensions.get('window');

type TabType = 'all' | 'participating';

// ジャンルのカテゴリーリスト
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

// 都道府県リスト（簡易版）
const PREFECTURES = [
  { id: 'all', name: 'すべて' },
  { id: 'hokkaido', name: '北海道' },
  { id: 'aomori', name: '青森県' },
  { id: 'iwate', name: '岩手県' },
  { id: 'miyagi', name: '宮城県' },
  { id: 'akita', name: '秋田県' },
  { id: 'yamagata', name: '山形県' },
  { id: 'fukushima', name: '福島県' },
  { id: 'ibaraki', name: '茨城県' },
  { id: 'tochigi', name: '栃木県' },
  { id: 'gunma', name: '群馬県' },
  { id: 'saitama', name: '埼玉県' },
  { id: 'chiba', name: '千葉県' },
  { id: 'tokyo', name: '東京都' },
  { id: 'kanagawa', name: '神奈川県' },
  { id: 'niigata', name: '新潟県' },
  { id: 'toyama', name: '富山県' },
  { id: 'ishikawa', name: '石川県' },
  { id: 'fukui', name: '福井県' },
  { id: 'yamanashi', name: '山梨県' },
  { id: 'nagano', name: '長野県' },
  { id: 'gifu', name: '岐阜県' },
  { id: 'shizuoka', name: '静岡県' },
  { id: 'aichi', name: '愛知県' },
  { id: 'mie', name: '三重県' },
  { id: 'shiga', name: '滋賀県' },
  { id: 'kyoto', name: '京都府' },
  { id: 'osaka', name: '大阪府' },
  { id: 'hyogo', name: '兵庫県' },
  { id: 'nara', name: '奈良県' },
  { id: 'wakayama', name: '和歌山県' },
  { id: 'tottori', name: '鳥取県' },
  { id: 'shimane', name: '島根県' },
  { id: 'okayama', name: '岡山県' },
  { id: 'hiroshima', name: '広島県' },
  { id: 'yamaguchi', name: '山口県' },
  { id: 'tokushima', name: '徳島県' },
  { id: 'kagawa', name: '香川県' },
  { id: 'ehime', name: '愛媛県' },
  { id: 'kochi', name: '高知県' },
  { id: 'fukuoka', name: '福岡県' },
  { id: 'saga', name: '佐賀県' },
  { id: 'nagasaki', name: '長崎県' },
  { id: 'kumamoto', name: '熊本県' },
  { id: 'oita', name: '大分県' },
  { id: 'miyazaki', name: '宮崎県' },
  { id: 'kagoshima', name: '鹿児島県' },
  { id: 'okinawa', name: '沖縄県' },
];

const EventsScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<EventsNavigationProp>();
  
  const [events, setEvents] = useState<any[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPrefecture, setSelectedPrefecture] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // イベントデータの取得
  const fetchEvents = useCallback(async (refresh = false, tab: TabType = activeTab) => {
    try {
      if (refresh) {
        setLoading(true);
        setLastVisible(null);
      }
      
      // 現在の日時を取得
      const now = new Date();
      
      console.log(`[DEBUG] フィルター状態: カテゴリー=${selectedCategory}, 都道府県=${selectedPrefecture}, タブ=${tab}`);
      
      // クエリの作成
      let query: any;
      let needsClientSideFiltering = false;
      let queryDescription = 'ベースクエリのみ';
      
      // ベースクエリを作成
      // まずはタブによる基本クエリ
      if (tab === 'participating' && user) {
        // 参加中のイベントのみ取得
        query = firestore()
          .collection('events')
          .where('attendees', 'array-contains', user.id);
        queryDescription = '参加中イベント';
      } else {
        // 全イベント表示
        query = firestore()
          .collection('events');
        queryDescription = '全イベント';
      }

      // フィルタリング条件を適用
      if (selectedCategory !== 'all' && selectedPrefecture === 'all') {
        // カテゴリーのみフィルター
        if (tab !== 'participating') {
          // 参加中でないなら直接クエリに適用
          query = query.where('categories', 'array-contains', selectedCategory);
          queryDescription += ' + カテゴリーフィルター';
        } else {
          // 参加中ならクライアント側でフィルタリング
          needsClientSideFiltering = true;
          queryDescription += ' + カテゴリー(クライアント側)';
        }
      } else if (selectedPrefecture !== 'all' && selectedCategory === 'all') {
        // 都道府県のみフィルター
        query = query.where('prefecture', '==', selectedPrefecture);
        queryDescription += ' + 都道府県フィルター';
      } else if (selectedCategory !== 'all' && selectedPrefecture !== 'all') {
        // カテゴリーと都道府県の複合フィルター
        // Firestoreは同一クエリで配列含有(array-contains)と等値演算子を組み合わせられないため
        // 都道府県でフィルターしてからクライアント側でカテゴリーをフィルタリング
        query = query.where('prefecture', '==', selectedPrefecture);
        needsClientSideFiltering = true;
        queryDescription += ' + 都道府県 + カテゴリー(クライアント側)';
      }
      
      // 共通の並び順
      query = query.orderBy('startDate', 'asc');
      
      // 件数制限を適用
      query = query.limit(10);
      
      // 続きを読み込む場合は、前回の最後の要素から取得
      if (lastVisible && !refresh) {
        query = query.startAfter(lastVisible);
        queryDescription += ' + 前回以降';
      }
      
      console.log(`[DEBUG] 実行クエリ: ${queryDescription}`);
      
      // クエリ実行
      const snapshot = await query.get();
      console.log(`[DEBUG] クエリ結果件数: ${snapshot.docs.length}`);
      
      // これ以上データがあるかどうか
      if (snapshot.docs.length < 10) {
        setHasMoreEvents(false);
      } else {
        setHasMoreEvents(true);
        // 最後のドキュメントを保存
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
      
      let fetchedEvents = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // FirestoreのTimestampをDateに変換
          startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        };
      });
      
      console.log(`[DEBUG] 基本クエリ後のイベント数: ${fetchedEvents.length}`);
      
      // クライアント側でのフィルタリング
      if (needsClientSideFiltering) {
        const beforeFilterCount = fetchedEvents.length;
        
        // カテゴリーフィルター（カテゴリが選択されている場合）
        if (selectedCategory !== 'all') {
          fetchedEvents = fetchedEvents.filter((event: any) => 
            event.categories && Array.isArray(event.categories) && event.categories.includes(selectedCategory)
          );
          console.log(`[DEBUG] カテゴリーフィルター後: ${fetchedEvents.length}/${beforeFilterCount}`);
        }
        
        // 都道府県フィルター（都道府県が選択されている場合）
        if (selectedPrefecture !== 'all') {
          const beforePrefFilter = fetchedEvents.length;
          fetchedEvents = fetchedEvents.filter((event: any) => 
            event.prefecture === selectedPrefecture
          );
          console.log(`[DEBUG] 都道府県フィルター後: ${fetchedEvents.length}/${beforePrefFilter}`);
        }
      }
      
      console.log(`[DEBUG] 最終的なイベント数: ${fetchedEvents.length}`);
      
      if (refresh) {
        setEvents(fetchedEvents);
        setFilteredEvents(fetchedEvents);
      } else {
        // 重複を排除してイベントを追加
        const existingIds = new Set(events.map((event: any) => event.id));
        const newEvents = fetchedEvents.filter((event: any) => !existingIds.has(event.id));
        
        setEvents(prev => [...prev, ...newEvents]);
        setFilteredEvents(prev => [...prev, ...newEvents]);
      }
      
      // 最終的なフィルタリングとして重複排除（完全にクリーンなデータを保証）
      setTimeout(() => {
        setEvents(current => {
          // 一意のIDのマップを作成
          const uniqueEvents = new Map();
          
          // 後のイベントが前のイベントを上書き（新しい情報を優先）
          current.forEach(event => {
            if (event && event.id) {
              uniqueEvents.set(event.id, event);
            }
          });
          
          // マップを配列に戻す
          const result = Array.from(uniqueEvents.values());
          setFilteredEvents(result);
          return result;
        });
      }, 0);
      
      // イベントが0件の場合、テストデータを作成して表示
      if (fetchedEvents.length === 0 && refresh && tab === 'all' && selectedCategory === 'all' && selectedPrefecture === 'all') {
        await createTestEventsIfNeeded();
      }
      
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [lastVisible, activeTab, user, selectedCategory, selectedPrefecture, events]);
  
  // テストイベントデータの作成
  const createTestEventsIfNeeded = async () => {
    try {
      // 既存のイベント数を確認
      const eventsSnapshot = await firestore().collection('events').limit(1).get();
      
      // イベントがすでに存在する場合は作成しない
      if (!eventsSnapshot.empty) {
        console.log('既存のイベントが見つかりました。テストデータは作成しません。');
        return;
      }
      
      console.log('テストイベントを作成します');
      
      // サークル情報を取得または作成
      let circleId = '';
      const circlesSnapshot = await firestore().collection('circles').limit(1).get();
      
      if (circlesSnapshot.empty) {
        // サークルがなければ作成しない
        console.log('サークルが見つかりません。テストデータは作成しません。');
        return;
      } else {
        circleId = circlesSnapshot.docs[0].id;
      }
      
      // テストイベントを作成
      const timestamp = Date.now();
      const testEvents = [
        {
          id: `test-event-${timestamp}-1`,
          title: '新年会',
          description: '新年を祝うパーティーです。皆さんの参加をお待ちしています！',
          locationName: '東京都渋谷区',
          prefecture: 'tokyo',
          city: 'shibuya',
          categories: ['food', 'social'],
          startDate: firestore.Timestamp.fromDate(new Date(Date.now() + 86400000 * 7)), // 7日後
          attendees: user ? [user.id] : [],
          pendingAttendees: [],
          circleId,
          isPrivate: false,
          requiresApproval: false,
          createdBy: user ? user.id : 'system',
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          coverPhoto: 'https://via.placeholder.com/800x300?text=新年会',
        },
        {
          id: `test-event-${timestamp}-2`,
          title: '花見イベント',
          description: '桜の花見イベントです。お弁当を持ってきてください。',
          locationName: '上野公園',
          prefecture: 'tokyo',
          city: 'taito',
          categories: ['social', 'sports'],
          startDate: firestore.Timestamp.fromDate(new Date(Date.now() + 86400000 * 14)), // 14日後
          attendees: user ? [user.id] : [],
          pendingAttendees: [],
          circleId,
          isPrivate: false,
          requiresApproval: false,
          createdBy: user ? user.id : 'system',
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          coverPhoto: 'https://via.placeholder.com/800x300?text=花見',
        },
        {
          id: `test-event-${timestamp}-3`,
          title: 'プログラミング勉強会',
          description: 'ReactとReact Nativeの勉強会です。初心者歓迎！',
          locationName: 'オンライン',
          prefecture: 'online',
          categories: ['science', 'social'],
          startDate: firestore.Timestamp.fromDate(new Date(Date.now() + 86400000 * 3)), // 3日後
          attendees: user ? [user.id] : [],
          pendingAttendees: [],
          circleId,
          isPrivate: false,
          requiresApproval: false,
          createdBy: user ? user.id : 'system',
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          coverPhoto: 'https://via.placeholder.com/800x300?text=プログラミング',
        },
        {
          id: `test-event-${timestamp}-4`,
          title: 'スポーツ交流会',
          description: 'バスケットボールやフットサルなど、様々なスポーツを楽しみましょう！',
          locationName: '代々木公園',
          prefecture: 'tokyo',
          city: 'shibuya',
          categories: ['sports'],
          startDate: firestore.Timestamp.fromDate(new Date(Date.now() + 86400000 * 10)), // 10日後
          attendees: user ? [user.id] : [],
          pendingAttendees: [],
          circleId,
          isPrivate: false,
          requiresApproval: false,
          createdBy: user ? user.id : 'system',
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          coverPhoto: 'https://via.placeholder.com/800x300?text=スポーツ',
        },
      ];
      
      // サンプルイベントとして直接表示
      setEvents(testEvents);
      setFilteredEvents(testEvents);
      
      // データベースへの保存は非同期で行い、UIをブロックしない
      setTimeout(() => {
        try {
          // イベントをFirestoreに追加
          const batch = firestore().batch();
          for (const event of testEvents) {
            // 既に設定したIDを使用
            const eventRef = firestore().collection('events').doc(event.id);
            // IDフィールドを削除してからセット
            const { id, ...eventWithoutId } = event;
            batch.set(eventRef, eventWithoutId);
          }
          
          batch.commit().then(() => {
            console.log('テストイベントを作成しました');
            fetchEvents(true, 'all');
          });
        } catch (error) {
          console.error('Error saving test events:', error);
        }
      }, 100);
    } catch (error) {
      console.error('Error creating test events:', error);
    }
  };
  
  // タブ切り替え
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setLastVisible(null);
    setHasMoreEvents(true);
    setEvents([]);
    setFilteredEvents([]);
    setLoading(true);
    setSelectedCategory('all'); // タブ切り替え時にフィルターをリセット
    setSelectedPrefecture('all');
    fetchEvents(true, tab);
  };
  
  // カテゴリー選択
  const handleCategorySelect = (categoryId: string) => {
    // 選択した状態を保存
    const newCategory = categoryId === selectedCategory ? 'all' : categoryId;
    
    console.log(`[DEBUG] カテゴリー選択: ${newCategory}`);
    
    // 状態を更新
    setSelectedCategory(newCategory);
    setLastVisible(null);
    setHasMoreEvents(true);
    setLoading(true);
    
    // 直接検索を実行
    executeFilteredSearch(newCategory, selectedPrefecture);
  };
  
  // 都道府県選択
  const handlePrefectureSelect = (prefectureId: string) => {
    // 選択した状態を保存
    const newPrefecture = prefectureId === selectedPrefecture ? 'all' : prefectureId;
    
    console.log(`[DEBUG] 都道府県選択: ${newPrefecture}`);
    
    // 状態を更新
    setSelectedPrefecture(newPrefecture);
    setLastVisible(null);
    setHasMoreEvents(true);
    setLoading(true);
    
    // 直接検索を実行
    executeFilteredSearch(selectedCategory, newPrefecture);
  };
  
  // フィルター検索を実行する共通関数
  const executeFilteredSearch = async (category: string, prefecture: string) => {
    console.log(`[DEBUG] フィルター検索実行: カテゴリー=${category}, 都道府県=${prefecture}`);
    
    try {
      // ベースクエリを作成
      let query: any;
      if (activeTab === 'participating' && user) {
        query = firestore()
          .collection('events')
          .where('attendees', 'array-contains', user.id);
      } else {
        query = firestore().collection('events');
      }

      // フィルタリング条件を適用
      let needsClientSideFiltering = false;
      
      // カテゴリーと都道府県のフィルタリングロジック
      if (category !== 'all' && prefecture === 'all') {
        // カテゴリーのみフィルター
        if (activeTab !== 'participating') {
          query = query.where('categories', 'array-contains', category);
        } else {
          needsClientSideFiltering = true;
        }
      } else if (prefecture !== 'all' && category === 'all') {
        // 都道府県のみフィルター
        query = query.where('prefecture', '==', prefecture);
      } else if (category !== 'all' && prefecture !== 'all') {
        // 複合フィルター: 都道府県でフィルターしてからクライアント側でカテゴリーをフィルタリング
        query = query.where('prefecture', '==', prefecture);
        needsClientSideFiltering = true;
      }
      
      console.log(`[DEBUG] 作成クエリ: カテゴリー=${category}, 都道府県=${prefecture}, クライアント側フィルタリング=${needsClientSideFiltering}`);
      
      // 共通の並び順と件数制限
      query = query.orderBy('startDate', 'asc').limit(10);
      
      const snapshot = await query.get();
      console.log(`[DEBUG] クエリ結果件数: ${snapshot.docs.length}`);
      
      let fetchedEvents = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        };
      });
      
      // クライアント側でのフィルタリング
      if (needsClientSideFiltering) {
        const beforeFilterCount = fetchedEvents.length;
        
        // カテゴリーフィルター（カテゴリが選択されている場合）
        if (category !== 'all') {
          fetchedEvents = fetchedEvents.filter((event: any) => 
            event.categories && Array.isArray(event.categories) && event.categories.includes(category)
          );
          console.log(`[DEBUG] カテゴリーフィルター後: ${fetchedEvents.length}/${beforeFilterCount}`);
        }
      }
      
      // 検索クエリを適用
      if (searchQuery.trim()) {
        const searchQueryLower = searchQuery.toLowerCase().trim();
        fetchedEvents = fetchedEvents.filter((event: any) => 
          (event.title && event.title.toLowerCase().includes(searchQueryLower)) ||
          (event.description && event.description.toLowerCase().includes(searchQueryLower))
        );
      }
      
      console.log(`[DEBUG] 最終的なイベント数: ${fetchedEvents.length}`);
      
      // 更新
      setEvents(fetchedEvents);
      setFilteredEvents(fetchedEvents);
      
      if (snapshot.docs.length < 10) {
        setHasMoreEvents(false);
      } else {
        setHasMoreEvents(true);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
      
    } catch (error) {
      console.error('Error fetching filtered events:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 初回ロード時とリフレッシュ時にイベントを取得
  useEffect(() => {
    // アンマウント時のキャンセル用フラグ
    let isMounted = true;
    
    const loadEvents = async () => {
      try {
        await fetchEvents(true);
      } catch (error) {
        console.error('Error loading events:', error);
      }
    };
    
    loadEvents();
    
    // クリーンアップ関数
    return () => {
      isMounted = false;
    };
  }, []); // 依存配列から fetchEvents を削除して無限ループを防止
  
  // サークル詳細画面に遷移
  const navigateToCircleDetails = (circleId: string) => {
    navigation.navigate('CircleDetails', { circleId });
  };
  
  // イベント詳細画面に遷移
  const navigateToEventDetails = (eventId: string) => {
    navigation.navigate('EventDetails', { eventId });
  };
  
  // リフレッシュ処理
  const handleRefresh = () => {
    setRefreshing(true);
    fetchEvents(true);
  };
  
  // 続きを読み込む処理
  const handleLoadMore = () => {
    if (hasMoreEvents && !loadingMore) {
      setLoadingMore(true);
      fetchEvents();
    }
  };
  
  // 検索クエリの変更のみを処理
  const handleSearchInputChange = (text: string) => {
    setSearchQuery(text);
  };
  
  // 検索処理を改善
  const handleSearch = async () => {
    console.log('[DEBUG] 検索実行:', searchQuery);
    setLoading(true);
    
    // 現在のフィルター条件で検索
    executeFilteredSearch(selectedCategory, selectedPrefecture);
  };
  
  // 検索クリア
  const clearSearch = () => {
    setSearchQuery('');
    setFilteredEvents(events);
  };
  
  // イベントカードのレンダリング
  const renderEventCard = ({ item, index }: { item: any, index: number }) => {
    // 日付フォーマット
    const formattedDate = format(
      new Date(item.startDate),
      'yyyy年MM月dd日(E)',
      { locale: ja }
    );
    
    // 時間フォーマット
    const formattedTime = format(
      new Date(item.startDate),
      'HH:mm',
      { locale: ja }
    );
    
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigateToEventDetails(item.id)}
        key={`event-${item.id}-${index}`}
      >
        <Image
          source={{ uri: item.coverPhoto || DEFAULT_COVER_IMAGE }}
          style={styles.eventImage}
        />
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>
          
          <View style={styles.eventMeta}>
            <View style={styles.eventMetaItem}>
              <Icon name="calendar-outline" size={14} color={theme.colors.text.secondary} />
              <Text style={styles.eventMetaText}>{formattedDate}</Text>
            </View>
            <View style={styles.eventMetaItem}>
              <Icon name="time-outline" size={14} color={theme.colors.text.secondary} />
              <Text style={styles.eventMetaText}>{formattedTime}</Text>
            </View>
          </View>
          
          <View style={styles.eventMetaRow}>
            <View style={styles.eventMetaItem}>
              <Icon name="people-outline" size={14} color={theme.colors.text.secondary} />
              <Text style={styles.eventMetaText}>
                {item.attendees ? item.attendees.length : 0}人
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  // タブバーのレンダリング
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'all' && styles.activeTabButton]}
        onPress={() => handleTabChange('all')}
      >
        <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
          すべて表示
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'participating' && styles.activeTabButton]}
        onPress={() => handleTabChange('participating')}
      >
        <Text style={[styles.tabText, activeTab === 'participating' && styles.activeTabText]}>
          参加中
        </Text>
      </TouchableOpacity>
    </View>
  );
  
  // フッターの表示（読み込み中の表示）
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.footerText}>イベントを読み込み中...</Text>
      </View>
    );
  };
  
  // イベントが空の場合の表示
  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>
            {searchQuery ? '検索中...' : 'イベント読み込み中...'}
          </Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="calendar-outline" size={48} color={theme.colors.text.secondary} />
        <Text style={styles.emptyText}>
          {searchQuery ? '検索結果はありません' : 'イベントはまだありません'}
        </Text>
        {!searchQuery && (
          <TouchableOpacity
            style={styles.createEventButton}
            onPress={() => {
              // サークル選択画面に遷移する処理
              // 現在はサークル選択なしにイベント作成はできないため、既存のサークルIDを取得
              firestore().collection('circles').limit(1).get().then(snapshot => {
                if (!snapshot.empty) {
                  const circleId = snapshot.docs[0].id;
                  navigation.navigate('CircleDetails', { circleId });
                } else {
                  // サークルがない場合、サークル作成へ
                  navigation.navigate('CreateCircle' as any);
                }
              });
            }}
          >
            <Icon name="add-circle-sharp" size={18} color="#FFF" style={{marginRight: 5}} />
            <Text style={styles.createEventButtonText}>
              イベントを作成する
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  // カテゴリーフィルターの表示
  const renderCategoryFilter = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterButtonsContainer}
    >
      {CATEGORIES.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.filterButton,
            selectedCategory === category.id && styles.filterButtonActive
          ]}
          onPress={() => handleCategorySelect(category.id)}
        >
          <Text 
            style={[
              styles.filterButtonText,
              selectedCategory === category.id && styles.filterButtonTextActive
            ]}
          >
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
  
  // 都道府県フィルターの表示
  const renderPrefectureFilter = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterButtonsContainer}
    >
      {PREFECTURES.map((prefecture) => (
        <TouchableOpacity
          key={prefecture.id}
          style={[
            styles.filterButton,
            selectedPrefecture === prefecture.id && styles.filterButtonActive
          ]}
          onPress={() => handlePrefectureSelect(prefecture.id)}
        >
          <Text 
            style={[
              styles.filterButtonText,
              selectedPrefecture === prefecture.id && styles.filterButtonTextActive
            ]}
          >
            {prefecture.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
  
  // フィルターボタン
  const renderFilterButton = () => (
    <TouchableOpacity 
      style={styles.filterToggleButton}
      onPress={() => setShowFilters(!showFilters)}
    >
      <Icon name={showFilters ? "chevron-up-outline" : "chevron-down-outline"} size={20} color={theme.colors.primary} />
      <Text style={styles.filterToggleText}>
        {showFilters ? 'フィルターを隠す' : 'フィルターを表示'}
      </Text>
    </TouchableOpacity>
  );
  
  // 「すべて表示」ボタンの処理（カテゴリー）
  const handleResetCategory = () => {
    if (selectedCategory !== 'all') {
      console.log('[DEBUG] カテゴリーをリセット');
      setSelectedCategory('all');
      setLastVisible(null);
      setHasMoreEvents(true);
      setLoading(true);
      
      // カテゴリーをリセットして検索
      executeFilteredSearch('all', selectedPrefecture);
    }
  };

  // 「すべて表示」ボタンの処理（都道府県）
  const handleResetPrefecture = () => {
    if (selectedPrefecture !== 'all') {
      console.log('[DEBUG] 都道府県をリセット');
      setSelectedPrefecture('all');
      setLastVisible(null);
      setHasMoreEvents(true);
      setLoading(true);
      
      // 都道府県をリセットして検索
      executeFilteredSearch(selectedCategory, 'all');
    }
  };

  // 「すべてクリア」ボタンの処理
  const handleResetAllFilters = () => {
    if (selectedCategory !== 'all' || selectedPrefecture !== 'all') {
      console.log('[DEBUG] すべてのフィルターをリセット');
      setSelectedCategory('all');
      setSelectedPrefecture('all');
      setLastVisible(null);
      setHasMoreEvents(true);
      setLoading(true);
      
      // すべてのフィルターをリセットして検索
      executeFilteredSearch('all', 'all');
    }
  };

  return (
    <View style={styles.container}>
      {/* ヘッダーは削除して検索バーと統合 */}
      
      {/* 検索バー */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color={theme.colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="イベントを検索"
            value={searchQuery}
            onChangeText={handleSearchInputChange}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Icon name="close-circle" size={18} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.searchButton} 
          onPress={handleSearch}
        >
          <Text style={styles.searchButtonText}>検索</Text>
        </TouchableOpacity>
      </View>
      
      {/* タブバー */}
      {renderTabs()}

      {/* フィルターボタン */}
      {renderFilterButton()}
      
      {/* フィルターセクション - 表示/非表示の切り替え */}
      {showFilters && (
        <>
          {/* カテゴリーフィルター */}
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>ジャンルで絞り込み</Text>
              <TouchableOpacity onPress={handleResetCategory}>
                <Text style={styles.filterReset}>すべて表示</Text>
              </TouchableOpacity>
            </View>
            {renderCategoryFilter()}
          </View>
          
          {/* 都道府県フィルター */}
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>開催地域で絞り込み</Text>
              <TouchableOpacity onPress={handleResetPrefecture}>
                <Text style={styles.filterReset}>すべて表示</Text>
              </TouchableOpacity>
            </View>
            {renderPrefectureFilter()}
          </View>
        </>
      )}

      {/* 現在のフィルター状態の表示 */}
      {(selectedCategory !== 'all' || selectedPrefecture !== 'all') && (
        <View style={styles.activeFiltersContainer}>
          <Text style={styles.activeFiltersText}>
            現在の絞り込み:
            {selectedCategory !== 'all' && ` ${CATEGORIES.find(c => c.id === selectedCategory)?.name}`}
            {selectedCategory !== 'all' && selectedPrefecture !== 'all' && ' + '}
            {selectedPrefecture !== 'all' && ` ${PREFECTURES.find(p => p.id === selectedPrefecture)?.name}`}
          </Text>
          <TouchableOpacity 
            style={styles.clearFiltersButton}
            onPress={handleResetAllFilters}
          >
            <Text style={styles.clearFiltersText}>すべてクリア</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* イベントリスト */}
      <FlatList
        data={filteredEvents}
        renderItem={renderEventCard}
        keyExtractor={(item, index) => `event-${item.id}-${index}`}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyComponent}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  searchButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: theme.colors.primary,
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterToggleText: {
    marginLeft: 4,
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  filterSection: {
    padding: 8,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  filterReset: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  filterButtonsContainer: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  filterButtonTextActive: {
    color: theme.colors.text.inverse,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  activeFiltersText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  clearFiltersButton: {
    padding: 4,
  },
  clearFiltersText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    flexGrow: 1,
  },
  eventCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  eventImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  eventInfo: {
    padding: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  eventMeta: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  eventMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  eventMetaText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  footerContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: 24,
  },
  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createEventButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
});

export default EventsScreen; 