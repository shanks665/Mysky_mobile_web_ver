import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { ProfileStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../styles/theme';
import { Circle } from '../../models/Circle';
import { User } from '../../models/User';

type MyCirclesRouteProp = RouteProp<ProfileStackParamList, 'MyCircles'>;
type MyCirclesNavigationProp = StackNavigationProp<ProfileStackParamList, 'MyCircles'>;

const DEFAULT_CIRCLE_ICON = 'https://via.placeholder.com/150';

const MyCirclesScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<MyCirclesNavigationProp>();
  const route = useRoute<MyCirclesRouteProp>();
  
  // ルートパラメータからユーザーIDを取得。なければ現在のユーザーのIDを使用
  const targetUserId = route.params?.userId || user?.id;
  const isOwnProfile = user?.id === targetUserId;
  
  console.log('MyCirclesScreen - ユーザーID:', {
    targetUserId,
    isOwnProfile,
    routeParams: route.params,
    currentUserId: user?.id
  });
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ユーザー情報を取得
  useEffect(() => {
    const fetchUserData = async () => {
      if (!targetUserId) return;
      
      try {
        const userDoc = await firestore().collection('users').doc(targetUserId).get();
        if (userDoc.exists) {
          setProfileUser({
            ...userDoc.data() as User,
            id: userDoc.id
          });
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    
    fetchUserData();
  }, [targetUserId]);

  useEffect(() => {
    const fetchCircles = async () => {
      if (!targetUserId) {
        console.log('❌ targetUserIdが未定義のため、サークル取得をスキップ');
        return;
      }
      
      console.log(`🔍 ユーザー(${targetUserId})のサークルを取得開始`);
      
      try {
        setLoading(true);
        
        // 指定されたユーザーが参加しているサークルを取得
        console.log(`📚 ユーザードキュメント取得: ${targetUserId}`);
        const userDoc = await firestore().collection('users').doc(targetUserId).get();
        
        if (!userDoc.exists) {
          console.log(`❌ ユーザードキュメント(${targetUserId})が存在しません`);
          setError('ユーザー情報が見つかりませんでした');
          setLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        const circleIds = userData?.circles || [];
        
        console.log(`📊 サークルIDs: ${circleIds.length}件`, circleIds);
        
        if (circleIds.length === 0) {
          console.log('🔍 サークルIDがないため、空のリストを設定');
          setCircles([]);
          setLoading(false);
          return;
        }

        // サークルIDが存在する場合、各サークルのデータを取得
        console.log(`🔄 ${circleIds.length}件のサークルデータを取得開始`);
        
        const circlePromises = circleIds.map((id: string) => 
          firestore().collection('circles').doc(id).get()
            .then(doc => {
              if (doc.exists) {
                return { id: doc.id, ...doc.data() } as Circle;
              }
              console.log(`⚠️ サークル(${id})が存在しません`);
              return null;
            })
            .catch(err => {
              console.error(`❌ サークル(${id})の取得エラー:`, err);
              return null;
            })
        );
        
        const circleResults = await Promise.all(circlePromises);
        const validCircles = circleResults.filter(circle => circle !== null) as Circle[];
        
        console.log(`✅ 有効なサークル: ${validCircles.length}件取得成功`);
        
        // 取得したサークルを設定
        setCircles(validCircles);
        setLoading(false);
        
        return; // ここで終了
      } catch (err) {
        console.error('Error fetching my circles:', err);
        setError('サークル情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCircles();
  }, [user, targetUserId]);
  
  const navigateToCircleDetails = (circleId: string) => {
    navigation.navigate('CircleDetails', { circleId: circleId });
  };
  
  const renderItem = ({ item }: { item: Circle }) => (
    <TouchableOpacity 
      style={styles.circleCard}
      onPress={() => navigateToCircleDetails(item.id)}
    >
      <View style={styles.circleHeader}>
        <Image source={{ uri: item.icon || DEFAULT_CIRCLE_ICON }} style={styles.circleIcon} />
        
        <View style={styles.circleHeaderInfo}>
          <Text style={styles.circleName}>{item.name}</Text>
          
          <View style={styles.circleCategories}>
            {item.isPrivate && (
              <View style={styles.categoryTag}>
                <Icon name="lock-closed-outline" size={12} color="#FF6B6B" />
                <Text style={[styles.categoryTagText, {color: '#FF6B6B'}]}>非公開</Text>
              </View>
            )}
            
            {item.categories && item.categories.length > 0 && (
              <View style={styles.categoryTag}>
                <Icon name="pricetag-outline" size={12} color={theme.colors.primary} />
                <Text style={styles.categoryTagText}>{item.categories[0]}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      <Text style={styles.circleDescription} numberOfLines={2}>
        {item.description || 'サークルの説明はありません'}
      </Text>
      
      <View style={styles.circleFooter}>
        <View style={styles.statItem}>
          <Icon name="people-outline" size={14} color={theme.colors.text.secondary} />
          <Text style={styles.statText}>{item.members.length}人</Text>
        </View>
        
        <View style={styles.joinButtonContainer}>
          <Text style={styles.joinButtonText}>詳細を見る</Text>
          <Icon name="chevron-forward" size={14} color={theme.colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
  
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle-outline" size={48} color={theme.colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  
  if (circles.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="people-circle-outline" size={48} color={theme.colors.text.secondary} />
        <Text style={styles.emptyText}>
          {isOwnProfile 
            ? '参加しているサークルはありません' 
            : `${profileUser?.nickname || 'このユーザー'}は参加しているサークルがありません`}
        </Text>
        {isOwnProfile && (
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateCircle')}
          >
            <Text style={styles.createButtonText}>サークルを作成する</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <FlatList
        data={circles}
        renderItem={renderItem}
        keyExtractor={item => `my-circle-${item.id}`}
        contentContainerStyle={styles.listContent}
      />
      
      {isOwnProfile && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('CreateCircle')}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 12,
  },
  circleCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  circleHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  circleIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  circleHeaderInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  circleName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 6,
  },
  circleCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f5ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  categoryTagText: {
    fontSize: 11,
    color: theme.colors.primary,
    marginLeft: 4,
  },
  circleDescription: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  circleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  joinButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
    marginRight: 2,
  },
  errorText: {
    marginTop: 8,
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 16,
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
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});

export default MyCirclesScreen;
