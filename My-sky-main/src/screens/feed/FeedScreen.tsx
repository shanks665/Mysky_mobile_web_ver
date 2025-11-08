import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { Post } from '../../models/Post';
import { User } from '../../models/User';

type FeedScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'Feed'>;

const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';

interface PostWithUserData extends Post {
  user: Pick<User, 'id' | 'nickname' | 'profilePhoto'>;
  isLiked: boolean;
  blockedUsers?: string[]; // ユーザーがブロックしているユーザーIDのリスト
}

const FeedScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<FeedScreenNavigationProp>();
  
  const [posts, setPosts] = useState<PostWithUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [noMorePosts, setNoMorePosts] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  
  // 検索機能
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PostWithUserData[]>([]);
  
  // タブの状態管理
  const [activeTab, setActiveTab] = useState<'all' | 'following'>('all');
  
  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setNoMorePosts(false);
    } else if (!isRefresh && !loading) {
      setLoadingMore(true);
    }
    
    try {
      let query = firestore()
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(10);
      
      // フォローしているユーザーの投稿のみを表示
      if (activeTab === 'following' && user) {
        if (user.following && user.following.length === 0) {
          // フォローしているユーザーがいない場合
          setPosts([]);
          setNoMorePosts(true);
          setRefreshing(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        
        if (user.following && user.following.length > 0) {
          query = query.where('userId', 'in', user.following);
        }
      }
      
      // ページネーション
      if (lastVisible && !isRefresh) {
        query = query.startAfter(lastVisible);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        setNoMorePosts(true);
        setRefreshing(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      
      // 投稿データとユーザーデータを取得
      const postsWithUserData = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const postData = { id: doc.id, ...doc.data() } as Post;
          
          // ユーザー情報を取得
          const userDoc = await firestore()
            .collection('users')
            .doc(postData.userId)
            .get();
          
          const userData = userDoc.data() as User;
          
          // いいね状態を確認
          const isLiked = user ? postData.likes?.includes(user.id) : false;
          
          return {
            ...postData,
            user: {
              id: userDoc.id,
              nickname: userData?.nickname || 'Unknown',
              profilePhoto: userData?.profilePhoto || '',
            },
            isLiked,
            comments: postData.comments || 0,
            blockedUsers: userData?.blockedUsers || [],
          };
        })
      );
      
      // ブロック関係をフィルタリング
      let filteredPosts = postsWithUserData;
      
      if (user) {
        filteredPosts = postsWithUserData.filter(post => {
          // 自分がブロックしたユーザーの投稿を除外
          if (user.blockedUsers && user.blockedUsers.includes(post.user.id)) {
            return false;
          }
          
          // 自分をブロックしているユーザーの投稿を除外
          if (post.blockedUsers && post.blockedUsers.includes(user.id)) {
            return false;
          }
          
          return true;
        });
      }
      
      if (isRefresh) {
        setPosts(filteredPosts);
      } else {
        setPosts((prev) => [...prev, ...filteredPosts]);
      }
    } catch (error) {
      console.error('Error fetching circles:', error);
      Alert.alert('エラー', 'サークルの取得に失敗しました');
    } finally {
      setRefreshing(false);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [lastVisible, activeTab, user]);
  
  useEffect(() => {
    setPosts([]);
    setLastVisible(null);
    setNoMorePosts(false);
    setLoading(true);
    fetchPosts(true);
  }, [activeTab]);
  
  const handleRefresh = () => {
    setLastVisible(null);
    setNoMorePosts(false);
    fetchPosts(true);
  };
  
  const handleLoadMore = () => {
    if (!loadingMore && !noMorePosts) {
      fetchPosts();
    }
  };
  
  // 検索機能
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }
    
    setIsSearching(true);
    
    try {
      // 検索クエリを小文字に変換
      const query = searchQuery.toLowerCase();
      
      // Firestoreで全ての投稿を取得
      const snapshot = await firestore()
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      if (snapshot.empty) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      
      // 投稿データとユーザーデータを取得
      const postsWithUserData = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const postData = { id: doc.id, ...doc.data() } as Post;
          
          // ユーザー情報を取得
          const userDoc = await firestore()
            .collection('users')
            .doc(postData.userId)
            .get();
          
          const userData = userDoc.data() as User;
          
          // いいね状態を確認
          const isLiked = user ? postData.likes?.includes(user.id) : false;
          
          return {
            ...postData,
            user: {
              id: userDoc.id,
              nickname: userData?.nickname || 'Unknown',
              profilePhoto: userData?.profilePhoto || '',
            },
            isLiked,
            comments: postData.comments || 0,
            blockedUsers: userData?.blockedUsers || [],
          };
        })
      );
      
      // テキスト内容で検索
      let filteredPosts = postsWithUserData.filter((post) => {
        const postText = post.text.toLowerCase();
        const userName = post.user.nickname.toLowerCase();
        
        return postText.includes(query) || userName.includes(query);
      });
      
      // ブロック関係でさらにフィルタリング
      if (user) {
        filteredPosts = filteredPosts.filter(post => {
          // 自分がブロックしたユーザーの投稿を除外
          if (user.blockedUsers && user.blockedUsers.includes(post.user.id)) {
            return false;
          }
          
          // 自分をブロックしているユーザーの投稿を除外
          if (post.blockedUsers && post.blockedUsers.includes(user.id)) {
            return false;
          }
          
          return true;
        });
      }
      
      setSearchResults(filteredPosts);
    } catch (error) {
      console.error('Error searching posts:', error);
      Alert.alert('エラー', '投稿の検索に失敗しました');
    } finally {
      setIsSearching(false);
    }
  };
  
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };
  
  // 投稿モーダルを表示
  const openPostModal = () => {
    setShowPostModal(true);
  };

  // 投稿モーダルを閉じる
  const closePostModal = () => {
    setShowPostModal(false);
    setNewPostText('');
  };

  // 投稿を作成
  const handleCreatePost = async () => {
    if (!user) {
      Alert.alert('エラー', 'ログインしてください');
      return;
    }
    
    if (!newPostText.trim()) {
      Alert.alert('エラー', '投稿内容を入力してください');
      return;
    }
    
    if (newPostText.length > 500) {
      Alert.alert('エラー', '投稿は500文字以内で入力してください');
      return;
    }
    
    setPosting(true);
    
    try {
      const postData = {
        userId: user.id,
        text: newPostText.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        likes: [],
        comments: 0,
      };
      
      await firestore().collection('posts').add(postData);
      
      setNewPostText('');
      closePostModal();
      handleRefresh();
      
      Alert.alert('成功', '投稿が完了しました');
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('エラー', '投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };
  
  // handleLikePostを追加
  const handleLikePost = async (postId: string, isLiked: boolean) => {
    if (!user) {
      Alert.alert('エラー', 'いいねするにはログインが必要です');
      return;
    }
    
    try {
      const postRef = firestore().collection('posts').doc(postId);
      
      if (isLiked) {
        // いいねを解除
        await postRef.update({
          likes: firestore.FieldValue.arrayRemove(user.id)
        });
      } else {
        // いいねを追加
        await postRef.update({
          likes: firestore.FieldValue.arrayUnion(user.id)
        });
      }
      
      // UIを更新
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId
            ? { 
                ...post, 
                isLiked: !isLiked,
                likes: isLiked 
                  ? post.likes.filter(id => id !== user.id)
                  : [...post.likes, user.id]
              }
            : post
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('エラー', 'いいねの更新に失敗しました');
    }
  };
  
  // 投稿削除時にコメントも削除するように修正（権限エラー対応版）
  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    
    Alert.alert(
      '投稿を削除',
      '本当にこの投稿を削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              // 権限チェック - 自分の投稿かどうか確認
              const postDoc = await firestore()
                .collection('posts')
                .doc(postId)
                .get();
              
              if (!postDoc.exists) {
                Alert.alert('エラー', '投稿が見つかりません');
                return;
              }
              
              const postData = postDoc.data();
              if (postData?.userId !== user.id) {
                Alert.alert('エラー', 'この投稿を削除する権限がありません');
                return;
              }
              
              // まず通常のコメントコレクションの関連コメントを削除
              const commentsSnapshot = await firestore()
                .collection('comments')
                .where('postId', '==', postId)
                .get();
              
              // 権限エラーを防ぐため、一つずつ削除
              for (const doc of commentsSnapshot.docs) {
                await doc.ref.delete();
              }
              
              // 投稿のサブコレクションのコメントを削除
              const subCommentsSnapshot = await firestore()
                .collection('posts')
                .doc(postId)
                .collection('comments')
                .get();
              
              // サブコレクションも一つずつ削除
              for (const doc of subCommentsSnapshot.docs) {
                await doc.ref.delete();
              }
              
              // 最後に投稿自体を削除
              await firestore()
                .collection('posts')
                .doc(postId)
                .delete();
              
              // UIから投稿を削除
              setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
              
              Alert.alert('成功', '投稿が削除されました');
            } catch (error: any) {
              console.error('Error deleting post:', error);
              Alert.alert('エラー', '投稿の削除に失敗しました: ' + error.message);
            }
          }
        }
      ]
    );
  };
  
  const renderPostItem = ({ item }: { item: PostWithUserData }) => {
    const isOwnPost = user && item.userId === user.id;
    
    // 日付フォーマット
    let formattedDate = '';
    try {
      if (item.createdAt) {
        // Firestoreのタイムスタンプ型かを確認して適切に変換
        if (item.createdAt.toDate && typeof item.createdAt.toDate === 'function') {
          // Firestore Timestamp型
          const date = item.createdAt.toDate();
          formattedDate = date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          });
        } else if (item.createdAt instanceof Date) {
          // Date型
          formattedDate = item.createdAt.toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          });
        } else {
          // その他の型（文字列や数値）
          const date = new Date(item.createdAt as any);
          formattedDate = date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          });
        }
      }
    } catch (err) {
      formattedDate = '不明な日付';
    }
    
    return (
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => navigation.navigate('UserProfile', { userId: item.user.id })}
          >
            <Image
              source={{ uri: item.user.profilePhoto || DEFAULT_PROFILE_IMAGE }}
              style={styles.userAvatar}
            />
            <View>
              <Text style={styles.userName}>{item.user.nickname}</Text>
              <Text style={styles.postDate}>{formattedDate}</Text>
            </View>
          </TouchableOpacity>
          
          {isOwnPost && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePost(item.id)}
            >
              <Icon name="trash-outline" size={20} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.postContent}>{item.text}</Text>
        
        {item.image && (
          <Image source={{ uri: item.image }} style={styles.postImage} />
        )}
        
        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLikePost(item.id, item.isLiked)}
          >
            <Icon
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={item.isLiked ? theme.colors.secondary : theme.colors.text.secondary}
            />
            <Text style={styles.actionText}>{item.likes.length}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('CommentsList', { postId: item.id })}
          >
            <Icon name="chatbubble-outline" size={20} color={theme.colors.text.secondary} />
            <Text style={styles.actionText}>{item.comments || 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="document-text-outline" size={48} color={theme.colors.text.secondary} />
        <Text style={styles.emptyText}>
          {activeTab === 'all'
            ? '投稿がありません'
            : 'フォローしているユーザーの投稿がありません'}
        </Text>
      </View>
    );
  };
  
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      {/* 検索バー */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={20} color={theme.colors.text.secondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="投稿を検索..."
            placeholderTextColor={theme.colors.text.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
              <Icon name="close-circle" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* 検索結果または通常の投稿リスト */}
      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : searchQuery && searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => `feed-post-${item.id}`}
          renderItem={renderPostItem}
          contentContainerStyle={styles.listContent}
        />
      ) : searchQuery && searchResults.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="search-outline" size={64} color={theme.colors.text.secondary} />
          <Text style={styles.emptyText}>
            "{searchQuery}"に一致する投稿は見つかりませんでした
          </Text>
        </View>
      ) : (
        <>
          {/* タブ切り替え */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'all' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('all')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'all' && styles.activeTabButtonText,
                ]}
              >
                すべて
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'following' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('following')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'following' && styles.activeTabButtonText,
                ]}
              >
                フォロー中
              </Text>
            </TouchableOpacity>
          </View>

          {/* 投稿リスト */}
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="document-text-outline" size={64} color={theme.colors.text.secondary} />
              <Text style={styles.emptyText}>
                {activeTab === 'all'
                  ? '投稿がありません'
                  : 'フォローしているユーザーの投稿がありません'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => `feed-post-${item.id}`}
              renderItem={renderPostItem}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[theme.colors.primary]}
                />
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingMoreContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                ) : null
              }
              contentContainerStyle={styles.listContent}
            />
          )}
        </>
      )}

      {/* 投稿ボタン */}
      <TouchableOpacity style={styles.fabButton} onPress={openPostModal}>
        <Icon name="create" size={24} color="#fff" />
      </TouchableOpacity>

      {/* 投稿モーダル */}
      {showPostModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>新規投稿</Text>
              <TouchableOpacity onPress={closePostModal}>
                <Icon name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.postInput}
              placeholder="いまどうしてる？"
              placeholderTextColor={theme.colors.text.secondary}
              multiline
              value={newPostText}
              onChangeText={setNewPostText}
              maxLength={500}
            />
            <View style={styles.characterCount}>
              <Text style={[
                styles.characterCountText,
                newPostText.length > 500 && styles.characterCountExceeded
              ]}>
                {newPostText.length}/500
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.postButton,
                (!newPostText.trim() || posting) && styles.postButtonDisabled,
              ]}
              onPress={handleCreatePost}
              disabled={!newPostText.trim() || posting}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.postButtonText}>投稿する</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  activeTabButtonText: {
    color: theme.colors.primary,
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
  },
  postContainer: {
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 3,
    marginHorizontal: 12,
    marginTop: 8,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: theme.spacing.sm,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: 3,
  },
  postDate: {
    fontSize: 12,
    color: '#888',
  },
  deleteButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: 20,
    marginLeft: 8,
  },
  postContent: {
    fontSize: 15,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
    paddingVertical: 6, 
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(240, 240, 245, 0.5)',
  },
  actionText: {
    marginLeft: 4,
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMoreContainer: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  fabButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '90%',
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  postInput: {
    height: 150,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 5,
    padding: 10,
    color: theme.colors.text.primary,
    textAlignVertical: 'top',
  },
  characterCount: {
    alignSelf: 'flex-end',
    marginTop: 5,
    marginBottom: 15,
  },
  characterCountText: {
    color: theme.colors.text.secondary,
    fontSize: 12,
  },
  characterCountExceeded: {
    color: theme.colors.error,
  },
  postButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#CCCCCC', 
  },
  postButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.md,
  },
  searchButton: {
    padding: theme.spacing.sm,
  },
  clearButton: {
    padding: theme.spacing.sm,
  },
});

export default FeedScreen;