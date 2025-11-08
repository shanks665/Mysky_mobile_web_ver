import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { BoardPost, BoardPostWithUser, PostCreationData } from '../../models/BoardPost';
import {
  getEventBoardPosts,
  createBoardPost,
  toggleLikeBoardPost,
  uploadBoardImage,
  deleteBoardPost,
  getReplies
} from '../../services/boardService';
import { DEFAULT_PROFILE_IMAGE } from '../../utils/defaultImages';
import { createEventJoinRequestNotification } from '../../services/notificationService';

type BoardContentNavigationProp = StackNavigationProp<DiscoverStackParamList>;

interface EventBoardContentProps {
  eventId: string;
  eventName: string;
}

// 日付区切り用の型定義
interface DateSeparator {
  id: string;
  type: 'date';
  date: Date;
}
  
type MessageWithType = BoardPostWithUser & { 
  type: 'message';
  isReply?: boolean;
  parentPost?: BoardPostWithUser;
};
type ChatItem = DateSeparator | MessageWithType;

// コンポーネント
const EventBoardContent: React.FC<EventBoardContentProps> = React.memo(({ eventId, eventName }) => {
  const { user } = useAuth();
  const navigation = useNavigation<BoardContentNavigationProp>();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // 基本データ状態
  const [posts, setPosts] = useState<BoardPostWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [noMorePosts, setNoMorePosts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 投稿作成関連
  const [postText, setPostText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  
  // メンション機能
  const [mentionedPost, setMentionedPost] = useState<BoardPostWithUser | null>(null);

  // 投稿送信状態
  const [submitting, setSubmitting] = useState(false);
  
  // イベント参加状態
  const [isEventParticipant, setIsEventParticipant] = useState<boolean | null>(null);
  const [isCheckingParticipation, setIsCheckingParticipation] = useState(true);

  // キーエクストラクター
  const keyExtractor = useCallback((item: any) => item.id, []);

  // 時間フォーマット関数
  const formatPostDate = (timestamp: any): string => {
    if (!timestamp) return '';
    
    try {
      let date: Date;
      
      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'object' && timestamp.toDate) {
        date = timestamp.toDate();
      } else {
        date = new Date(timestamp);
      }
      
      // 有効な日付かチェック
      if (isNaN(date.getTime())) {
        return '不明な日時';
      }
      
      const now = new Date();
      const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diff < 60) return `${diff}秒前`;
      if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}日前`;
      
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    } catch (error) {
      console.error('日付フォーマットエラー:', error);
      return '不明な日時';
    }
  };
  
  // 投稿を取得する関数
  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (!eventId) {
      console.warn('❌ 投稿取得中断: イベントIDが未設定');
      setLoading(false);
      return;
    }

    // ユーザーがログインしていない場合も早期リターン
    if (!user?.id) {
      console.warn('❌ 投稿取得中断: ユーザーが未ログイン');
      setLoading(false);
      return;
    }

    // 既に処理中の場合は中断
    if (refreshing && !isRefresh) {
      console.log('🚫 既に更新処理中のため中断');
      return;
    }
    
    if (loadingMore && !isRefresh) {
      console.log('🚫 既に追加読み込み中のため中断');
      return;
    }

    // 状態管理を正確に制御
    if (isRefresh) {
      setRefreshing(true);
      setLastVisible(null);
      setNoMorePosts(false);
      setError(null);
    } else {
      if (noMorePosts) {
        console.log('🚫 これ以上投稿がないため中断');
        return;
      }
      setLoadingMore(true);
    }

    console.log(`📥 イベント(${eventId})の投稿取得開始`);

    try {
      // 簡素化したリトライロジック
      const result = await getEventBoardPosts(
        eventId,
        lastVisible && !isRefresh ? lastVisible : null,
        30
      );

      if (!result) {
        throw new Error('投稿データの取得に失敗しました');
      }

      console.log(`✅ 投稿取得完了: ${result.posts.length}件取得`);
      
      if (result.posts.length === 0) {
        if (isRefresh) {
          setPosts([]);
        }
        setNoMorePosts(true);
        setLastVisible(null);
        return;
      }

      // ユーザー情報をバッチ処理で取得
      const userIds = Array.from(new Set(result.posts.map(post => post.userId)));
      const userDataMap = new Map();
      
      // バッチ処理でユーザーデータを取得
      const BATCH_SIZE = 10;
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);
        const userDocs = await Promise.all(
          batch.map(userId => 
            firestore().collection('users').doc(userId).get()
          )
        );
        
        userDocs.forEach(doc => {
          if (doc.exists) {
            userDataMap.set(doc.id, doc.data());
          }
        });
      }

      // 投稿データにユーザー情報を結合
      const postsWithUserData = result.posts.map(post => {
        const userData = userDataMap.get(post.userId) || {};
        
            return {
              ...post,
              user: {
                id: post.userId,
            nickname: userData.nickname || '不明なユーザー',
                profilePhoto: userData.profilePhoto || DEFAULT_PROFILE_IMAGE,
              },
              isLiked: (post.likes || []).includes(user.id),
            } as BoardPostWithUser;
      });

      // 状態更新
      setPosts((prevPosts) => {
        if (isRefresh) {
          return postsWithUserData;
        } else {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const uniqueNewPosts = postsWithUserData.filter(p => !existingIds.has(p.id));
          return [...prevPosts, ...uniqueNewPosts];
        }
      });

      setLastVisible(result.lastVisible);
      setNoMorePosts(result.posts.length < 30);

    } catch (error) {
      console.error('❌ 投稿取得エラー:', error);
      setError('投稿の読み込みに失敗しました');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoadingMore(false);
      }
      setLoading(false);
    }
  }, [user?.id, eventId, lastVisible, noMorePosts]);

  // マウント時の処理
  useEffect(() => {
    console.log('🔄 EventBoardContent マウント');
    let isMounted = true;
    let loadingTimeout: NodeJS.Timeout;
    let hasCalledFetchPosts = false;

    const fetchData = async () => {
      console.log('📊 fetchData関数開始');
      if (!eventId || !isMounted) return;

      // 最大読み込み時間を設定（10秒）
      loadingTimeout = setTimeout(() => {
        if (isMounted) {
          console.log('⏱️ 読み込みタイムアウト: 最大時間を超過しました');
          setIsCheckingParticipation(false);
          setError('参加状態の確認に時間がかかりすぎています。ネットワーク接続を確認してください。');
        }
      }, 10000);

      // まず参加確認
        setIsCheckingParticipation(true);
        setError(null);

      try {
        // ユーザーが未ログインの場合は早期リターン
        if (!user?.id) {
          setIsEventParticipant(false);
          if (isMounted) {
            setIsCheckingParticipation(false);
          }
          clearTimeout(loadingTimeout);
          return;
        }

        // --- 1. イベント参加確認 ---
        console.log(`🔍 イベント(${eventId})の参加確認開始`);
        const eventDoc = await firestore()
          .collection('events')
          .doc(eventId)
          .get();

        if (!isMounted) return;

          if (!eventDoc.exists) {
          console.warn('⚠️ イベントが見つかりません');
          setIsEventParticipant(false);
          } else {
            const eventData = eventDoc.data() || {};
            const isCreator = eventData.createdBy === user.id;
            const isAdmin = (eventData.admins || []).includes(user.id);
            const isAttendee = (eventData.attendees || []).includes(user.id);
          const participantStatus = isCreator || isAdmin || isAttendee;
          
          setIsEventParticipant(participantStatus);
          
          // --- 2. 参加者の場合のみ投稿を取得 ---
          if (participantStatus && isMounted && !hasCalledFetchPosts) {
            console.log('✅ 参加確認OK、投稿取得開始');
            hasCalledFetchPosts = true;
            fetchPosts(true);
          }
          }
        } catch (error) {
        console.error('❌ 初期化エラー:', error);
        if (isMounted) {
          setError('データの読み込みに失敗しました');
        }
      } finally {
        if (isMounted) {
          setIsCheckingParticipation(false);
          clearTimeout(loadingTimeout);
        }
      }
    };

    fetchData();

    return () => {
      console.log('🛑 EventBoardContent アンマウント');
      isMounted = false;
      clearTimeout(loadingTimeout);
    };
  }, [eventId, user]);

  // messagesWithDateSeparators生成
  const messagesWithDateSeparators = useMemo(() => {
    if (posts.length === 0) return [];
    
    const result: ChatItem[] = [];
    let currentDate: string | null = null;

    // 親子関係を構築（返信構造を作成）
    const parentMap = new Map<string, BoardPostWithUser[]>();
    const rootPosts: BoardPostWithUser[] = [];
    
    // まず投稿を親子関係で整理
    posts.forEach(post => {
      if (post.parentId) {
        // 親投稿がある場合は親のIDをキーにして格納
        if (!parentMap.has(post.parentId)) {
          parentMap.set(post.parentId, []);
        }
        parentMap.get(post.parentId)?.push(post);
      } else {
        // 親投稿がない場合はルート投稿として記録
        rootPosts.push(post);
      }
    });
    
    // メッセージを古い順に並べる
    const sortedRootPosts = [...rootPosts].sort((a, b) => {
      try {
        if (!a.createdAt || !b.createdAt) return 0;
        
        const dateA = a.createdAt instanceof Date 
          ? a.createdAt 
          : (typeof a.createdAt === 'object' && a.createdAt.toDate 
              ? a.createdAt.toDate() 
              : new Date(a.createdAt));
              
        const dateB = b.createdAt instanceof Date 
          ? b.createdAt 
          : (typeof b.createdAt === 'object' && b.createdAt.toDate 
              ? b.createdAt.toDate() 
              : new Date(b.createdAt));
        
        // 有効な日付かチェック
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
          return 0;
        }
        
        return dateA.getTime() - dateB.getTime();
      } catch (error) {
        console.error('日付ソートエラー:', error);
        return 0;
      }
    });
    
    // ルート投稿と返信を時系列でまとめる
    sortedRootPosts.forEach(rootPost => {
      try {
        // 投稿の日付を取得
        let postDate: Date;
        
        if (rootPost.createdAt instanceof Date) {
          postDate = rootPost.createdAt;
        } else if (typeof rootPost.createdAt === 'object' && rootPost.createdAt?.toDate) {
          postDate = rootPost.createdAt.toDate();
        } else if (rootPost.createdAt) {
          postDate = new Date(rootPost.createdAt);
        } else {
          postDate = new Date();
        }
        
        // 有効な日付かチェック
        if (isNaN(postDate.getTime())) {
          postDate = new Date(); // 無効な日付の場合は現在時刻を使用
        }
        
        const dateStr = postDate.toISOString().split('T')[0];
        
        // 日付が変わった場合に区切りを追加
        if (dateStr !== currentDate) {
          currentDate = dateStr;
          result.push({
            id: `date-${dateStr}`,
            type: 'date',
            date: postDate
          });
        }
        
        // ルート投稿を追加
        result.push({
          ...rootPost,
          type: 'message',
          isReply: false
        });
        
        // この投稿への返信があれば追加
        const replies = parentMap.get(rootPost.id) || [];
        
        // 返信を古い順に並べる
        const sortedReplies = [...replies].sort((a, b) => {
          try {
            if (!a.createdAt || !b.createdAt) return 0;
            
            const dateA = a.createdAt instanceof Date 
              ? a.createdAt 
              : (typeof a.createdAt === 'object' && a.createdAt.toDate 
                  ? a.createdAt.toDate() 
                  : new Date(a.createdAt));
                  
            const dateB = b.createdAt instanceof Date 
              ? b.createdAt 
              : (typeof b.createdAt === 'object' && b.createdAt.toDate 
                  ? b.createdAt.toDate() 
                  : new Date(b.createdAt));
            
            return dateA.getTime() - dateB.getTime();
          } catch (error) {
            console.error('返信日付ソートエラー:', error);
            return 0;
          }
        });
        
        // 返信を追加
        sortedReplies.forEach(reply => {
          result.push({
          ...reply,
            type: 'message',
            isReply: true,
            parentPost: rootPost
          });
        });
        
    } catch (error) {
        console.error('日付処理エラー:', error, rootPost);
        // エラーが発生してもスキップして続行
      }
    });
    
    return result;
  }, [posts]);

  // 日付区切り表示
  const renderDateSeparator = useCallback((date: Date) => {
    try {
      // 有効な日付かチェック
      if (isNaN(date.getTime())) {
        date = new Date(); // 無効な日付の場合は現在時刻を使用
      }
      
      const formattedDate = date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
      
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateSeparatorLine} />
          <Text style={styles.dateSeparatorText}>{formattedDate}</Text>
          <View style={styles.dateSeparatorLine} />
        </View>
      );
    } catch (error) {
      console.error('日付フォーマットエラー:', error);
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateSeparatorLine} />
          <Text style={styles.dateSeparatorText}>日付不明</Text>
          <View style={styles.dateSeparatorLine} />
        </View>
      );
    }
  }, []);

  // 返信データをクリアする関数
  const clearReplyData = useCallback(() => {
    setMentionedPost(null);
    setReplyToId(null);
  }, []);

  // 返信処理
  const handleReply = useCallback((post: BoardPostWithUser) => {
    // 参照をセット
    setReplyToId(post.id);
    setMentionedPost(post);
    
    // @メンションを入力フィールドに自動的に追加
    setPostText(`@${post.user?.nickname || '不明なユーザー'} `);
    
    // 入力フィールドにフォーカスを当てる
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 投稿のメニュー表示
  const handlePostMenu = useCallback((post: BoardPostWithUser) => {
    if (post.userId === user?.id) {
    Alert.alert(
        'メッセージメニュー',
        '操作を選択してください',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBoardPost(post.id, user.id);
                setPosts(prev => prev.filter(p => p.id !== post.id));
                Alert.alert('成功', 'メッセージを削除しました');
              } catch (error) {
                console.error('削除エラー:', error);
                Alert.alert('エラー', '削除に失敗しました');
              }
            }
          }
        ]
      );
    }
  }, [user]);

  // 投稿の送信
  const handleSubmit = useCallback(async () => {
    // バリデーション: テキストが空かつ画像もない場合は送信しない
    if (!postText.trim() && !selectedImage) {
          return;
        }

    // ユーザーチェック
    if (!user) {
      Alert.alert('エラー', 'メッセージを送信するにはログインが必要です');
          return;
        }
        
    // イベントIDチェック
    if (!eventId) {
      console.error('イベントIDが見つかりません');
      return;
    }

    setSubmitting(true);

    try {
      // 投稿データ作成
      const postData: PostCreationData = {
        text: postText.trim(),
        eventId,
        parentId: replyToId || undefined,
      };

      // 画像がある場合はアップロード
      if (selectedImage) {
        setUploading(true);
        const imageUrl = await uploadBoardImage(selectedImage, undefined, eventId);
        if (imageUrl) {
          postData.imageUrl = imageUrl;
        }
        setUploading(false);
      }

      // Firestoreに保存
      await createBoardPost(user.id, postData);

      // 画面をクリア
      setPostText('');
      setSelectedImage(null);
      setImage(null);
      
      // 返信データを確実にクリア
      clearReplyData();
      
      // データを再取得
      setLastVisible(null);
      fetchPosts(true);

      // 入力フィールドを一度ブラーしてからフォーカスすることでキーボードの予測変換をリセット
      if (inputRef.current) {
        inputRef.current.blur();
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      }

    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      Alert.alert('エラー', 'メッセージの送信に失敗しました');
            } finally {
              setSubmitting(false);
            }
  }, [eventId, user, postText, selectedImage, replyToId, fetchPosts, clearReplyData]);

  // 画像選択
  const handleSelectImage = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });
      
      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return;
      }
      
      const selectedAsset = result.assets[0];
      if (selectedAsset.uri) {
        setSelectedImage(selectedAsset.uri);
        setImage(selectedAsset.uri);
      }
    } catch (error) {
      console.error('画像選択エラー:', error);
      Alert.alert('エラー', '画像の選択に失敗しました');
    }
  }, []);

  // 続きを読み込む処理
  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || noMorePosts || error) return;
    
    fetchPosts();
  }, [loading, loadingMore, noMorePosts, error, fetchPosts]);

  // リフレッシュ処理
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    
    fetchPosts(true);
  }, [refreshing, fetchPosts]);

  // フッター表示
  const renderFooter = useCallback(() => {
    if (loadingMore) {
    return (
        <View style={styles.loadMoreIndicator}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingMoreText}>読み込み中...</Text>
          </View>
      );
    }
    
    return null;
  }, [loadingMore]);

  // 空の表示
  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          </View>
      ) : (
        <View style={styles.emptyContent}>
          <Icon name="chatbubbles-outline" size={48} color={theme.colors.text.secondary} />
          <Text style={styles.emptyText}>まだメッセージがありません</Text>
          <Text style={styles.emptySubText}>
            {noMorePosts 
              ? 'このイベントのチャットにアクセスする権限がない可能性があります'
              : '最初のメッセージを送信してみましょう！'
            }
          </Text>
        </View>
            )}
          </View>
  ), [loading, error, noMorePosts]);

  // メッセージのレンダリング
  const renderItem = useCallback(({ item }: { item: BoardPostWithUser & { isReply?: boolean } }) => {
    const isOwnMessage = user && item.userId === user.id;
    const isReplyMessage = item.isReply === true;
    
    // 日付表示
    let formattedTime = '';
    try {
      if (item.createdAt) {
        let date: Date;
        
        if (item.createdAt instanceof Date) {
          date = item.createdAt;
        } else if (typeof item.createdAt === 'object' && item.createdAt?.toDate) {
          date = item.createdAt.toDate();
        } else {
          date = new Date(item.createdAt);
        }
        
        // 有効な日付かチェック
        if (isNaN(date.getTime())) {
          formattedTime = '不明な時間';
        } else {
          formattedTime = date.toLocaleString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          });
        }
      }
    } catch (err) {
      console.error('日付フォーマットエラー:', err);
      formattedTime = '不明な時間';
    }

    // プロフィール情報
    const profilePhoto = item.user?.profilePhoto || DEFAULT_PROFILE_IMAGE;
    const nickname = item.user?.nickname || '不明なユーザー';
    
    // このメッセージがメンション対象かを確認
    const isHighlighted = mentionedPost?.id === item.id;
    
    // メンション表記を抽出（返信表示用）
    let messageText = item.text || '';
    const mentionMatch = messageText.match(/^@([^\s]+)/);
    const mentionText = mentionMatch ? mentionMatch[0] : null;
    const contentText = mentionText 
      ? messageText.substring(mentionMatch ? mentionMatch[0].length : 0).trim() 
      : messageText;

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        isHighlighted && styles.highlightedMessage,
        isReplyMessage && styles.replyMessageContainer
      ]}>
        {/* 返信の場合は返信インジケータを表示 */}
        {isReplyMessage && (
          <View style={styles.replyIndicator}>
            <View style={styles.replyLine} />
          </View>
        )}
      
        {/* 他のユーザーのメッセージの場合のみアバター表示 */}
        {!isOwnMessage && (
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', { userId: item.user.id })}
          >
            <Image
              source={{ uri: profilePhoto }}
              style={styles.userAvatar}
            />
          </TouchableOpacity>
        )}
        
        <View style={[
          styles.messageContentContainer,
          isOwnMessage ? styles.ownMessageContentContainer : styles.otherMessageContentContainer
        ]}>
          {/* 他のユーザーの場合のみ名前表示 */}
          {!isOwnMessage && (
            <Text style={styles.userName}>{nickname}</Text>
          )}
          
          <View style={styles.messageRow}>
            {/* メッセージ本体 */}
            <View style={[
              styles.messageBubble,
              isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
              isHighlighted && (isOwnMessage ? styles.ownHighlightedBubble : styles.otherHighlightedBubble),
              isReplyMessage && styles.replyMessageBubble
            ]}>
              {/* メッセージテキスト（メンション付き） */}
              {contentText && contentText.trim() !== '' && (
                <View>
                  {/* メンション表示 */}
                  {mentionText && (
                    <Text style={[
                      styles.mentionText,
                      isOwnMessage ? styles.ownMentionText : styles.otherMentionText
                    ]}>{mentionText} </Text>
                  )}
                  <Text style={[
                    styles.messageText,
                    isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                  ]}>{contentText}</Text>
                </View>
              )}
              
              {/* メッセージ画像 */}
        {item.imageUrl && (
          <Image 
            source={{ uri: item.imageUrl }} 
                  style={styles.messageImage}
            resizeMode="cover"
          />
        )}

              {/* アクションボタン - アイコンのみのシンプルな表示 */}
              <View style={styles.messageActionsInner}>
          {/* 返信ボタン */}
          <TouchableOpacity
                  style={styles.actionButtonInner}
            onPress={() => handleReply(item)}
          >
            <Icon 
              name="chatbubble-outline" 
                    size={13} 
                    color={isOwnMessage ? "rgba(255, 255, 255, 0.7)" : "#9CA3AF"}
            />
          </TouchableOpacity>
          
                {/* 削除ボタン（自分のメッセージの場合のみ） */}
                {isOwnMessage && (
            <TouchableOpacity
                    style={styles.actionButtonInner}
                    onPress={() => handlePostMenu(item)}
                  >
                    <Icon 
                      name="trash-outline" 
                      size={13} 
                      color="rgba(255, 255, 255, 0.7)" 
                    />
            </TouchableOpacity>
          )}
        </View>
      </View>

            {/* 時間表示 - メッセージの横 */}
            <Text style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
            ]}>{formattedTime}</Text>
        </View>
        </View>
      </View>
    );
  }, [user, navigation, mentionedPost, handleReply, handlePostMenu]);

  // イベント参加ハンドラー
  const handleJoinEvent = useCallback(async () => {
    if (!user || !eventId) {
      Alert.alert('エラー', 'イベントに参加するにはログインが必要です');
      return;
    }

    try {
      setSubmitting(true);
      
      // イベント参加処理
      const eventDoc = await firestore().collection('events').doc(eventId).get();
      if (!eventDoc.exists) {
        throw new Error('イベントが見つかりませんでした');
      }
      
      const eventData = eventDoc.data() || {};
      
      // 既に参加済みかチェック
      if (eventData.attendees && eventData.attendees.includes(user.id)) {
        setIsEventParticipant(true);
        Alert.alert('情報', '既にこのイベントに参加しています');
        return;
      }

      // 承認待ちかチェック
      if (eventData.pendingAttendees && eventData.pendingAttendees.includes(user.id)) {
        // 承認待ちリストから削除（キャンセル）
        await firestore().collection('events').doc(eventId).update({
          pendingAttendees: firestore.FieldValue.arrayRemove(user.id)
        });
        Alert.alert('成功', '参加リクエストをキャンセルしました');
        return;
      }
      
      // 承認が必要なイベントかチェック
      if (eventData.requiresApproval) {
        // 承認が必要な場合は保留リストに追加
        await firestore().collection('events').doc(eventId).update({
          pendingAttendees: firestore.FieldValue.arrayUnion(user.id)
        });
        
        // 参加リクエスト通知を送信
        try {
          await createEventJoinRequestNotification(eventId, user.id);
        } catch (notifError) {
          console.error('Failed to send notification:', notifError);
          // 通知送信エラーはユーザー体験に影響しないため、エラー表示しない
        }
        
        // ローカルステートを更新して、再読み込みなしでUIを更新
        const updatedEventDoc = await firestore().collection('events').doc(eventId).get();
        if (updatedEventDoc.exists) {
          const updatedEventData = updatedEventDoc.data() || {};
          const isCreator = updatedEventData.createdBy === user.id;
          const isAdmin = (updatedEventData.admins || []).includes(user.id);
          const isAttendee = (updatedEventData.attendees || []).includes(user.id);
          const isPending = (updatedEventData.pendingAttendees || []).includes(user.id);
          
          // UIに表示する参加状態を更新
          if (isPending) {
            Alert.alert('成功', '参加リクエストを送信しました。承認をお待ちください。');
          }
        }
      } else {
        // 承認不要の場合は直接参加者リストに追加
        await firestore().collection('events').doc(eventId).update({
          attendees: firestore.FieldValue.arrayUnion(user.id)
        });
        
        setIsEventParticipant(true);
        Alert.alert('成功', 'イベントに参加しました');
        
        // 参加後に投稿を読み込み
        fetchPosts(true);
      }
      
    } catch (error) {
      console.error('イベント参加エラー:', error);
      Alert.alert('エラー', 'イベントへの参加に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }, [user, eventId]);

  return (
    <View style={styles.container}>
      {isCheckingParticipation ? (
        <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>イベント参加状態を確認中...</Text>
      </View>
      ) : error ? (
        <View style={styles.centered}>
          <Icon name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
            style={styles.retryButton}
              onPress={() => {
              setError(null);
              handleRefresh();
            }}
          >
            <Text style={styles.retryButtonText}>再試行</Text>
            </TouchableOpacity>
          </View>
      ) : isEventParticipant === false ? (
        <View style={styles.centered}>
          <Icon name="hand-left-outline" size={48} color={theme.colors.text.secondary} />
          <Text style={styles.infoMessageText}>イベント参加者のみグループチャットを利用できます</Text>
      <TouchableOpacity
            style={styles.primaryButton}
        onPress={handleJoinEvent}
        disabled={submitting}
      >
        {submitting ? (
              <ActivityIndicator color="#fff"/>
        ) : (
              <Text style={styles.primaryButtonText}>イベントに参加する</Text>
        )}
      </TouchableOpacity>
    </View>
      ) : loading && posts.length === 0 ? (
        <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>メッセージを読み込み中...</Text>
      </View>
      ) : (
        // メインのチャット表示
        <>
          <FlatList
            ref={flatListRef}
            data={messagesWithDateSeparators}
            renderItem={({ item }) => 
              item.type === 'date' 
                ? renderDateSeparator((item as DateSeparator).date)
                : renderItem({ item: item as BoardPostWithUser })
            }
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.chatList}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.colors.primary]}
              />
            }
            ListEmptyComponent={renderEmptyComponent}
            ListFooterComponent={renderFooter}
            onScrollToIndexFailed={() => {}}
          />
          
          {/* 入力フォーム */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            style={styles.inputContainerWrapper}
          >
            {/* メンション表示エリア */}
            {mentionedPost && (
              <View style={styles.mentionContainer}>
                <View style={styles.mentionContent}>
                  <Text style={styles.mentionLabel}>返信先:</Text>
                  <Text style={styles.mentionName} numberOfLines={1}>
                    {mentionedPost.user?.nickname || '不明なユーザー'}
                  </Text>
                  <Text style={styles.mentionPreview} numberOfLines={1}>
                    {mentionedPost.text || ''}
                  </Text>
                </View>
            <TouchableOpacity
                  style={styles.mentionCloseButton}
                  onPress={clearReplyData}
                >
                  <Icon name="close" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
            )}
            
            {/* 入力エリア */}
            <View style={styles.inputContainer}>
              {selectedImage && (
                <View style={styles.selectedImageContainer}>
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.selectedImagePreview}
                  />
              <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => {
                      setSelectedImage(null);
                      setImage(null);
                    }}
                  >
                    <Icon name="close-circle" size={24} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
              )}
              
              <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={handleSelectImage}
                  disabled={submitting}
            >
                  <Icon name="image-outline" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
            
            <TextInput
                  ref={inputRef}
                  style={[
                    styles.inputField,
                    submitting && styles.inputFieldDisabled
                  ]}
                  placeholder="メッセージを入力..."
              multiline
              value={postText}
              onChangeText={setPostText}
                  editable={!submitting}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                    { backgroundColor: (postText.trim() || selectedImage) ? theme.colors.primary : '#dee2e6' },
                    submitting && styles.sendButtonDisabled
              ]}
              onPress={handleSubmit}
                  disabled={submitting || (!postText.trim() && !selectedImage)}
            >
              {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
});

// スタイル定義
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.text.secondary,
    fontSize: 16,
  },
  errorText: {
    marginTop: 10,
    color: theme.colors.error,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#ffeeee',
  },
  infoMessageText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
    minWidth: 180,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // チャットリスト
  chatList: {
    padding: 10,
    paddingBottom: 80,
  },
  
  // メッセージコンテナ
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 10,
    position: 'relative',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  highlightedMessage: {
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderRadius: 12,
    marginVertical: 6,
    padding: 2,
  },
  
  // ユーザーアバター
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  
  // メッセージ横並び
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  
  // メッセージコンテンツコンテナ
  messageContentContainer: {
    maxWidth: '80%',
    flexDirection: 'column',
  },
  ownMessageContentContainer: {
    alignItems: 'flex-end',
    marginLeft: 'auto',
  },
  otherMessageContentContainer: {
    alignItems: 'flex-start',
    marginRight: 'auto',
  },
  
  // メッセージ吹き出し
  messageBubble: {
    padding: 8,
    borderRadius: 16,
    maxWidth: '100%',
    minWidth: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  ownMessageBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  ownHighlightedBubble: {
    backgroundColor: '#4e78d0',
  },
  otherHighlightedBubble: {
    backgroundColor: '#f0f0f0',
  },
  
  // 時間表示
  messageTime: {
    fontSize: 10,
    marginLeft: 4,
    marginRight: 4,
    alignSelf: 'flex-end',
    marginBottom: 5,
  },
  ownMessageTime: {
    color: 'rgba(0, 0, 0, 0.4)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: 'rgba(0, 0, 0, 0.4)',
  },
  
  // メッセージテキスト
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: theme.colors.text.primary,
  },
  
  // メンション表示
  mentionText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 0,
  },
  ownMentionText: {
    color: '#c9e0ff',
  },
  otherMentionText: {
    color: theme.colors.primary,
  },
  
  // メッセージ画像
  messageImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#f0f0f0',
  },
  
  // ユーザー名表示
  userName: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
    color: theme.colors.text.primary,
  },
  
  // メッセージ内のアクションボタン
  messageActionsInner: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 3,
  },
  actionButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    padding: 2,
  },
  
  // 日付区切り
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    paddingHorizontal: 10,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  dateSeparatorText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    paddingHorizontal: 10,
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    paddingVertical: 2,
  },
  
  // 入力フォーム
  inputContainerWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  inputContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachButton: {
    padding: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f5',
  },
  inputField: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f7fa',
    borderRadius: 24,
    fontSize: 15,
    lineHeight: 20,
    marginRight: 8,
    color: '#212529',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputFieldDisabled: {
    backgroundColor: '#f8f9fa',
    color: '#adb5bd',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#dee2e6',
  },
  
  // メンション表示エリア
  mentionContainer: {
    backgroundColor: '#f0f6ff',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e8ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mentionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  mentionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginRight: 4,
  },
  mentionName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginRight: 6,
  },
  mentionPreview: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  mentionCloseButton: {
    padding: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  
  // 画像表示
  selectedImageContainer: {
    position: 'relative',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  selectedImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 2,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  
  // エンプティステート
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    height: 300,
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 20,
  },
  loadMoreIndicator: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 8,
  },
  
  // 返信スタイル
  replyMessageContainer: {
    marginLeft: 16,
    marginTop: 2,
    marginBottom: 2,
  },
  replyMessageBubble: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  replyIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 0,
    width: 16,
    alignItems: 'center',
  },
  replyLine: {
    width: 2,
    height: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 1,
  },
});

export default EventBoardContent; 