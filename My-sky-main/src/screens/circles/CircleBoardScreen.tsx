import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { BoardPost, BoardPostWithUser } from '../../models/BoardPost';
import {
  getCircleBoardPosts,
  createBoardPost,
  toggleLikeBoardPost,
  uploadBoardImage,
  deleteBoardPost,
  getReplies
} from '../../services/boardService';

type CircleBoardRouteProp = RouteProp<DiscoverStackParamList, 'CircleBoard'>;
type CircleBoardNavigationProp = StackNavigationProp<DiscoverStackParamList, 'CircleBoard'>;

const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';

const CircleBoardScreen: React.FC = () => {
  const { user } = useAuth();
  const route = useRoute<CircleBoardRouteProp>();
  const navigation = useNavigation<CircleBoardNavigationProp>();
  const { circleId, circleName } = route.params;

  const [posts, setPosts] = useState<BoardPostWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [noMorePosts, setNoMorePosts] = useState(false);

  // 投稿作成関連
  const [postText, setPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 返信関連
  const [selectedPost, setSelectedPost] = useState<BoardPostWithUser | null>(null);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [replies, setReplies] = useState<BoardPostWithUser[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [viewingReplies, setViewingReplies] = useState(false);

  // サークル情報
  useEffect(() => {
    navigation.setOptions({
      title: `${circleName}の掲示板`,
    });
  }, [navigation, circleName]);

  // 投稿を取得
  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (!user) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
        setLastVisible(null);
        setNoMorePosts(false);
      } else if (!isRefresh && !loading) {
        setLoadingMore(true);
      }

      const useLastVisible = isRefresh ? null : lastVisible;
      const { posts: newPosts, lastVisible: newLastVisible } = await getCircleBoardPosts(circleId, useLastVisible);

      if (newPosts.length === 0) {
        setNoMorePosts(true);
        setRefreshing(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // ユーザー情報を取得して投稿にマージ
      const postsWithUserData = await Promise.all(
        newPosts.map(async (post) => {
          const userDoc = await firestore()
            .collection('users')
            .doc(post.userId)
            .get();

          const userData = userDoc.data();
          const isLiked = post.likes.includes(user.id);

          return {
            ...post,
            user: {
              id: post.userId,
              nickname: userData?.nickname || 'Unknown',
              profilePhoto: userData?.profilePhoto || DEFAULT_PROFILE_IMAGE,
            },
            isLiked,
          };
        })
      );

      if (isRefresh) {
        setPosts(postsWithUserData);
      } else {
        setPosts((prev) => [...prev, ...postsWithUserData]);
      }

      setLastVisible(newLastVisible);
    } catch (error) {
      console.error('Error fetching posts:', error);
      Alert.alert('エラー', '投稿の取得に失敗しました');
    } finally {
      setRefreshing(false);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [circleId, lastVisible, loading, user]);

  // 初期読み込み
  useEffect(() => {
    fetchPosts(true);
  }, [fetchPosts]);

  // 返信を取得
  const fetchReplies = useCallback(async (parentPost: BoardPostWithUser) => {
    if (!user) return;

    try {
      setLoadingReplies(true);
      setSelectedPost(parentPost);
      setViewingReplies(true);

      const replyPosts = await getReplies(parentPost.id);

      if (replyPosts.length === 0) {
        setReplies([]);
        setLoadingReplies(false);
        return;
      }

      // ユーザー情報を取得して返信にマージ
      const repliesWithUserData = await Promise.all(
        replyPosts.map(async (reply) => {
          const userDoc = await firestore()
            .collection('users')
            .doc(reply.userId)
            .get();

          const userData = userDoc.data();
          const isLiked = reply.likes.includes(user.id);

          return {
            ...reply,
            user: {
              id: reply.userId,
              nickname: userData?.nickname || 'Unknown',
              profilePhoto: userData?.profilePhoto || DEFAULT_PROFILE_IMAGE,
            },
            isLiked,
          };
        })
      );

      setReplies(repliesWithUserData);
    } catch (error) {
      console.error('Error fetching replies:', error);
      Alert.alert('エラー', '返信の取得に失敗しました');
    } finally {
      setLoadingReplies(false);
    }
  }, [user]);

  // リフレッシュ処理
  const handleRefresh = () => {
    fetchPosts(true);
  };

  // 追加読み込み
  const handleLoadMore = () => {
    if (!loadingMore && !noMorePosts) {
      fetchPosts();
    }
  };

  // 画像を選択
  const handleImagePick = async (forReply = false) => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        if (imageUri) {
          if (forReply) {
            setReplyImage(imageUri);
          } else {
            setSelectedImage(imageUri);
          }
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('エラー', '画像の選択に失敗しました');
    }
  };

  // 投稿を作成
  const handleCreatePost = async () => {
    if (!user) {
      Alert.alert('エラー', 'ログインしてください');
      return;
    }

    if (!postText.trim() && !selectedImage) {
      Alert.alert('エラー', 'テキストか画像を入力してください');
      return;
    }

    try {
      setUploading(true);

      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadBoardImage(selectedImage, circleId);
      }

      const newPost = await createBoardPost(user.id, {
        circleId,
        text: postText.trim(),
        imageUrl: imageUrl || undefined,
      });

      // 新しい投稿にユーザー情報を追加
      const userDoc = await firestore().collection('users').doc(user.id).get();
      const userData = userDoc.data();

      const postWithUser: BoardPostWithUser = {
        ...newPost,
        user: {
          id: user.id,
          nickname: userData?.nickname || 'Unknown',
          profilePhoto: userData?.profilePhoto || DEFAULT_PROFILE_IMAGE,
        },
        isLiked: false,
      };

      // 新しい投稿をリストの先頭に追加
      setPosts([postWithUser, ...posts]);

      // 入力フィールドをクリア
      setPostText('');
      setSelectedImage(null);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('エラー', '投稿の作成に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // 返信を作成
  const handleCreateReply = async () => {
    if (!user || !selectedPost) {
      return;
    }

    if (!replyText.trim() && !replyImage) {
      Alert.alert('エラー', 'テキストか画像を入力してください');
      return;
    }

    try {
      setUploading(true);

      let imageUrl = null;
      if (replyImage) {
        imageUrl = await uploadBoardImage(replyImage, circleId);
      }

      const newReply = await createBoardPost(user.id, {
        circleId,
        text: replyText.trim(),
        imageUrl: imageUrl || undefined,
        parentId: selectedPost.id,
      });

      // 新しい返信にユーザー情報を追加
      const userDoc = await firestore().collection('users').doc(user.id).get();
      const userData = userDoc.data();

      const replyWithUser: BoardPostWithUser = {
        ...newReply,
        user: {
          id: user.id,
          nickname: userData?.nickname || 'Unknown',
          profilePhoto: userData?.profilePhoto || DEFAULT_PROFILE_IMAGE,
        },
        isLiked: false,
      };

      // 親投稿の返信カウントを更新
      const updatedPosts = posts.map((post) =>
        post.id === selectedPost.id
          ? { ...post, replyCount: post.replyCount + 1 }
          : post
      );
      setPosts(updatedPosts);

      // 返信リストに新しい返信を追加
      setReplies([...replies, replyWithUser]);

      // 入力フィールドをクリア
      setReplyText('');
      setReplyImage(null);
      setReplyModalVisible(false);
    } catch (error) {
      console.error('Error creating reply:', error);
      Alert.alert('エラー', '返信の作成に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // いいねを切り替え
  const handleToggleLike = async (post: BoardPostWithUser) => {
    if (!user) return;

    try {
      const newIsLiked = await toggleLikeBoardPost(post.id, user.id, post.isLiked);

      // 投稿リストを更新
      if (viewingReplies && post.parentId) {
        // 返信のいいねを更新
        const updatedReplies = replies.map((reply) =>
          reply.id === post.id
            ? {
                ...reply,
                isLiked: newIsLiked,
                likes: newIsLiked
                  ? [...reply.likes, user.id]
                  : reply.likes.filter((id) => id !== user.id),
              }
            : reply
        );
        setReplies(updatedReplies);
      } else {
        // 通常投稿のいいねを更新
        const updatedPosts = posts.map((p) =>
          p.id === post.id
            ? {
                ...p,
                isLiked: newIsLiked,
                likes: newIsLiked
                  ? [...p.likes, user.id]
                  : p.likes.filter((id) => id !== user.id),
              }
            : p
        );
        setPosts(updatedPosts);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('エラー', 'いいねの処理に失敗しました');
    }
  };

  // 投稿を削除
  const handleDeletePost = async (post: BoardPostWithUser) => {
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
              await deleteBoardPost(post.id, user.id);

              if (post.parentId) {
                // 返信を削除した場合
                setReplies(replies.filter((reply) => reply.id !== post.id));

                // 親投稿の返信カウントを更新
                const updatedPosts = posts.map((p) =>
                  p.id === post.parentId
                    ? { ...p, replyCount: Math.max(0, p.replyCount - 1) }
                    : p
                );
                setPosts(updatedPosts);
              } else {
                // 親投稿を削除した場合
                setPosts(posts.filter((p) => p.id !== post.id));

                // 返信表示中だった場合は閉じる
                if (viewingReplies && selectedPost?.id === post.id) {
                  setViewingReplies(false);
                  setSelectedPost(null);
                  setReplies([]);
                }
              }
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('エラー', '投稿の削除に失敗しました');
            }
          },
        },
      ]
    );
  };

  // 投稿をレンダリング
  const renderPostItem = ({ item }: { item: BoardPostWithUser }) => {
    const isOwnPost = user && item.userId === user.id;
    const formattedDate = item.createdAt
      ? new Date(item.createdAt.toDate()).toLocaleString('ja-JP', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
        })
      : '';

    return (
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => navigation.navigate('UserProfile', { userId: item.user.id })}
          >
            <Image
              source={{ uri: item.user.profilePhoto }}
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
              onPress={() => handleDeletePost(item)}
            >
              <Icon name="trash-outline" size={18} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.postText}>{item.text}</Text>

        {item.imageUrl && (
          <TouchableOpacity
            onPress={() => {
              // 画像の拡大表示などを追加予定
            }}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
          </TouchableOpacity>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleLike(item)}
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
            onPress={() => {
              if (item.parentId) {
                // 既に返信表示中なら何もしない
              } else {
                // 返信モーダルを表示
                setSelectedPost(item);
                setReplyModalVisible(true);
              }
            }}
          >
            <Icon name="chatbubble-outline" size={18} color={theme.colors.text.secondary} />
            <Text style={styles.actionText}>{item.replyCount}</Text>
          </TouchableOpacity>

          {!viewingReplies && item.replyCount > 0 && (
            <TouchableOpacity
              style={styles.viewRepliesButton}
              onPress={() => fetchReplies(item)}
            >
              <Text style={styles.viewRepliesText}>返信を表示</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // 返信をレンダリング
  const renderReplies = () => {
    if (!selectedPost) return null;

    return (
      <View style={styles.repliesContainer}>
        <View style={styles.repliesHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setViewingReplies(false);
              setSelectedPost(null);
              setReplies([]);
            }}
          >
            <Icon name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.repliesTitle}>返信を表示</Text>
        </View>

        {/* 親投稿 */}
        {renderPostItem({ item: selectedPost })}

        {/* 返信リスト */}
        {loadingReplies ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loadingIndicator} />
        ) : replies.length === 0 ? (
          <View style={styles.emptyReplies}>
            <Text style={styles.emptyText}>返信はまだありません</Text>
          </View>
        ) : (
          <FlatList
            data={replies}
            renderItem={renderPostItem}
            keyExtractor={(item) => `reply-${item.id}`}
            contentContainerStyle={styles.repliesList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* 返信入力フォーム */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.replyInputContainer}
          keyboardVerticalOffset={100}
        >
          {replyImage && (
            <View style={styles.selectedImageContainer}>
              <Image source={{ uri: replyImage }} style={styles.selectedImagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setReplyImage(null)}
              >
                <Icon name="close-circle" size={24} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => handleImagePick(true)}
            >
              <Icon name="image-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>

            <TextInput
              style={styles.inputField}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="返信を入力..."
              multiline
              placeholderTextColor={theme.colors.text.secondary}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!replyText.trim() && !replyImage) || uploading
                  ? styles.sendButtonDisabled
                  : {},
              ]}
              onPress={handleCreateReply}
              disabled={(!replyText.trim() && !replyImage) || uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  };

  // 返信モーダル
  const renderReplyModal = () => {
    return (
      <Modal
        visible={replyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReplyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>返信を作成</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setReplyModalVisible(false);
                  setReplyText('');
                  setReplyImage(null);
                }}
              >
                <Icon name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            {selectedPost && (
              <View style={styles.replyToContainer}>
                <Text style={styles.replyToLabel}>返信先:</Text>
                <View style={styles.replyToContent}>
                  <Image
                    source={{ uri: selectedPost.user.profilePhoto }}
                    style={styles.replyToAvatar}
                  />
                  <View style={styles.replyToInfo}>
                    <Text style={styles.replyToName}>{selectedPost.user.nickname}</Text>
                    <Text style={styles.replyToText} numberOfLines={1}>
                      {selectedPost.text}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {replyImage && (
              <View style={styles.selectedImageContainer}>
                <Image source={{ uri: replyImage }} style={styles.selectedImagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setReplyImage(null)}
                >
                  <Icon name="close-circle" size={24} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={styles.replyInputField}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="返信を入力..."
              multiline
              placeholderTextColor={theme.colors.text.secondary}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.attachImageButton}
                onPress={() => handleImagePick(true)}
              >
                <Icon name="image-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.attachImageText}>画像を添付</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.replyButton,
                  (!replyText.trim() && !replyImage) || uploading
                    ? styles.replyButtonDisabled
                    : {},
                ]}
                onPress={handleCreateReply}
                disabled={(!replyText.trim() && !replyImage) || uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.replyButtonText}>返信する</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {viewingReplies ? (
        renderReplies()
      ) : (
        <>
          {/* 投稿リスト */}
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loadingIndicator} />
          ) : posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="chatbubbles-outline" size={48} color={theme.colors.text.secondary} />
              <Text style={styles.emptyText}>まだ投稿がありません</Text>
              <Text style={styles.emptySubText}>最初の投稿をしてみましょう！</Text>
            </View>
          ) : (
            <FlatList
              data={posts}
              renderItem={renderPostItem}
              keyExtractor={(item) => `post-${item.id}`}
              contentContainerStyle={styles.postsList}
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
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                    style={styles.loadMoreIndicator}
                  />
                ) : null
              }
            />
          )}

          {/* 投稿入力フォーム */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inputContainer}
            keyboardVerticalOffset={100}
          >
            {selectedImage && (
              <View style={styles.selectedImageContainer}>
                <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Icon name="close-circle" size={24} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.attachButton}
                onPress={() => handleImagePick(false)}
              >
                <Icon name="image-outline" size={24} color={theme.colors.primary} />
              </TouchableOpacity>

              <TextInput
                style={styles.inputField}
                value={postText}
                onChangeText={setPostText}
                placeholder="投稿を作成..."
                multiline
                placeholderTextColor={theme.colors.text.secondary}
              />

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!postText.trim() && !selectedImage) || uploading
                    ? styles.sendButtonDisabled
                    : {},
                ]}
                onPress={handleCreatePost}
                disabled={(!postText.trim() && !selectedImage) || uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>

          {/* 返信モーダル */}
          {renderReplyModal()}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
    marginTop: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 5,
  },
  postsList: {
    padding: 10,
    paddingBottom: 80,
  },
  postContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  postDate: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  deleteButton: {
    padding: 5,
  },
  postText: {
    fontSize: 15,
    color: theme.colors.text.primary,
    marginBottom: 10,
    lineHeight: 20,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    padding: 5,
  },
  actionText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginLeft: 5,
  },
  viewRepliesButton: {
    marginLeft: 'auto',
  },
  viewRepliesText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  inputContainer: {
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachButton: {
    padding: 10,
  },
  inputField: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    margin: 5,
    color: theme.colors.text.primary,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.text.disabled,
  },
  selectedImageContainer: {
    margin: 5,
    padding: 5,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  selectedImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
  },
  loadMoreIndicator: {
    padding: 10,
  },
  // 返信関連のスタイル
  repliesContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  repliesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  repliesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  repliesList: {
    padding: 10,
  },
  emptyReplies: {
    padding: 20,
    alignItems: 'center',
  },
  replyInputContainer: {
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 10,
  },
  // モーダル関連のスタイル
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
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
  closeButton: {
    padding: 5,
  },
  replyToContainer: {
    marginBottom: 15,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 10,
  },
  replyToLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 5,
  },
  replyToContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyToAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  replyToInfo: {
    flex: 1,
  },
  replyToName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  replyToText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  replyInputField: {
    minHeight: 80,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    textAlignVertical: 'top',
    color: theme.colors.text.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attachImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  attachImageText: {
    marginLeft: 5,
    color: theme.colors.primary,
  },
  replyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  replyButtonDisabled: {
    backgroundColor: theme.colors.text.disabled,
  },
  replyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CircleBoardScreen; 