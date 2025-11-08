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
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { ProfileStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../styles/theme';
import { User } from '../../models/User';

type FollowersRouteProp = RouteProp<ProfileStackParamList, 'Followers'>;
type FollowersNavigationProp = StackNavigationProp<ProfileStackParamList, 'Followers'>;

const DEFAULT_AVATAR = 'https://via.placeholder.com/150';

const FollowersScreen: React.FC = () => {
  const { user } = useAuth();
  const route = useRoute<FollowersRouteProp>();
  const navigation = useNavigation<FollowersNavigationProp>();
  
  const { userId } = route.params;
  const [followers, setFollowers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchFollowers = async () => {
      try {
        setLoading(true);
        
        // ユーザーのフォロワーIDを取得
        const userDoc = await firestore().collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
          setError('ユーザーが見つかりませんでした');
          setLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        const followerIds = userData?.followers || [];
        
        if (followerIds.length === 0) {
          setFollowers([]);
          setLoading(false);
          return;
        }
        
        // フォロワーの詳細情報を取得
        const followerPromises = followerIds.map((id: string) => 
          firestore().collection('users').doc(id).get()
        );
        
        const followerDocs = await Promise.all(followerPromises);
        
        const followerData = followerDocs
          .filter(doc => doc.exists)
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              nickname: data?.nickname || 'Unknown',
              profilePhoto: data?.profilePhoto || DEFAULT_AVATAR,
              bio: data?.bio || '',
              prefecture: data?.prefecture || '',
              city: data?.city || '',
            } as User;
          });
        
        setFollowers(followerData);
      } catch (err) {
        console.error('Error fetching followers:', err);
        setError('フォロワーの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    fetchFollowers();
  }, [userId]);
  
  const navigateToProfile = (id: string) => {
    if (id === user?.id) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('UserProfile', { userId: id });
    }
  };
  
  const navigateToChat = (id: string, name: string) => {
    // チャットルームIDを生成（ユーザーIDをアルファベット順に並べて連結）
    const userIds = [user?.id, id].sort();
    const roomId = `${userIds[0]}_${userIds[1]}`;
    
    navigation.navigate('ChatRoom', { 
      roomId: roomId,
      otherUserId: id, 
      otherUserName: name 
    });
  };
  
  const renderItem = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.userCard}
      onPress={() => navigateToProfile(item.id)}
    >
      <Image source={{ uri: item.profilePhoto || DEFAULT_AVATAR }} style={styles.avatar} />
      
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.nickname}</Text>
        <Text style={styles.userBio} numberOfLines={1}>{item.bio || 'プロフィールはありません'}</Text>
        
        {item.prefecture && (
          <View style={styles.locationContainer}>
            <Icon name="location-outline" size={12} color={theme.colors.text.secondary} />
            <Text style={styles.locationText}>{item.prefecture}</Text>
          </View>
        )}
      </View>
      
      {/* フォローボタン */}
      <TouchableOpacity 
        style={styles.followButton}
        onPress={() => navigateToProfile(item.id)}
      >
        <Text style={styles.followButtonText}>詳細</Text>
      </TouchableOpacity>
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
  
  if (followers.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="people-outline" size={48} color={theme.colors.text.secondary} />
        <Text style={styles.emptyText}>フォロワーはいません</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <FlatList
        data={followers}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  userBio: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: 6,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
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
  },
});

export default FollowersScreen;
