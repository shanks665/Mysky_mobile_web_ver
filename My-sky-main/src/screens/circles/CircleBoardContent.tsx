import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { DEFAULT_PROFILE_IMAGE } from '../../utils/defaultImages';

type BoardContentNavigationProp = StackNavigationProp<DiscoverStackParamList>;

interface CircleBoardContentProps {
  circleId: string;
  circleName: string;
}

const CircleBoardContent: React.FC<CircleBoardContentProps> = React.memo(({ circleId, circleName }) => {
  const { user } = useAuth();
  const navigation = useNavigation<BoardContentNavigationProp>();

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
  
  // 返信機能関連の状態
  const [selectedPost, setSelectedPost] = useState<BoardPostWithUser | null>(null);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [replies, setReplies] = useState<BoardPostWithUser[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [viewingReplies, setViewingReplies] = useState(false);

  // 返信に対する返信（ネスト返信）機能関連の状態
  const [selectedReplyPost, setSelectedReplyPost] = useState<BoardPostWithUser | null>(null);

  // 投稿送信状態
  const [submitting, setSubmitting] = useState(false);
  
  // 投稿の返信ボタンのハンドラー（通常の投稿に対する返信）
  const handleReply = useCallback((post: BoardPostWithUser) => {
    console.log('返信ボタンタップ', {
      postId: post.id, 
      postUserId: post.userId, 
      currentUserId: user?.id,
      isOwnPost: post.userId === user?.id
    });
    
    // 選択した投稿を設定
    setSelectedPost(post);
    
    // 返信テキストに@ユーザー名を自動挿入
    setReplyText(`@${post.user?.nickname || 'ユーザー'} `);
    
    // 返信モーダル表示を確実にするため少し遅延させる
    setTimeout(() => {
      setReplyModalVisible(true);
      console.log('返信モーダル表示設定完了');
    }, 100);
  }, [user]);

  // マウント時に一度だけ実行するuseEffectを最適化
  useEffect(() => {
    let isMounted = true;
    let initialLoadDone = false;
    
    // 初回読み込みの管理を改善
    const initialFetch = async () => {
      if (initialLoadDone || !isMounted || !user?.id || !circleId) return;
      
      try {
        console.log('🔄 CircleBoardContent初期読み込み開始');
        console.log('デバッグ: ユーザー情報', { userId: user?.id, circleId });
        setLoading(true);
        initialLoadDone = true;
        
        // サークル参加確認（権限チェック）- 情報収集のみ
        try {
          const circleDoc = await firestore().collection('circles').doc(circleId).get();
          if (!circleDoc.exists) {
            console.warn('サークルが見つかりませんでした');
            // エラーを表示するが、読み込みは続行する
            // setError('サークルが見つかりませんでした');
            // return;
          } else {
            const circleData = circleDoc.data() || {};
            const isCreator = circleData.createdBy === user.id;
            const isAdmin = (circleData.admins || []).includes(user.id);
            const isMember = (circleData.members || []).includes(user.id);
            
            console.log('デバッグ: メンバーシップ状態', { 
              isCreator, 
              isAdmin, 
              isMember,
              createdBy: circleData.createdBy,
              admins: circleData.admins || [],
              members: circleData.members || []
            });
            
            // メンバーシップチェックを無効化し、すべてのユーザーに閲覧・投稿を許可する
            // if (!isCreator && !isAdmin && !isMember) {
            //   setError('このサークルの掲示板はメンバーのみ閲覧できます');
            //   setPosts([]);
            //   return;
            // }
          }
        } catch (error) {
          console.warn('サークル情報取得エラー（続行します）:', error);
          // エラーは記録するが、処理は停止せず続行する
        }
        
        // 投稿取得を実行（最大3回までリトライ）
        let retryCount = 0;
        const maxRetries = 3;
        let fetchSuccess = false;
        
        while (!fetchSuccess && retryCount < maxRetries) {
          try {
            await fetchPosts(true);
            fetchSuccess = true;
            console.log('✅ CircleBoardContent初期読み込み完了');
          } catch (fetchError) {
            retryCount++;
            console.warn(`❌ 投稿取得エラー (${retryCount}/${maxRetries}):`, fetchError);
            
            if (retryCount < maxRetries) {
              // 一時停止してから再試行
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } else {
              throw fetchError; // 最大回数リトライ後も失敗した場合はエラーを投げる
            }
          }
        }
      } catch (err) {
        console.error('❌ CircleBoardContent初期読み込みエラー:', err);
        setError('掲示板の読み込みに失敗しました。時間をおいて再試行してください');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    // 条件を満たしたら初回読み込み実行
    if (user?.id && circleId && !initialLoadDone) {
      initialFetch();
    }
    
    return () => {
      isMounted = false;
    };
  }, [user, circleId]);

  // 投稿を取得する関数をシンプルに最適化
  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (!user?.id || !circleId) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
        setLastVisible(null);
        setNoMorePosts(false);
      } else if (loadingMore || noMorePosts) {
        // すでに読み込み中または最後まで読み込んだ場合は何もしない
        return;
      } else {
        setLoadingMore(true);
      }
      
      console.log(`🔍 投稿取得開始: ${isRefresh ? '更新' : '追加読み込み'}`);
      
      const useLastVisible = isRefresh ? null : lastVisible;
      const { posts: newPosts, lastVisible: newLastVisible } = await getCircleBoardPosts(circleId, useLastVisible);
      
      // 新しい投稿がなければ終了
      if (newPosts.length === 0) {
        setNoMorePosts(true);
        console.log('📭 これ以上の投稿はありません');
        if (isRefresh) {
          setPosts([]);
        }
        return;
      }
      
      console.log(`📥 取得した投稿数: ${newPosts.length}`);
      
      // ユーザー情報を効率的に取得
      const userIds = Array.from(new Set(newPosts.map(post => post.userId)));
      console.log(`👤 ユーザー情報取得: ${userIds.length}人`);
      
      const userDocs = await Promise.all(
        userIds.map(userId => firestore().collection('users').doc(userId).get())
      );
      
      // ユーザーデータをマップに格納
      const userDataMap = new Map();
      userDocs.forEach(doc => {
        if (doc.exists) {
          userDataMap.set(doc.id, doc.data());
        }
      });
      
      // 投稿データにユーザー情報を付加
      const postsWithUserData = newPosts.map(post => {
        const userData = userDataMap.get(post.userId) || {};
        
        // 返信数のログ出力
        console.log(`投稿ID: ${post.id}, 返信数: ${post.replyCount || 0}, 投稿者: ${post.userId}, 現在のユーザー: ${user.id}`);
        
        // 返信数が0より大きい場合はUI更新用のフラグを設定
        const hasReplies = post.replyCount > 0;
        
        return {
          ...post,
          user: {
            id: post.userId,
            nickname: userData.nickname || 'Unknown',
            profilePhoto: userData.profilePhoto || DEFAULT_PROFILE_IMAGE,
          },
          isLiked: post.likes?.includes(user.id) || false,
          likes: post.likes || [],
          replyCount: post.replyCount || 0,
          _hasReplies: hasReplies, // 返信があるかのフラグを追加
        };
      });
      
      // 投稿リストを更新
      if (isRefresh) {
        // 既存の投稿の状態（特に_hasRepliesフラグ）を保持するため、IDベースでマージ
        const existingPostsMap = new Map();
        posts.forEach(post => {
          existingPostsMap.set(post.id, post);
        });
        
        // 新しい投稿データと既存のデータをマージ
        const mergedPosts = postsWithUserData.map(newPost => {
          const existingPost = existingPostsMap.get(newPost.id);
          if (existingPost) {
            // 既存の投稿が存在する場合、特定のフィールドを保持
            return {
              ...newPost,
              // 返信関連の状態を保持
              _hasReplies: existingPost._hasReplies || newPost.replyCount > 0,
              replyCount: Math.max(newPost.replyCount, existingPost.replyCount || 0)
            };
          }
          return newPost;
        });
        
        console.log('投稿更新完了 - 既存の状態を保持しつつ更新しました');
        setPosts(mergedPosts);
      } else {
        // 既存の投稿と重複を排除して結合
        const existingIds = new Set(posts.map(p => p.id));
        const newUniquePosts = postsWithUserData.filter(p => !existingIds.has(p.id));
        setPosts(prev => [...prev, ...newUniquePosts]);
      }
      
      // 最後の位置を更新
      setLastVisible(newLastVisible);
      console.log('✅ 投稿取得完了');
      
    } catch (error) {
      console.error('❌ 投稿取得エラー:', error);
      let errorMessage = '投稿の取得に失敗しました';
      
      if (error && typeof error === 'object' && error.toString) {
        if (error.toString().includes('permission-denied')) {
          errorMessage = 'このサークルの掲示板へのアクセス権限がありません';
        }
      }
      
      setError(errorMessage);
    } finally {
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [circleId, lastVisible, loadingMore, noMorePosts, posts, user]);

  // 自動更新タイマーを追加
  useEffect(() => {
    // 投稿のバックグラウンド更新機能（1分ごとに変更）
    const refreshTimer = setInterval(() => {
      if (!refreshing && !loading && !viewingReplies && !submitting) {
        console.log('🔄 自動更新を実行します');
        // 静かに更新（UIの変化を最小限に）
        fetchPosts(true);
      }
    }, 60000); // 60秒間隔に延長

    return () => {
      clearInterval(refreshTimer);
    };
  }, [refreshing, loading, viewingReplies, fetchPosts, submitting]);

  // 画面がフォーカスされた時の更新（正しい位置に移動）
  useEffect(() => {
    const focusSub = navigation.addListener('focus', () => {
      if (user?.id && circleId && !loading && !refreshing) {
        console.log('🔄 画面がフォーカスされたため投稿を更新します');
        fetchPosts(true);
      }
    });

    return focusSub;
  }, [navigation, fetchPosts, user, circleId, loading, refreshing]);

  // 返信を取得
  const fetchReplies = useCallback(async (parentPost: BoardPostWithUser) => {
    if (!user) return;
    
    try {
      setLoadingReplies(true);
      setSelectedPost(parentPost);
      setViewingReplies(true);
      
      console.log('サークル返信取得開始:', { parentId: parentPost.id, circleId });
      
      // circleIdを追加して権限チェックを確実に
      const replyPosts = await getReplies(parentPost.id, circleId);
      
      const hasReplies = replyPosts.length > 0;
      
      if (!hasReplies) {
        console.log('返信が見つかりませんでした');
        setReplies([]);
        setLoadingReplies(false);
        
        // 返信がない場合でも、投稿を更新して状態を保持
        setPosts(prev => 
          prev.map(p => {
            if (p.id === parentPost.id) {
              return { 
                ...p, 
                replyCount: 0 
              };
            }
            return p;
          })
        );
        return;
      }
      
      console.log(`取得した返信数: ${replyPosts.length}`);
      
      // 親投稿に返信フラグをセット（返信ボタン表示のため）
      // 投稿全体を更新して返信数と返信フラグを確実に更新
      setPosts(prev => 
        prev.map(p => {
          if (p.id === parentPost.id) {
            console.log(`親投稿の返信数を更新: ID=${p.id}, 現在の返信数=${p.replyCount}, 実際の返信数=${replyPosts.length}`);
            return { 
              ...p, 
              _hasReplies: true, 
              replyCount: Math.max(p.replyCount || 0, replyPosts.length) 
            };
          }
          return p;
        })
      );
      
      // ユーザー情報を取得して返信にマージ
      const userIds = Array.from(new Set(replyPosts.map(post => post.userId)));
      const userDocs = await Promise.all(
        userIds.map(userId => firestore().collection('users').doc(userId).get())
      );
      
      // ユーザーデータをマップに格納
      const userDataMap = new Map();
      userDocs.forEach(doc => {
        if (doc.exists) {
          userDataMap.set(doc.id, doc.data());
        }
      });
      
      // 投稿データにユーザー情報を付加
      const repliesWithUserData = replyPosts.map(reply => {
        const userData = userDataMap.get(reply.userId) || {};
        
        console.log(`返信ID: ${reply.id}, 返信者: ${reply.userId}, 現在のユーザー: ${user.id}`);
        
        return {
          ...reply,
          user: {
            id: reply.userId,
            nickname: userData.nickname || 'Unknown',
            profilePhoto: userData.profilePhoto || DEFAULT_PROFILE_IMAGE,
          },
          isLiked: reply.likes?.includes(user.id) || false,
          likes: reply.likes || [],
          // 返信の返信の場合、返信先IDを追加（表示用）
          nestedLevel: reply.replyToId && reply.replyToId !== parentPost.id ? 1 : 0,
          replyToId: reply.replyToId || null
        };
      });
      
      // 返信の並び順を調整
      let organizedReplies = [...repliesWithUserData];
      organizedReplies.sort((a, b) => {
        // 作成日時を比較して新しい順に並べる
        if (a.createdAt && b.createdAt) {
          const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        }
        return 0;
      });
      
      setReplies(organizedReplies);
      console.log('返信取得完了', organizedReplies.length);
    } catch (error) {
      console.error('Error fetching replies:', error);
      
      let errorMessage = '返信の取得に失敗しました';
      
      // 具体的なエラーログとメッセージ
      console.error('返信取得の詳細エラー:', error);
      Alert.alert('エラー', errorMessage);
    } finally {
      setLoadingReplies(false);
    }
  }, [user, circleId]);

  // 投稿メニューを表示
  const handlePostMenu = (post: BoardPostWithUser) => {
    if (post.userId === user?.id) {
      Alert.alert(
        '投稿メニュー',
        '操作を選択してください',
        [
          { text: 'キャンセル', style: 'cancel' },
          { 
            text: '削除', 
            style: 'destructive', 
            onPress: () => handleDeletePost(post) 
          }
        ]
      );
    }
  };

  // リフレッシュ処理をシンプルに
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    console.log('🔄 手動更新開始');
    // キャッシュされた投稿や最後の位置情報をリセット
    setLastVisible(null);
    setNoMorePosts(false);
    
    // 投稿と返信フラグの状態をリセットせずに更新
    fetchPosts(true);
  }, [fetchPosts, refreshing]);

  // 無限スクロール処理
  const handleLoadMore = useCallback(() => {
    if (!loading && !loadingMore && !noMorePosts && !error) {
      fetchPosts();
    }
  }, [loading, loadingMore, noMorePosts, error, fetchPosts]);

  // 画像を選択
  const handleImagePick = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        if (imageUri) {
          setSelectedImage(imageUri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('エラー', '画像の選択に失敗しました');
    }
  };

  // 画像選択処理
  const handleSelectImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });
      
      if (result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        if (selectedUri) {
          if (viewingReplies && replyModalVisible) {
            // 返信モーダル用
            setReplyImage(selectedUri);
          } else {
            // 通常投稿用
            setImage(selectedUri);
          }
        }
      }
    } catch (error) {
      console.error('画像選択エラー:', error);
      Alert.alert('エラー', '画像の選択中にエラーが発生しました');
    }
  };

  // 画像タップ処理を追加
  const handleImagePress = (imageUrl: string | undefined) => {
    if (!imageUrl) return;
    // 画像表示処理（将来的に拡大表示などを実装する場合に備えて）
    console.log('画像タップ:', imageUrl);
  };

  // 投稿を作成
  const handleSubmit = async () => {
    if (!user) return;
    
    if (!postText.trim() && !image) {
      Alert.alert('エラー', '投稿内容を入力してください');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // 画像があれば処理
      let imageUrl = null;
      if (image) {
        try {
          imageUrl = await uploadBoardImage(image);
          console.log('投稿画像アップロード成功:', imageUrl);
        } catch (imgError) {
          console.error('投稿画像アップロードエラー:', imgError);
          // 画像エラーは無視して続行（テキストのみで投稿）
        }
      }
      
      const postData = {
        text: postText.trim(),
        circleId, // サークルIDは必ず含める
        ...(imageUrl && { imageUrl }),
        ...(selectedPost && { parentId: selectedPost.id }),
      };
      
      // 最大3回までリトライ
      let retryCount = 0;
      const maxRetries = 3;
      let success = false;
      let newPost;
      let lastError;
      
      while (!success && retryCount < maxRetries) {
        try {
          // 投稿を作成
          newPost = await createBoardPost(user.id, postData);
          success = true;
          console.log('新規投稿作成完了:', newPost.id);
        } catch (createError) {
          // 返信カウント更新のリトライエラーは無視して成功扱いにする
          if (createError instanceof Error && createError.message.includes('最大リトライ回数')) {
            console.warn('返信カウント更新のリトライエラーですが、投稿自体は成功したと判断します');
            success = true;
            // 一時的な投稿オブジェクトを作成
            newPost = { 
              id: 'temp-id', 
              ...postData, 
              userId: user.id,
              createdAt: new Date(),
              likes: [],
              replyCount: 0
            } as BoardPost;
            break;
          }
          
          lastError = createError;
          retryCount++;
          console.warn(`投稿作成エラー (${retryCount}/${maxRetries}):`, createError);
          
          if (retryCount < maxRetries) {
            // 一時停止してから再試行
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          } else {
            throw createError; // 最大回数リトライ後も失敗した場合はエラーを投げる
          }
        }
      }
      
      // 投稿が成功したらUIを更新
      if (success && newPost) {
        // 投稿後にフォームをリセット
        setPostText('');
        setImage(null);
        
        // 返信表示モードの場合は返信一覧を更新
        if (viewingReplies && selectedPost) {
          const newPostWithUser: BoardPostWithUser = {
            ...newPost,
            user: {
              id: user.id,
              nickname: user.nickname || 'Unknown',
              profilePhoto: user.profilePhoto || DEFAULT_PROFILE_IMAGE,
            },
            isLiked: false,
            likes: [],
          };
          
          setReplies(prev => [newPostWithUser, ...prev]);
          
          // 親投稿の返信数を更新（UIのみ）
          setPosts(prev => 
            prev.map(p => 
              p.id === selectedPost.id
                ? { ...p, replyCount: p.replyCount + 1 }
                : p
            )
          );
        } else {
          // 通常投稿モードの場合は、即座に新しい投稿を画面に表示
          const newPostWithUser: BoardPostWithUser = {
            ...newPost,
            user: {
              id: user.id,
              nickname: user.nickname || 'Unknown',
              profilePhoto: user.profilePhoto || DEFAULT_PROFILE_IMAGE,
            },
            isLiked: false,
            likes: [],
            replyCount: 0,
          };
          
          // 新しい投稿をリストの先頭に追加（最新順に表示）
          setPosts(prev => [newPostWithUser, ...prev]);
        }
        
        // 成功メッセージを表示
        console.log('投稿に成功しました');
      }
    } catch (error) {
      console.error('投稿作成エラー:', error);
      
      // 返信カウント更新エラーの場合は無視
      if (error instanceof Error && error.message.includes('最大リトライ回数')) {
        console.warn('返信カウント更新エラーですが表示しません');
        // エラーを表示せず、状態をリセット
        setPostText('');
        setImage(null);
        setSelectedPost(null);
        return;
      }
      
      let errorMessage = '投稿の作成に失敗しました';
      
      // エラーメッセージをより詳細に
      if (error instanceof Error) {
        console.error('詳細エラー情報:', error.message);
        
        if (error.message.includes('permission-denied')) {
          errorMessage = '権限がありません。サービスの問題が発生している可能性があります。しばらく待ってから再試行してください。';
        } else if (error.message.includes('not-found')) {
          errorMessage = 'サークルが見つかりませんでした。';
        } else if (error.message.includes('unavailable')) {
          errorMessage = 'サービスが一時的に利用できません。しばらく待ってから再試行してください。';
        } else {
          errorMessage = `エラー: ${error.message}`;
        }
      }
      
      Alert.alert('エラー', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // いいねを切り替え
  const handleToggleLike = useCallback(async (post: BoardPostWithUser) => {
    if (!user) return;
    
    try {
      // UIを先に更新（最適UI体験のため）
      const updatedIsLiked = !post.isLiked;
      
      // UIの即時更新
      if (viewingReplies && post.parentId) {
        // 返信モードでの更新
        setReplies(prev => 
          prev.map(reply => 
            reply.id === post.id
              ? {
                  ...reply,
                  isLiked: updatedIsLiked,
                  likes: updatedIsLiked
                    ? [...reply.likes, user.id]
                    : reply.likes.filter(id => id !== user.id)
                }
              : reply
          )
        );
      } else {
        // 通常モードでの更新
        setPosts(prev => 
          prev.map(p => 
            p.id === post.id
              ? {
                  ...p,
                  isLiked: updatedIsLiked,
                  likes: updatedIsLiked
                    ? [...p.likes, user.id]
                    : p.likes.filter(id => id !== user.id)
                }
              : p
          )
        );
      }
      
      // 非同期でサーバー更新
      await toggleLikeBoardPost(post.id, user.id, post.isLiked);
      
      console.log(`いいね ${updatedIsLiked ? '追加' : '削除'} 成功: ${post.id}`);
    } catch (error) {
      console.error('いいね処理エラー:', error);
      Alert.alert('エラー', 'いいねの処理中にエラーが発生しました');
      
      // エラー時はUIを元に戻す
      if (viewingReplies && post.parentId) {
        setReplies(prev => 
          prev.map(reply => 
            reply.id === post.id ? { ...reply, isLiked: post.isLiked, likes: [...post.likes] } : reply
          )
        );
      } else {
        setPosts(prev => 
          prev.map(p => 
            p.id === post.id ? { ...p, isLiked: post.isLiked, likes: [...p.likes] } : p
          )
        );
      }
    }
  }, [user, viewingReplies]);

  // 返信を作成
  const createReply = useCallback(async () => {
    console.log('===== 返信作成開始 =====');
    
    if (!user || !selectedPost) {
      console.log('返信作成失敗: ユーザーまたは親投稿がありません', { 
        userExists: !!user, 
        selectedPostExists: !!selectedPost 
      });
      return;
    }
    
    if (!replyText.trim() && !replyImage) {
      Alert.alert('エラー', '返信内容を入力してください');
      return;
    }
    
    try {
      setSubmitting(true);
      console.log('返信先情報:', {
        parentId: selectedPost.id,
        parentText: selectedPost.text?.substring(0, 20) + '...',
        parentUserId: selectedPost.userId,
        replyToId: selectedReplyPost?.id || selectedPost.id,
        circleId,
        userId: user.id,
        isOwnPost: selectedPost.userId === user.id
      });
      
      // 実際の親投稿ID（返信に対する返信の場合でも、最上位の親投稿ID）
      const actualParentId = selectedPost.parentId || selectedPost.id;
      
      // 返信先の投稿ID（返信に対する返信の場合は selectedReplyPost の ID）
      const replyToId = selectedReplyPost ? selectedReplyPost.id : selectedPost.id;
      
      // 画像があれば処理
      let imageUrl = null;
      if (replyImage) {
        try {
          console.log('返信画像アップロード開始');
          imageUrl = await uploadBoardImage(replyImage, circleId);
          console.log('返信画像アップロード成功:', imageUrl?.substring(0, 50) + '...');
        } catch (imgError) {
          console.error('返信画像アップロードエラー:', imgError);
          Alert.alert('警告', '画像のアップロードに失敗しましたが、テキストのみで返信を続行します');
          // 画像エラーは無視して続行（テキストのみで投稿）
        }
      }
      
      // 返信内容 - 重要なのはcircleIdとparentIdを含めること
      const replyData = {
        text: replyText.trim(),
        circleId, // サークルIDは必ず含める
        parentId: actualParentId,
        replyToId: replyToId !== actualParentId ? replyToId : undefined, // 直接の返信先が元の投稿と異なる場合のみ設定
        ...(imageUrl && { imageUrl }),
      };
      
      console.log('返信データ作成完了:', {
        text: replyData.text.substring(0, 20) + (replyData.text.length > 20 ? '...' : ''),
        circleId: replyData.circleId,
        parentId: replyData.parentId,
        hasReplyToId: !!replyData.replyToId,
        hasImage: !!imageUrl
      });
      
      // エラーリトライカウンター
      let retryCount = 0;
      const maxRetries = 2;
      let success = false;
      let newReply;
      let lastError;
      
      while (!success && retryCount <= maxRetries) {
        try {
          console.log(`返信作成実行 (試行: ${retryCount + 1}/${maxRetries + 1})`);
          // 返信投稿を作成
          newReply = await createBoardPost(user.id, replyData);
          success = true;
          console.log('返信作成成功:', newReply.id);
        } catch (createError) {
          // 返信カウント更新エラーの場合は成功とみなす
          if (createError instanceof Error && createError.message.includes('最大リトライ回数')) {
            console.warn('返信カウント更新のリトライエラーですが、返信自体は成功したとみなします');
            success = true;
            // 一時的な返信オブジェクトを作成
            newReply = { 
              id: 'temp-id', 
              ...replyData, 
              userId: user.id,
              createdAt: new Date(),
              likes: [],
              replyCount: 0
            } as BoardPost;
            break;
          }
          
          lastError = createError;
          retryCount++;
          console.warn(`返信作成エラー (${retryCount}/${maxRetries + 1}):`, createError);
          
          if (retryCount <= maxRetries) {
            // 待機時間を徐々に増やす (500ms, 1000ms, ...)
            const waitTime = 500 * retryCount;
            console.log(`${waitTime}ms後に再試行します...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (success && newReply) {
        // 返信投稿にユーザー情報を付加
        const replyWithUser: BoardPostWithUser = {
          ...newReply,
          user: {
            id: user.id,
            nickname: user.nickname || 'Unknown',
            profilePhoto: user.profilePhoto || DEFAULT_PROFILE_IMAGE,
          },
          isLiked: false,
          likes: [],
        };
        
        console.log('返信UIを更新');
        
        // 返信一覧に追加
        if (viewingReplies) {
          setReplies(prev => [replyWithUser, ...prev]);
        }
        
        // 親投稿の返信カウントを更新 - 常にUIを更新して整合性を保つ
        const actualParentId = selectedPost.parentId || selectedPost.id;
        
        setPosts(prev => 
          prev.map(p => {
            if (p.id === actualParentId) {
              console.log(`親投稿の返信数をUI上で更新: ID=${p.id}, 現在の返信数=${p.replyCount || 0} -> ${(p.replyCount || 0) + 1}`);
              // 返信数を増やし、フラグも確実に設定
              return { 
                ...p, 
                replyCount: (p.replyCount || 0) + 1,
                _hasReplies: true
              };
            }
            return p;
          })
        );
        
        // 返信モーダルを閉じて入力内容をクリア
        setReplyModalVisible(false);
        setReplyText('');
        setReplyImage(null);
        setSelectedReplyPost(null);
        
        // 親投稿の最新データを取得して確実に返信数を反映
        try {
          // 少し遅延させてFirestoreの更新が完了するまで待つ
          setTimeout(async () => {
            try {
              const parentPostDoc = await firestore()
                .collection('boardPosts')
                .doc(actualParentId)
                .get();
              
              if (parentPostDoc.exists) {
                const updatedParentData = parentPostDoc.data();
                console.log(`Firestoreから取得した親投稿の返信数: ${updatedParentData?.replyCount || 0}`);
                
                // データベースの値とUIの値を比較し、不一致があれば修正
                setPosts(prev => 
                  prev.map(p => {
                    if (p.id === actualParentId && p.replyCount !== updatedParentData?.replyCount) {
                      console.log(`返信数の不一致を修正: UI=${p.replyCount}, DB=${updatedParentData?.replyCount}`);
                      return { 
                        ...p, 
                        replyCount: updatedParentData?.replyCount || p.replyCount,
                        _hasReplies: true
                      };
                    }
                    return p;
                  })
                );
              }
            } catch (err) {
              console.warn('親投稿データ再取得エラー:', err);
            }
          }, 1500); // 1.5秒待機
        } catch (err) {
          console.warn('親投稿の状態更新に失敗しましたが、処理は続行します', err);
        }
        
        // 成功メッセージを表示
        Alert.alert('成功', '返信を投稿しました');
        
      } else if (lastError) {
        // 最後のエラーをスローする前に、返信カウント更新エラーかチェック
        if (lastError instanceof Error && lastError.message.includes('最大リトライ回数')) {
          console.warn('返信カウント更新のリトライエラーは無視します');
          // 返信自体は成功したとみなし、モーダルを閉じる
          setReplyModalVisible(false);
          setReplyText('');
          setReplyImage(null);
          setSelectedReplyPost(null);
          return;
        }
        throw lastError;
      }
    } catch (error) {
      console.error('返信作成最終エラー:', error);
      
      let errorMessage = '返信の投稿に失敗しました';
      
      // エラーメッセージをより詳細に
      if (error instanceof Error) {
        // 返信カウント更新エラーは無視
        if (error.message.includes('最大リトライ回数')) {
          console.warn('返信カウント更新エラーは表示しません');
          setReplyModalVisible(false);
          return;
        }
        
        console.error('詳細エラー情報:', error.message);
        
        if (error.message.includes('permission-denied')) {
          errorMessage = '返信の権限がありません。アプリを再起動し、再度お試しください。';
        } else if (error.message.includes('not-found')) {
          errorMessage = '投稿または対象のサークルが見つかりませんでした。';
        } else if (error.message.includes('unavailable')) {
          errorMessage = 'サービスが一時的に利用できません。しばらく待ってから再試行してください。';
        } else {
          errorMessage = `エラー: ${error.message}`;
        }
      }
      
      Alert.alert('エラー', errorMessage);
      
      // どのようなエラーでも状態をリセットして回復を試みる
      setReplyModalVisible(false);
    } finally {
      // 状態をリセット
      setSubmitting(false);
      console.log('===== 返信処理完了 =====');
    }
  }, [user, selectedPost, selectedReplyPost, replyText, replyImage, circleId, viewingReplies]);

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
              // ローディング状態を表示
              setSubmitting(true);
              
              // 削除前に親投稿IDを保存
              const parentId = post.parentId;
              
              console.log('投稿削除開始:', { postId: post.id, userId: user.id });
              
              // 削除処理を実行
              await deleteBoardPost(post.id, user.id);
              
              // 削除完了後のUI更新処理
              console.log('UI更新処理開始');
              
              // 返信表示モードの場合
              if (viewingReplies && post.parentId) {
                // 返信リストから削除
                setReplies(prev => prev.filter(reply => reply.id !== post.id));
                
                // 親投稿の返信カウントを減らす
                setPosts(prev => 
                  prev.map(p => 
                    p.id === parentId
                      ? { ...p, replyCount: Math.max(0, p.replyCount - 1) }
                      : p
                  )
                );
              } else if (viewingReplies && selectedPost?.id === post.id) {
                // 表示中の親投稿が削除された場合は返信表示を閉じる
                setViewingReplies(false);
                setSelectedPost(null);
                setReplies([]);
                
                // 投稿リストから削除
                setPosts(prev => prev.filter(p => p.id !== post.id));
              } else {
                // 通常モードの場合は投稿リストから削除
                setPosts(prev => prev.filter(p => p.id !== post.id));
              }
              
              // 成功メッセージ
              console.log('投稿削除成功:', post.id);
              Alert.alert('成功', '投稿を削除しました');
            } catch (error) {
              console.error('投稿削除エラー:', error);
              
              let errorMessage = '投稿の削除に失敗しました';
              
              // エラーメッセージをより具体的に
              if (error instanceof Error) {
                if (error.message.includes('permission-denied')) {
                  errorMessage = '権限がありません。この投稿を削除できるのは投稿者のみです。';
                } else if (error.message.includes('not-found')) {
                  errorMessage = '投稿が見つかりませんでした。既に削除されている可能性があります。';
                } else {
                  errorMessage = `削除エラー: ${error.message}`;
                }
              }
              
              Alert.alert('エラー', errorMessage);
            } finally {
              // ローディング状態を解除
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // 返信に対する返信処理
  const handleReplyToReply = useCallback((replyPost: BoardPostWithUser) => {
    if (!selectedPost) return;
    
    console.log('返信に対する返信:', {
      replyPostId: replyPost.id,
      replyPostUser: replyPost.userId,
      currentUser: user?.id,
      parentPostId: selectedPost.id
    });
    
    // 返信先を設定
    setSelectedReplyPost(replyPost);
    
    // 返信テキストを初期化（@ユーザー名を先頭に付ける）
    setReplyText(`@${replyPost.user?.nickname || 'ユーザー'} `);
    
    // 返信モーダルの表示を確実にする
    setTimeout(() => {
      setReplyModalVisible(true);
    }, 100);
    
  }, [selectedPost, user]);

  // 返信モーダルのコンテンツを修正
  const renderReplyModal = () => (
    <Modal
      visible={replyModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setReplyModalVisible(false);
        setReplyText('');
        setReplyImage(null);
        setSelectedReplyPost(null);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedReplyPost ? '返信に返信' : '投稿に返信'}
              </Text>
              <TouchableOpacity onPress={() => {
                setReplyModalVisible(false);
                setReplyText('');
                setReplyImage(null);
                setSelectedReplyPost(null);
              }}>
                <Icon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            {/* 親投稿プレビュー */}
            <View style={styles.parentPostPreview}>
              <View style={styles.replyToUserHeader}>
                <Image 
                  source={{ 
                    uri: selectedReplyPost 
                      ? selectedReplyPost.user?.profilePhoto || DEFAULT_PROFILE_IMAGE 
                      : selectedPost?.user?.profilePhoto || DEFAULT_PROFILE_IMAGE 
                  }} 
                  style={styles.replyToAvatar} 
                />
                <Text style={styles.replyToName}>
                  @{selectedReplyPost ? selectedReplyPost.user?.nickname : selectedPost?.user?.nickname}
                </Text>
              </View>
              <Text numberOfLines={2} style={styles.previewText}>
                {selectedReplyPost ? selectedReplyPost.text : selectedPost?.text}
              </Text>
            </View>
            
            {/* 画像添付プレビュー */}
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
            
            {/* 入力フォームと送信ボタンを横並びに */}
            <View style={styles.inputRow}>
              {/* 画像添付ボタン */}
              <TouchableOpacity
                style={styles.attachButton}
                onPress={handleSelectImage}
              >
                <Icon name="image-outline" size={24} color="#666" />
              </TouchableOpacity>
              
              {/* 返信テキスト入力欄 */}
              <TextInput
                style={styles.inputField}
                placeholder="返信を入力..."
                multiline
                value={replyText}
                onChangeText={setReplyText}
                autoFocus={true}
              />
              
              {/* 送信ボタン */}
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!replyText.trim() && !replyImage) || submitting
                    ? styles.sendButtonDisabled
                    : null
                ]}
                onPress={() => {
                  console.log('返信送信ボタンタップ', { 
                    selectedPost: selectedPost?.id,
                    selectedPostUser: selectedPost?.userId,
                    currentUser: user?.id,
                    isOwnPost: selectedPost?.userId === user?.id
                  });
                  createReply();
                }}
                disabled={(!replyText.trim() && !replyImage) || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Icon name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // 時間フォーマット関数を追加
  const formatPostDate = (timestamp: any): string => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}日前`;
    
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 投稿アイテムを最適化してメモ化
  const renderItem = useCallback(({ item }: { item: BoardPostWithUser }) => {
    const isOwnPost = user && item.userId === user.id;
    
    // createdAtの処理を改善
    let formattedDate = '';
    try {
      if (item.createdAt) {
        // Firestore のタイムスタンプ型かを確認して適切に変換
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
        } else if (typeof item.createdAt === 'string' || typeof item.createdAt === 'number') {
          // 文字列または数値の場合
          const date = new Date(item.createdAt);
          formattedDate = date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          });
        } else {
          formattedDate = '不明な日付';
        }
      }
    } catch (err) {
      formattedDate = '不明な日付';
    }

    // 投稿の返信数とフラグを詳細にログ出力（デバッグ用）
    console.log(`レンダリング - 投稿ID: ${item.id}, 返信数: ${item.replyCount || 0}, _hasReplies: ${!!item._hasReplies}, 投稿者: ${item.userId}, 現在のユーザー: ${user?.id}`);

    // プロフィール画像とユーザー情報
    const profilePhoto = item.user?.profilePhoto || DEFAULT_PROFILE_IMAGE;
    const nickname = item.user?.nickname || '不明なユーザー';
    
    // 返信の場合は少し異なるスタイルを適用
    const isReply = !!item.parentId;
    const containerStyle = isReply 
      ? [styles.postContainer, styles.replyContainer]
      : styles.postContainer;

    // 返信表示ボタンの表示条件を改善
    // - 親投稿（parentIdなし）であること
    // - _hasRepliesフラグを最優先する（これは返信が確認された場合にセットされる）
    // - replyCountが0より大きい場合もボタンを表示（DBからの情報）
    // - 返信表示モードでない場合
    const shouldShowRepliesButton = (
      !item.parentId && 
      (item._hasReplies === true || item.replyCount > 0) && 
      !viewingReplies
    );

    // 返信がある可能性が高いが、まだ確認されていない場合
    const mayHaveReplies = !item.parentId && item.replyCount > 0 && !item._hasReplies;
    
    // 返信があることを示すバッジテキスト
    const replyBadgeText = `${item.replyCount || 0}`;

    return (
      <View style={containerStyle}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => navigation.navigate('UserProfile', { userId: item.user.id })}
          >
            <Image
              source={{ uri: profilePhoto }}
              style={styles.userAvatar}
            />
            <View>
              <Text style={styles.userName}>{nickname}</Text>
              <Text style={styles.postDate}>{formattedDate}</Text>
            </View>
          </TouchableOpacity>

          {isOwnPost && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handlePostMenu(item)}
            >
              <Icon name="ellipsis-horizontal" size={18} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 投稿テキスト */}
        {item.text && item.text.trim() !== '' && (
          <Text style={styles.postText}>{item.text}</Text>
        )}

        {/* 投稿画像 */}
        {item.imageUrl && (
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.postImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.postActions}>
          {/* いいねボタン */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleLike(item)}
          >
            <Icon
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={item.isLiked ? theme.colors.error : theme.colors.text.secondary}
            />
            <Text style={styles.actionText}>{item.likes?.length || 0}</Text>
          </TouchableOpacity>
          
          {/* 返信ボタン */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              console.log('返信ボタンタップ', {
                postId: item.id, 
                postUserId: item.userId, 
                currentUserId: user?.id,
                isOwnPost: item.userId === user?.id
              });
              
              // 選択した投稿を設定
              setSelectedPost(item);
              
              // 返信テキストに@ユーザー名を自動挿入
              setReplyText(`@${item.user?.nickname || 'ユーザー'} `);
              
              // 返信モーダル表示を確実にするため少し遅延させる
              setTimeout(() => {
                setReplyModalVisible(true);
                console.log('返信モーダル表示設定完了');
              }, 100);
            }}
          >
            <Icon 
              name="chatbubble-outline" 
              size={20} 
              color={theme.colors.text.secondary} 
            />
            <Text style={styles.actionText}>{item.replyCount || 0}</Text>
          </TouchableOpacity>
          
          {/* 返信表示ボタン - 親投稿で返信がある場合のみ表示 */}
          {shouldShowRepliesButton && (
            <TouchableOpacity
              style={[styles.viewRepliesButton, mayHaveReplies ? styles.pulsatingButton : null]}
              onPress={() => {
                console.log('返信表示ボタンがタップされました。投稿ID:', item.id, ', 返信数:', item.replyCount);
                fetchReplies(item);
              }}
            >
              <Text style={styles.viewRepliesText}>
                {`返信を表示 (${replyBadgeText})`}
              </Text>
              <Icon name="chevron-down" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [user, navigation, handleToggleLike, handlePostMenu, viewingReplies, fetchReplies]);

  // 返信モード時のアイテムレンダリング（ネスト返信サポート）
  const renderReplyItem = useCallback(({ item }: { item: BoardPostWithUser }) => {
    const formattedDate = formatPostDate(item.createdAt);
    const isNestedReply = Boolean(item.nestedLevel && item.nestedLevel > 0);
    
    return (
      <View style={[
        styles.replyItem,
        isNestedReply ? styles.nestedReplyItem : null
      ]}>
        {/* 返信先表示（ネストされた返信の場合） */}
        {isNestedReply && item.replyToUser && (
          <View style={styles.replyToIndicator}>
            <Icon name="return-down-forward-outline" size={14} color="#999" />
            <Text style={styles.replyToText}>返信先: {item.replyToUser}</Text>
          </View>
        )}
        
        <TouchableOpacity
          onPress={() => navigation.navigate('UserProfile', { userId: item.user.id })}
        >
          <Image
            source={{ uri: item.user.profilePhoto || DEFAULT_PROFILE_IMAGE }}
            style={styles.userAvatar}
          />
        </TouchableOpacity>
        
        <View style={styles.replyContent}>
          <View style={styles.replyHeader}>
            <Text style={styles.replyUserName}>{item.user.nickname}</Text>
            <Text style={styles.replyDateText}>{formattedDate}</Text>
          </View>
          
          <Text style={styles.replyBodyText}>{item.text}</Text>
          
          {item.imageUrl && (
            <TouchableOpacity onPress={() => handleImagePress(item.imageUrl)}>
              <Image source={{ uri: item.imageUrl }} style={styles.replyImageView} />
            </TouchableOpacity>
          )}
          
          <View style={styles.replyActions}>
            <TouchableOpacity
              style={styles.likeButton}
              onPress={() => handleToggleLike(item)}
            >
              <Icon
                name={item.isLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={item.isLiked ? theme.colors.error : '#666'}
              />
              {item.likes?.length > 0 && (
                <Text style={styles.likeCount}>{item.likes.length}</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.replyButton}
              onPress={() => handleReplyToReply(item)}
            >
              <Icon name="chatbubble-outline" size={18} color="#666" />
              <Text style={styles.replyText}>返信</Text>
            </TouchableOpacity>
            
            {item.userId === user?.id && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => handlePostMenu(item)}
              >
                <Icon name="ellipsis-horizontal" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }, [user, navigation, handleToggleLike]);

  // リストの空の状態をメモ化
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
          <Text style={styles.emptyText}>まだ投稿がありません</Text>
          <Text style={styles.emptySubText}>
            {noMorePosts 
              ? 'このサークルの掲示板にアクセスする権限がない可能性があります。サークルに参加して再度お試しください。'
              : '最初の投稿をしてみましょう！'
            }
          </Text>
        </View>
      )}
    </View>
  ), [loading, error, noMorePosts]);

  // リストフッターをメモ化
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadMoreIndicator}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }, [loadingMore]);

  // キーエクストラクターをメモ化
  const keyExtractor = useCallback((item: BoardPostWithUser) => {
    return `post-${item.id || Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // 投稿入力フォームをメモ化
  const renderPostForm = useMemo(() => (
    <View style={styles.inputContainer}>
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
          onPress={handleImagePick}
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
          onPress={handleSubmit}
          disabled={(!postText.trim() && !selectedImage) || uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  ), [postText, handleSubmit, selectedImage, handleImagePick, uploading]);

  return (
    <View style={styles.container}>
      {viewingReplies ? (
        // 返信表示モード
        <>
          <View style={styles.repliesHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setViewingReplies(false);
                setSelectedPost(null);
                setReplies([]);
                setSelectedReplyPost(null);
              }}
            >
              <Icon name="arrow-back" size={24} color="#000" />
              <Text style={styles.repliesTitle}>投稿へ戻る</Text>
            </TouchableOpacity>
          </View>
          
          {loadingReplies ? (
            <ActivityIndicator style={{ marginTop: 20 }} size="large" color={theme.colors.primary} />
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle-outline" size={48} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => selectedPost && fetchReplies(selectedPost)}
              >
                <Text style={styles.retryButtonText}>再試行</Text>
              </TouchableOpacity>
            </View>
          ) : replies.length === 0 ? (
            <View style={styles.emptyReplies}>
              <Text style={styles.noRepliesText}>返信はまだありません</Text>
              <Text style={styles.noRepliesSubText}>最初の返信を投稿しましょう</Text>
            </View>
          ) : (
            <FlatList
              data={replies}
              renderItem={renderReplyItem}
              keyExtractor={(item) => `reply-${item.id}`}
              contentContainerStyle={styles.repliesList}
            />
          )}
          
          {/* 返信中バナーを表示 */}
          {selectedReplyPost && (
            <View style={styles.replyingBanner}>
              <Text style={styles.replyingText}>
                <Text style={styles.replyingToName}>{selectedReplyPost.user?.nickname}</Text> さんに返信中
              </Text>
              <TouchableOpacity onPress={() => setSelectedReplyPost(null)}>
                <Icon name="close-circle" size={20} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>
          )}
          
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            style={styles.inputContainer}
          >
            <TouchableOpacity
              style={styles.attachButton}
              onPress={handleSelectImage}
            >
              <Icon name="image-outline" size={24} color="#666" />
            </TouchableOpacity>
            
            <TextInput
              style={styles.inputField}
              placeholder={selectedReplyPost ? "返信を入力..." : "コメントを入力..."}
              multiline
              value={selectedReplyPost ? replyText : postText}
              onChangeText={selectedReplyPost ? setReplyText : setPostText}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (selectedReplyPost ? (!replyText.trim() && !replyImage) : (!postText.trim() && !image)) || uploading
                  ? styles.sendButtonDisabled
                  : null
              ]}
              onPress={selectedReplyPost ? createReply : handleSubmit}
              disabled={(selectedReplyPost ? (!replyText.trim() && !replyImage) : (!postText.trim() && !image)) || uploading}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </>
      ) : (
        // 通常モード（既存のコード）
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.postsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={renderEmptyComponent}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          removeClippedSubviews={true}
        />
      )}
      
      {/* 投稿フォーム */}
      {!viewingReplies && renderPostForm}
      
      {/* 必ず返信モーダルをレンダリング */}
      {renderReplyModal()}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 8,
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
    padding: 24,
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.secondary,
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  postsList: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 120,
  },
  postContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 3,
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
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  userName: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: 15,
    color: '#333',
    marginBottom: 3,
  },
  postDate: {
    fontSize: 12,
    color: '#888',
  },
  deleteButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 20,
  },
  postText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 10,
    lineHeight: 20,
  },
  postImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f5',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6, 
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(240, 240, 245, 0.5)',
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
    fontFamily: theme.typography.fontFamily.medium,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    padding: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 4,
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
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: '#F6F6F9',
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 5,
    color: '#333',
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#4560db',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    shadowColor: '#4560db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#BDBDBD',
    shadowOpacity: 0,
    elevation: 0,
  },
  selectedImageContainer: {
    margin: 5,
    padding: 5,
    borderRadius: 10,
    backgroundColor: '#F6F6F9',
    position: 'relative',
  },
  selectedImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
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
  retryButton: {
    backgroundColor: '#4560db',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.error,
    marginTop: 16,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  replyContainer: {
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary + '30',
    paddingLeft: 10,
    marginBottom: 8,
  },
  viewRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginLeft: 8,
    backgroundColor: theme.colors.primary + '10',
  },
  viewRepliesText: {
    fontSize: 13,
    color: theme.colors.primary,
    marginRight: 4,
    fontFamily: theme.typography.fontFamily.medium,
  },
  repliesContainer: {
    flex: 1,
    backgroundColor: '#f8f8fa',
  },
  repliesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  repliesTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    marginLeft: 10,
  },
  emptyReplies: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noRepliesText: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  noRepliesSubText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  repliesList: {
    padding: 8,
    paddingBottom: 100,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    fontFamily: theme.typography.fontFamily.bold,
  },
  parentPostPreview: {
    backgroundColor: '#f8f8fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  replyToUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  replyToAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  replyToName: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
  },
  previewText: {
    color: '#666',
  },
  replyInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    minHeight: 100,
    maxHeight: 200,
    marginBottom: 15,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  replyItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  nestedReplyItem: {
    marginLeft: 20,
    marginTop: -8,
    borderLeftWidth: 2,
    borderLeftColor: `${theme.colors.primary}30`,
    paddingLeft: 8,
  },
  replyToIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingLeft: 8,
  },
  replyToText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  replyContent: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 12,
    marginLeft: 8,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  replyUserName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  replyDateText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  replyBodyText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    marginBottom: 8,
    lineHeight: 20,
  },
  replyImageView: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
  },
  replyActions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    padding: 4,
  },
  likeCount: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    padding: 4,
  },
  replyText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  moreButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  pulsatingButton: {
    backgroundColor: theme.colors.primary + '20',
  },
});

export default CircleBoardContent; 