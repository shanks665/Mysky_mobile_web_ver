import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { HomeStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';

type CommentsListScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'CommentsList'>;
type CommentsListScreenRouteProp = RouteProp<HomeStackParamList, 'CommentsList'>;

interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: any;
  parentCommentId?: string; // 返信先コメントのID
  replyToUserId?: string; // 返信先ユーザーのID
  user?: {
    id: string;
    nickname: string;
    profilePhoto: string;
  };
  replyToUser?: {
    id: string | undefined;
    nickname: string;
  };
  likes?: string[]; // いいねしたユーザーのID配列
  isLiked?: boolean; // 現在のユーザーがいいねしているか
  replies?: any[]; // 返信コメント配列を追加
}

const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';

const CommentsListScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<CommentsListScreenNavigationProp>();
  const route = useRoute<CommentsListScreenRouteProp>();
  
  const { postId } = route.params;
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      
      const query = firestore().collection('comments');
      const filteredQuery = query.where('postId', '==', postId);
      const orderedQuery = filteredQuery.orderBy('createdAt');
      const commentsSnapshot = await orderedQuery.get();
      
      const commentsPromises = commentsSnapshot.docs.map(async (doc) => {
        const commentData = { id: doc.id, ...doc.data() } as Comment;
        
        // ユーザー情報を取得
        const userDoc = await firestore()
          .collection('users')
          .doc(commentData.userId)
          .get();
        
        const userData = userDoc.data();
        
        // 返信先ユーザー情報を取得（もし返信コメントなら）
        let replyToUserData = null;
        if (commentData.replyToUserId) {
          const replyToUserDoc = await firestore()
            .collection('users')
            .doc(commentData.replyToUserId)
            .get();
          
          if (replyToUserDoc.exists) {
            replyToUserData = replyToUserDoc.data();
          }
        }
        
        // いいね状態を確認
        const isLiked = user ? (commentData.likes || []).includes(user.id) : false;
        
        return {
          ...commentData,
          user: {
            id: userDoc.id,
            nickname: userData?.nickname || 'Unknown',
            profilePhoto: userData?.profilePhoto || '',
          },
          replyToUser: replyToUserData ? {
            id: commentData.replyToUserId,
            nickname: replyToUserData.nickname || 'Unknown',
          } : undefined,
          isLiked,
        };
      });
      
      const commentsData = await Promise.all(commentsPromises);
      
      // コメントをスレッド形式で整理（親コメント→子コメントの順）
      const sortedComments = commentsData.sort((a, b) => {
        // 親コメントかどうかでまず並べ替え
        const aIsParent = !a.parentCommentId;
        const bIsParent = !b.parentCommentId;
        
        if (aIsParent && !bIsParent) return -1;
        if (!aIsParent && bIsParent) return 1;
        
        // 両方とも親コメントか子コメントの場合は作成日時で並べ替え
        if (a.createdAt && b.createdAt) {
          const aTime = a.createdAt.toDate ? a.createdAt.toDate().getTime() : a.createdAt.getTime();
          const bTime = b.createdAt.toDate ? b.createdAt.toDate().getTime() : b.createdAt.getTime();
          return aTime - bTime;
        }
        
        return 0;
      });
      
      setComments(sortedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      Alert.alert('エラー', 'コメントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [postId, user]);
  
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);
  
  const handleSubmitComment = async () => {
    if (!user) {
      Alert.alert('エラー', 'コメントを投稿するにはログインが必要です');
      return;
    }
    
    if (!newComment.trim()) {
      return;
    }
    
    if (replyingTo) {
      await handleSubmitReply();
      return;
    }
    
    setSubmitting(true);
    
    try {
      const commentData = {
        postId,
        userId: user.id,
        text: newComment.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        likesCount: 0,
        likes: [],
      };
      
      // メインのコメントコレクションに追加（トップレベル）
      const commentRef = await firestore().collection('comments').add(commentData);
      
      // 投稿のサブコレクションにも追加（ネスト構造）
      await firestore().collection('posts').doc(postId).collection('comments').doc(commentRef.id).set({
        ...commentData,
        id: commentRef.id
      });
      
      // コメント数を更新
      await firestore().collection('posts').doc(postId).update({
        comments: firestore.FieldValue.increment(1)
      });
      
      setNewComment('');
      setComments(prevComments => [
        {
          id: commentRef.id,
          ...commentData,
          user: {
            id: user.id,
            nickname: user.nickname,
            profilePhoto: user.profilePhoto,
          },
          createdAt: new Date(),
          replies: [],
        },
        ...prevComments
      ]);
      
      // 新規コメント追加成功
      console.log('コメント追加成功');
      
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('エラー', 'コメントの投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!user || !replyingTo) return;
    
    setSubmitting(true);
    
    try {
      const replyData = {
        postId,
        userId: user.id,
        text: newComment.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        parentCommentId: replyingTo.id, // 親コメントIDを設定
        replyToUserId: replyingTo.userId,
        likes: [],
      };
      
      // トップレベルコメントコレクションに返信を追加
      const replyRef = await firestore().collection('comments').add(replyData);
      
      // 投稿のサブコレクションにも追加
      await firestore().collection('posts').doc(postId).collection('comments').doc(replyRef.id).set({
        ...replyData,
        id: replyRef.id
      });
      
      // コメント数を更新（返信も投稿のコメント数に含める）
      await firestore().collection('posts').doc(postId).update({
        comments: firestore.FieldValue.increment(1)
      });
      
      setNewComment('');
      setReplyingTo(null);
      
      // 返信をUIに反映（新しいコメントとして追加）
      const newReply: Comment = {
        id: replyRef.id,
        ...replyData,
        user: {
          id: user.id,
          nickname: user.nickname || '',
          profilePhoto: user.profilePhoto || '',
        },
        replyToUser: replyingTo.user ? {
          id: replyingTo.userId,
          nickname: replyingTo.user.nickname || 'Unknown',
        } : undefined,
        createdAt: new Date(),
      };
      
      setComments(prevComments => [newReply, ...prevComments]);
      
    } catch (error) {
      console.error('Error adding reply:', error);
      Alert.alert('エラー', '返信の投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleLikeComment = async (commentId: string, isLiked: boolean) => {
    if (!user) {
      Alert.alert('エラー', 'ログインしてください');
      return;
    }
    
    try {
      const commentRef = firestore().collection('comments').doc(commentId);
      
      if (isLiked) {
        // いいねを解除
        await commentRef.update({
          likes: firestore.FieldValue.arrayRemove(user.id)
        });
      } else {
        // いいねを追加
        await commentRef.update({
          likes: firestore.FieldValue.arrayUnion(user.id)
        });
      }
      
      // UIを更新
      setComments(prevComments => 
        prevComments.map(comment => 
          comment.id === commentId
            ? { 
                ...comment, 
                isLiked: !isLiked,
                likes: isLiked 
                  ? (comment.likes || []).filter(id => id !== user.id)
                  : [...(comment.likes || []), user.id]
              }
            : comment
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('エラー', 'いいねの更新に失敗しました');
    }
  };
  
  const handleDeleteComment = async (commentId: string) => {
    if (!user) {
      Alert.alert('エラー', 'ログインしてください');
      return;
    }
    
    Alert.alert(
      'コメントの削除',
      'このコメントを削除してもよろしいですか？',
      [
        {
          text: 'キャンセル',
          style: 'cancel'
        },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              // メインのコメントコレクションから削除
              await firestore().collection('comments').doc(commentId).delete();
              
              // 投稿のサブコレクションからも削除
              await firestore().collection('posts').doc(postId).collection('comments').doc(commentId).delete();
              
              // コメント数を減少
              await firestore().collection('posts').doc(postId).update({
                comments: firestore.FieldValue.increment(-1)
              });
              
              // UIを更新
              setComments(prevComments => prevComments.filter(comment => comment.id !== commentId));
              
              console.log('コメント削除成功');
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('エラー', 'コメントの削除に失敗しました');
            }
          }
        }
      ]
    );
  };
  
  const handleReply = (comment: Comment) => {
    setReplyingTo(comment);
    setNewComment(`@${comment.user?.nickname} `);
  };
  
  const cancelReply = () => {
    setReplyingTo(null);
    setNewComment('');
  };
  
  const renderCommentItem = ({ item }: { item: Comment }) => {
    const formattedDate = item.createdAt
      ? new Date(item.createdAt.toDate ? item.createdAt.toDate() : item.createdAt).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    
    const isReplyComment = !!item.parentCommentId;
    
    return (
      <View 
        style={[
          styles.commentItem,
          isReplyComment && styles.replyCommentItem
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
        >
          <Image
            source={{ uri: item.user?.profilePhoto || DEFAULT_PROFILE_IMAGE }}
            style={styles.userAvatar}
          />
        </TouchableOpacity>
        
        <View style={[styles.commentContent, isReplyComment && styles.replyCommentContent]}>
          <View style={styles.commentHeader}>
            <TouchableOpacity
              onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
            >
              <Text style={styles.userName}>{item.user?.nickname}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.commentDate}>{formattedDate}</Text>
              {/* 自分のコメントの場合のみ削除ボタンを表示 */}
              {user && item.userId === user.id && (
                <TouchableOpacity 
                  style={{ marginLeft: 8 }}
                  onPress={() => handleDeleteComment(item.id)}
                >
                  <Icon name="trash-outline" size={18} color={theme.colors.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* 返信先ユーザー表示 */}
          <TouchableOpacity 
            onPress={() => item.replyToUserId ? navigation.navigate('UserProfile', { userId: item.replyToUserId }) : null}
            style={styles.replyToUserContainer}
          >
            <Text style={styles.replyToUser}>@{item.replyToUser?.nickname}</Text>
          </TouchableOpacity>
          
          <Text style={styles.commentText}>{item.text}</Text>
          
          {/* コメントアクションボタン */}
          <View style={styles.commentActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleLikeComment(item.id, !!item.isLiked)}
            >
              <Icon 
                name={item.isLiked ? "heart" : "heart-outline"} 
                size={18} 
                color={item.isLiked ? theme.colors.secondary : theme.colors.text.secondary} 
              />
              <Text style={styles.actionText}>
                {(item.likes?.length || 0) > 0 ? (item.likes?.length || 0) : ''}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleReply(item)}
            >
              <Icon name="return-down-forward" size={18} color={theme.colors.text.secondary} />
              <Text style={styles.actionText}>返信</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={comments}
            renderItem={renderCommentItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>コメントはまだありません</Text>
              </View>
            }
          />
        )}
        
        {/* 返信中バナー表示 */}
        {replyingTo && (
          <View style={styles.replyingBanner}>
            <Text style={styles.replyingText}>
              <Text style={styles.replyingToName}>{replyingTo.user?.nickname}</Text> さんに返信中
            </Text>
            <TouchableOpacity onPress={cancelReply}>
              <Icon name="close-circle" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={replyingTo ? "返信を入力..." : "コメントを入力..."}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!newComment.trim() || submitting) && styles.disabledButton,
            ]}
            onPress={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="send-sharp" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    padding: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  replyCommentItem: {
    marginLeft: 20, // 返信コメントをインデント
    marginTop: -8, // 返信コメントを親コメントに近づける
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 12,
  },
  replyCommentContent: {
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.primary,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  commentDate: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  replyToUserContainer: {
    marginBottom: 4,
  },
  replyToUser: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  commentText: {
    color: theme.colors.text.primary,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'flex-start',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    color: theme.colors.text.primary,
  },
  submitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: theme.colors.text.secondary,
    fontSize: 16,
  },
  replyingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: `${theme.colors.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: `${theme.colors.primary}30`,
  },
  replyingText: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  replyingToName: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
});

export default CommentsListScreen;
