import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { User } from '../../models/User';

type LikesListScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'LikesList'>;
type LikesListScreenRouteProp = RouteProp<HomeStackParamList, 'LikesList'>;

const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';

interface UserWithFollowStatus extends User {
  isFollowing: boolean;
}

const LikesListScreen: React.FC = () => {
  const { user: currentUser, followUser, unfollowUser } = useAuth();
  const navigation = useNavigation<LikesListScreenNavigationProp>();
  const route = useRoute<LikesListScreenRouteProp>();
  
  const { postId } = route.params;
  
  const [users, setUsers] = useState<UserWithFollowStatus[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchLikes = useCallback(async () => {
    try {
      setLoading(true);
      
      // 投稿を取得
      const postDoc = await firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        Alert.alert('エラー', '投稿が見つかりませんでした');
        navigation.goBack();
        return;
      }
      
      const postData = postDoc.data();
      const likeUserIds = postData?.likes || [];
      
      if (likeUserIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }
      
      // いいねしたユーザーの情報を取得
      const usersData = await Promise.all(
        likeUserIds.map(async (userId: string) => {
          const userDoc = await firestore().collection('users').doc(userId).get();
          
          if (!userDoc.exists) {
            return null;
          }
          
          const userData = { id: userDoc.id, ...userDoc.data() } as User;
          
          // フォロー状態を確認
          const isFollowing = currentUser
            ? currentUser.following.includes(userId)
            : false;
          
          return {
            ...userData,
            isFollowing,
          };
        })
      );
      
      // nullを除外
      setUsers(usersData.filter(Boolean) as UserWithFollowStatus[]);
    } catch (error) {
      console.error('Error fetching likes:', error);
      Alert.alert('エラー', 'いいねの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [postId, currentUser, navigation]);
  
  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);
  
  const handleFollowToggle = async (userId: string, isFollowing: boolean) => {
    if (!currentUser) {
      Alert.alert('エラー', 'ログインしてください');
      return;
    }
    
    try {
      if (isFollowing) {
        await unfollowUser(userId);
      } else {
        await followUser(userId);
      }
      
      // ローカルの状態を更新
      setUsers((prev) =>
        prev.map((user) => {
          if (user.id === userId) {
            return {
              ...user,
              isFollowing: !isFollowing,
            };
          }
          return user;
        })
      );
    } catch (error) {
      console.error('Failed to toggle follow status:', error);
      Alert.alert('エラー', 'フォロー操作に失敗しました');
    }
  };
  
  const renderUserItem = ({ item }: { item: UserWithFollowStatus }) => {
    const isCurrentUser = item.id === currentUser?.id;
    
    return (
      <View style={styles.userItem}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
        >
          <Image
            source={{ uri: item.profilePhoto || DEFAULT_PROFILE_IMAGE }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.nickname}</Text>
            {item.bio && <Text style={styles.userBio}>{item.bio}</Text>}
          </View>
        </TouchableOpacity>
        
        {!isCurrentUser && (
          <TouchableOpacity
            style={[
              styles.followButton,
              item.isFollowing ? styles.followingButton : styles.notFollowingButton,
            ]}
            onPress={() => handleFollowToggle(item.id, item.isFollowing)}
          >
            <Text
              style={[
                styles.followButtonText,
                item.isFollowing ? styles.followingButtonText : styles.notFollowingButtonText,
              ]}
            >
              {item.isFollowing ? 'フォロー中' : 'フォロー'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="heart" size={64} color={theme.colors.text.secondary} />
          <Text style={styles.emptyText}>いいねはまだありません</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: theme.spacing.md,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  userBio: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: 2,
    maxWidth: '90%',
    maxHeight: 40,
    overflow: 'hidden',
  },
  followButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  notFollowingButton: {
    backgroundColor: theme.colors.primary,
  },
  followButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
  followingButtonText: {
    color: theme.colors.primary,
  },
  notFollowingButtonText: {
    color: theme.colors.text.inverse,
  },
});

export default LikesListScreen;
