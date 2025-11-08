import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileStackParamList, RootStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { User } from '../../models/User';
import { calculateDistance } from '../../utils/distanceCalculator';
import { DEFAULT_PROFILE_IMAGE, DEFAULT_COVER_IMAGE } from '../../utils/defaultImages';
import { getLocationString, getPrefectureById } from '../../utils/prefectureData';
import { Post } from '../../models/Post';
import { Circle } from '../../models/Circle';
import { UserActionMenu } from '../../components/modals/UserActionMenu';

type ProfileScreenRouteProp = RouteProp<ProfileStackParamList, 'UserProfile' | 'Profile'>;
type ProfileScreenNavigationProp = StackNavigationProp<ProfileStackParamList & RootStackParamList, 'UserProfile' | 'Profile'>;

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const route = useRoute<ProfileScreenRouteProp>();
  const { user: currentUser, followUser, unfollowUser, updateProfile, acceptFollowRequest, rejectFollowRequest, cancelFollowRequest } = useAuth();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [postLoading, setPostLoading] = useState(true);
  const [userDistance, setUserDistance] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [userCircles, setUserCircles] = useState<any[]>([]);
  const [loadingCircles, setLoadingCircles] = useState(false);
  const [pendingFollowerUsers, setPendingFollowerUsers] = useState<User[]>([]);
  const [loadingPendingFollowers, setLoadingPendingFollowers] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  // 投稿モーダル用の状態
  const [showPostModal, setShowPostModal] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [posting, setPosting] = useState(false);
  
  // ブロック関連の状態追加
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  
  // URLから渡されたuserIdを取得、なければ現在のユーザーのプロフィールを表示
  const userId = route.params?.userId || currentUser?.id;
  const isOwnProfile = currentUser && userId === currentUser?.id;

  useEffect(() => {
    fetchUserData();
    // 投稿データも初期表示時に取得
    fetchUserPosts();
  }, [userId]);
  
  // 通知画面へ移動するヘッダーボタンを追加
  useEffect(() => {
    if (isOwnProfile) {
      navigation.setOptions({
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            {/* 通知ボタン */}
            <TouchableOpacity
              style={[styles.headerButton, { marginRight: 8 }]}
              onPress={() => {
                // ProfileStack内にNotificationsが無いため、rootNavigatorのNotificationsへ遷移
                // @ts-ignore - ナビゲーションのタイプを一時的に無視
                navigation.navigate('Main', { screen: 'Notification', params: { screen: 'Notifications' } });
              }}
            >
              <Icon name="bell" size={24} color={theme.colors.text.primary} />
              {profileUser?.pendingFollowers && profileUser.pendingFollowers.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {profileUser.pendingFollowers.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* 設定ボタン */}
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Icon name="settings-outline" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
        ),
      });
    } else if (profileUser) {
      // 他人のプロフィールの場合は三点メニューを表示
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowActionMenu(true)}
          >
            <Icon name="ellipsis-vertical" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, isOwnProfile, profileUser, profileUser?.pendingFollowers]);
  
  // ユーザーデータの取得 - パフォーマンス改善
  const fetchUserData = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      // 並列でデータを取得して高速化
      const [userDocSnapshot, currentUserSnapshot] = await Promise.all([
        firestore().collection('users').doc(userId).get(),
        currentUser ? firestore().collection('users').doc(currentUser.id).get() : Promise.resolve(null)
      ]);
      
      // 最新のcurrentUserの情報を取得（フォロー状態を確実に把握するため）
      let updatedCurrentUser = currentUser;
      if (currentUserSnapshot && currentUserSnapshot.exists) {
        updatedCurrentUser = {
          ...currentUserSnapshot.data() as User,
          id: currentUserSnapshot.id,
        };
      }
      
      if (userDocSnapshot.exists) {
        const userData = userDocSnapshot.data() as User;
        
        // ブロックされているかチェック - 自分のプロフィールでない場合のみ
        if (!isOwnProfile && updatedCurrentUser) {
          if (userData.blockedUsers && userData.blockedUsers.includes(updatedCurrentUser.id)) {
            // ブロックされている場合はアラートを表示して前の画面に戻る
            Alert.alert(
              'アクセス制限',
              'このユーザーのプロフィールにアクセスできません。',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            return;
          }
        }
        
        const profileUserData = {
          ...userData,
          id: userDocSnapshot.id,
        };
        
        setProfileUser(profileUserData);
        
        // フォロー状態の確認（最新のユーザーデータを使用）
        if (updatedCurrentUser && updatedCurrentUser.following && updatedCurrentUser.following.includes(userId)) {
          setIsFollowing(true);
          setHasPendingRequest(false);
        } else if (userData.accountPrivacy === 'private' && 
                 updatedCurrentUser && 
                 userData.pendingFollowers && 
                 userData.pendingFollowers.includes(updatedCurrentUser.id)) {
          setHasPendingRequest(true);
          setIsFollowing(false);
        } else {
          setIsFollowing(false);
          setHasPendingRequest(false);
        }
        
        // ブロック状態を確認
        if (updatedCurrentUser && updatedCurrentUser.blockedUsers && updatedCurrentUser.blockedUsers.includes(userId)) {
          setIsUserBlocked(true);
        } else {
          setIsUserBlocked(false);
        }
        
        // 距離の計算（相手のプロフィールかつ位置情報が有効な場合）
        if (!isOwnProfile && updatedCurrentUser && userData.location && updatedCurrentUser.location) {
          // プライバシー設定に関わらず距離を計算して表示
          const distance = calculateDistance(
            { latitude: updatedCurrentUser.location.latitude, longitude: updatedCurrentUser.location.longitude },
            { latitude: userData.location.latitude, longitude: userData.location.longitude }
          );
          
          // キロメートル単位で表示（小数点以下切り捨て）
          const distanceVal = parseFloat(distance);
          if (distanceVal < 1) {
            setUserDistance("1km");
          } else {
            setUserDistance(`${Math.round(distanceVal)}km`);
          }
        }
        
        // 自分のプロフィールの場合、フォローリクエストを取得
        if (isOwnProfile && userData.pendingFollowers && userData.pendingFollowers.length > 0) {
          fetchPendingFollowerUsers(userData.pendingFollowers);
        }
        
        // ユーザーのサークルを並列で取得（投稿データ取得と同時進行）
        fetchUserCircles(userDocSnapshot.id);
      } else {
        Alert.alert('エラー', 'ユーザーが見つかりませんでした');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('エラー', 'ユーザー情報の取得に失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // ユーザーの投稿を取得 - パフォーマンス改善
  const fetchUserPosts = async () => {
    if (!userId) return;
    
    try {
      setPostLoading(true);
      
      // ブロック関係をチェック - 自分のプロフィールでない場合のみ
      if (!isOwnProfile && currentUser) {
        // 自分がブロックしている場合
        if (currentUser.blockedUsers && currentUser.blockedUsers.includes(userId)) {
          setPosts([]);
          setPostLoading(false);
          return;
        }
        
        // 自分がブロックされている場合
        if (profileUser?.blockedUsers && profileUser.blockedUsers.includes(currentUser.id)) {
          setPosts([]);
          setPostLoading(false);
          return;
        }
      }
      
      // パフォーマンス向上のためにクエリ制限を設定
      const postsSnapshot = await firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(10) // 初期表示件数を制限
        .get();
      
      const postsData = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
      
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setPostLoading(false);
    }
  };
  
  // ユーザーのサークルを取得 - パフォーマンス改善
  const fetchUserCircles = async (uid: string) => {
    setLoadingCircles(true);
    try {
      // ブロック関係をチェック - 自分のプロフィールでない場合のみ
      if (!isOwnProfile && currentUser) {
        // 自分がブロックしている場合
        if (currentUser.blockedUsers && currentUser.blockedUsers.includes(uid)) {
          setUserCircles([]);
          setLoadingCircles(false);
          return;
        }
        
        // 自分がブロックされている場合
        if (profileUser?.blockedUsers && profileUser.blockedUsers.includes(currentUser.id)) {
          setUserCircles([]);
          setLoadingCircles(false);
          return;
        }
      }
      
      const userDoc = await firestore().collection('users').doc(uid).get();
      const userData = userDoc.data();
      
      if (userData && userData.circles && userData.circles.length > 0) {
        // サークルデータを並列で効率的に取得
        const circlePromises = userData.circles.map((circleId: string) => 
          firestore().collection('circles').doc(circleId).get()
        );
        
        const circleResults = await Promise.all(circlePromises);
        
        let circlesData = circleResults
          .filter(doc => doc.exists)
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
        
        setUserCircles(circlesData);
      } else {
        setUserCircles([]);
      }
    } catch (error) {
      console.error('Error fetching user circles:', error);
    } finally {
      setLoadingCircles(false);
    }
  };

  // フォローリクエストユーザーの情報を取得
  const fetchPendingFollowerUsers = async (pendingIds: string[]) => {
    setLoadingPendingFollowers(true);
    try {
      if (!pendingIds || pendingIds.length === 0) {
        setPendingFollowerUsers([]);
        return;
      }
      
      // 各フォローリクエストユーザーの情報を取得
      const userPromises = pendingIds.map(id => 
        firestore().collection('users').doc(id).get()
      );
      
      const userResults = await Promise.all(userPromises);
      const userData = userResults
        .filter(doc => doc.exists)
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as User));
      
      setPendingFollowerUsers(userData);
    } catch (error) {
      console.error('Error fetching pending follower users:', error);
    } finally {
      setLoadingPendingFollowers(false);
    }
  };
  
  // フォローリクエストを承認
  const handleAcceptFollowRequest = async (userId: string) => {
    try {
      await acceptFollowRequest(userId);
      // 承認後に表示を更新
      setPendingFollowerUsers(prev => prev.filter(user => user.id !== userId));
      
      // 最新のユーザー情報を取得
      fetchUserData();
      
      // 要求元ユーザーのプロフィールを表示している場合は、isFollowingを更新
      if (userId === route.params?.userId) {
        setIsFollowing(true);
        setHasPendingRequest(false);
      }
      
      // 成功通知を表示
      Alert.alert('成功', 'フォローリクエストを承認しました');
    } catch (error) {
      console.error('Error accepting follow request:', error);
      Alert.alert('エラー', 'フォローリクエストの承認に失敗しました');
    }
  };
  
  // フォローリクエストを拒否
  const handleRejectFollowRequest = async (userId: string) => {
    try {
      await rejectFollowRequest(userId);
      // 拒否後に表示を更新
      setPendingFollowerUsers(prev => prev.filter(user => user.id !== userId));
      // 最新のユーザー情報を取得
      fetchUserData();
      // 成功通知を表示
      Alert.alert('成功', 'フォローリクエストを拒否しました');
    } catch (error) {
      console.error('Error rejecting follow request:', error);
      Alert.alert('エラー', 'フォローリクエストの拒否に失敗しました');
    }
  };

  // フォロー/フォロー解除の処理
  const handleFollowToggle = async () => {
    if (!profileUser || !currentUser) return;
    
    // ブロックしているユーザーはフォローできない
    if (isUserBlocked) {
      Alert.alert('エラー', 'ブロックしているユーザーはフォローできません。ブロックを解除してからお試しください。');
      return;
    }
    
    // アクション実行前に先行してUI状態を更新して応答性を向上
    const previousFollowingState = isFollowing;
    const previousPendingState = hasPendingRequest;
    
    try {
      // ローディング状態を設定
      setFollowLoading(true);
      
      if (isFollowing) {
        // 先にUI状態を更新
        setIsFollowing(false);
        
        // バックグラウンドでAPI呼び出し
        await unfollowUser(profileUser.id);
      } else if (hasPendingRequest) {
        // 先にUI状態を更新
        setHasPendingRequest(false);
        
        // リクエストを取り消す
        await cancelFollowRequest(profileUser.id);
      } else {
        // フォロー処理の前にUI状態を暫定的に更新
        // 結果に応じて最終的な状態を設定
        
        const result = await followUser(profileUser.id);
        if (result.success && !result.isPending) {
          setIsFollowing(true);
        } else if (result.success && result.isPending) {
          setHasPendingRequest(true);
          Alert.alert('フォローリクエスト送信', `${profileUser.nickname}さんにフォローリクエストを送信しました。承認されるまでお待ちください。`);
        }
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      // エラー時には元の状態に戻す
      setIsFollowing(previousFollowingState);
      setHasPendingRequest(previousPendingState);
      Alert.alert('エラー', 'フォロー操作に失敗しました');
    } finally {
      setFollowLoading(false);
    }
  };
  
  // 画面の更新処理 - 並列処理に変更
  const handleRefresh = () => {
    setRefreshing(true);
    // 両方のデータを並列で取得
    Promise.all([
      fetchUserData(),
      fetchUserPosts()
    ]).finally(() => {
      setRefreshing(false);
    });
  };
  
  // handleLikePost 関数を追加
  const handleLikePost = async (postId: string, isLiked: boolean) => {
    if (!currentUser) {
      Alert.alert('エラー', 'いいねするにはログインが必要です');
      return;
    }
    
    try {
      const postRef = firestore().collection('posts').doc(postId);
      
      if (isLiked) {
        // いいねを解除
        await postRef.update({
          likes: firestore.FieldValue.arrayRemove(currentUser.id)
        });
      } else {
        // いいねを追加
        await postRef.update({
          likes: firestore.FieldValue.arrayUnion(currentUser.id)
        });
      }
      
      // UIを更新
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId
            ? { 
                ...post, 
                likes: isLiked 
                  ? (post.likes || []).filter((id: string) => id !== currentUser.id)
                  : [...(post.likes || []), currentUser.id]
              }
            : post
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('エラー', 'いいねの更新に失敗しました');
    }
  };
  
  // 投稿一覧の表示 - ローディング表示を追加
  const renderPosts = () => {
    if (postLoading) {
      return (
        <View style={styles.loadingPostsContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>投稿を読み込み中...</Text>
        </View>
      );
    }
    
    if (posts.length === 0) {
      return (
        <View style={styles.noPostsContainer}>
          <Text style={styles.noPostsText}>
            {isOwnProfile ? '投稿がありません。最初の投稿をしましょう！' : 'このユーザーはまだ投稿していません'}
          </Text>
        </View>
      );
    }
    
    return posts.map((post, index) => {
      const isLiked = currentUser ? (post.likes || []).includes(currentUser.id) : false;
      
      return (
      <View key={`post-${post.id}-${index}`} style={styles.postItem}>
        <View style={styles.postHeader}>
          <Image
            source={{ uri: profileUser?.profilePhoto || DEFAULT_PROFILE_IMAGE }}
            style={styles.postUserPhoto}
          />
          <View style={styles.postUserInfo}>
            <Text style={styles.postUserName}>{profileUser?.nickname}</Text>
            <Text style={styles.postTime}>
              {post.createdAt instanceof Date ? 
                post.createdAt.toLocaleDateString('ja-JP') : 
                new Date().toLocaleDateString('ja-JP')}
            </Text>
          </View>
        </View>
        
        <Text style={styles.postContent}>{post.text}</Text>
        
        <View style={styles.postActions}>
          <TouchableOpacity 
            style={styles.postAction}
              onPress={() => handleLikePost(post.id, isLiked)}
            >
              <Icon 
                name="heart" 
                size={20} 
                color={isLiked ? theme.colors.secondary : theme.colors.text.secondary} 
              />
            <Text style={styles.postActionText}>{post.likes?.length || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.postAction}
            onPress={() => navigation.navigate('CommentsList', { postId: post.id })}
          >
              <Icon name="chatbubble" size={20} color={theme.colors.text.secondary} />
            <Text style={styles.postActionText}>{post.comments || 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
      );
    });
  };
  
  // 投稿モーダルの表示
  const renderPostModal = () => {
    const MAX_POST_LENGTH = 500;
    const isOverLimit = newPostText.length > MAX_POST_LENGTH;
    const isNearLimit = newPostText.length > MAX_POST_LENGTH * 0.8;
    
    return (
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>新規投稿</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowPostModal(false)}
            >
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
          />
          
          <Text 
            style={[
              styles.charCount,
              isNearLimit && !isOverLimit && styles.charCountWarning,
              isOverLimit && styles.charCountError
            ]}
          >
            {newPostText.length}/{MAX_POST_LENGTH}
          </Text>
          
          <TouchableOpacity
            style={[
              styles.postButton,
              (newPostText.trim().length === 0 || 
               isOverLimit || 
               posting) && styles.postButtonDisabled
            ]}
            onPress={handleCreatePost}
            disabled={newPostText.trim().length === 0 || isOverLimit || posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>投稿する</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // 投稿作成処理
  const handleCreatePost = async () => {
    if (!currentUser) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }
    
    if (newPostText.trim().length === 0) {
      Alert.alert('エラー', '投稿内容を入力してください');
      return;
    }
    
    if (newPostText.length > 500) {
      Alert.alert('エラー', '投稿は500文字以内にしてください');
      return;
    }
    
    setPosting(true);
    
    try {
      const newPost = {
        userId: currentUser.id,
        text: newPostText.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        likes: [],
        comments: 0
      };
      
      await firestore().collection('posts').add(newPost);
      
      // 投稿成功
      setNewPostText('');
      setShowPostModal(false);
      
      // 投稿一覧を更新
      fetchUserPosts();
      
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('エラー', '投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  // メッセージ送信権限のチェック
  const checkMessagePermission = async (targetUser: User | null): Promise<boolean> => {
    if (!currentUser || !targetUser) return false;
    
    try {
      console.log('メッセージ権限チェック開始', {
        currentUserId: currentUser.id,
        targetUserId: targetUser.id,
        targetPrivacy: targetUser.accountPrivacy || 'public'
      });
      
      // 自分自身には送信できない
      if (currentUser.id === targetUser.id) {
        console.log('自分自身にはメッセージを送信できません');
        Alert.alert('注意', '自分自身にはメッセージを送信できません');
        return false;
      }

      // ブロックしているユーザーには送信できない
      if (currentUser.blockedUsers && currentUser.blockedUsers.includes(targetUser.id)) {
        console.log('ブロックしているユーザーにはメッセージを送信できません');
        Alert.alert('注意', 'このユーザーはブロックしています。メッセージを送信できません。');
        return false;
      }

      // ブロックされているユーザーには送信できない
      if (targetUser.blockedUsers && targetUser.blockedUsers.includes(currentUser.id)) {
        console.log('ブロックされているユーザーにはメッセージを送信できません');
        Alert.alert('注意', 'このユーザーからブロックされています。メッセージを送信できません。');
        return false;
      }
      
      // accountPrivacyが未設定の場合はpublicとして扱う
      const targetPrivacy = targetUser.accountPrivacy || 'public';
      
      // 相手のアカウントがオープンの場合は誰でもメッセージ送信可能
      if (targetPrivacy === 'public') {
        console.log('オープンアカウントのため、メッセージ送信可能');
        return true;
      }
      
      // 相手のアカウントが鍵付きの場合は、相互フォロー関係が必要
      if (targetPrivacy === 'private') {
        // Firebase Authからの認証IDを取得
        const authUser = firestore().app.auth().currentUser;
        if (!authUser) {
          console.error('認証情報が見つかりません');
          Alert.alert('エラー', '認証情報が見つかりません。再ログインしてください。');
          return false;
        }

        // リアルタイムでフォロー状態を取得
        const currentUserDoc = await firestore().collection('users').doc(authUser.uid).get();
        const targetUserDoc = await firestore().collection('users').doc(targetUser.id).get();
        
        if (!currentUserDoc.exists || !targetUserDoc.exists) {
          console.log('ユーザーデータの取得に失敗');
          return false;
        }
        
        const currentUserData = currentUserDoc.data() || {};
        const targetUserData = targetUserDoc.data() || {};
        
        // 自分が相手をフォローしているか確認（最新データ）
        const currentUserFollowing = currentUserData.following || [];
        const isFollowingTarget = currentUserFollowing.includes(targetUser.id);
        
        // 相手が自分をフォローしているか確認（最新データ）
        const targetUserFollowers = targetUserData.followers || [];
        const isFollowedByTarget = targetUserFollowers.includes(authUser.uid);
        
        console.log('フォロー関係', {
          isFollowingTarget,
          isFollowedByTarget,
          currentUserFollowing,
          targetUserFollowers
        });
        
        // 相互フォローの場合のみメッセージ送信可能
        if (isFollowingTarget && isFollowedByTarget) {
          console.log('相互フォロー関係のため、メッセージ送信可能');
          return true;
        } else {
          if (!isFollowingTarget) {
            Alert.alert(
              'メッセージ送信制限',
              `${targetUser.nickname}さんをフォローする必要があります。`,
              [
                { text: 'キャンセル', style: 'cancel' },
                { 
                  text: 'フォローする', 
                  onPress: () => handleFollowToggle() 
                }
              ]
            );
          } else if (!isFollowedByTarget) {
            Alert.alert(
              'メッセージ送信制限',
              `${targetUser.nickname}さんからフォローされていません。相互フォロー関係が必要です。`,
              [{ text: 'OK' }]
            );
          }
          console.log('相互フォロー関係が確立されていません');
          return false;
        }
      }
      
      // デフォルトでは送信不可
      console.log('未知のプライバシー設定：' + targetPrivacy);
      Alert.alert('エラー', 'このユーザーのプライバシー設定に問題があります。');
      return false;
    } catch (error) {
      console.error('Error checking message permission:', error);
      Alert.alert('エラー', 'メッセージ権限の確認に失敗しました');
      return false;
    }
  };

  // フォローリクエスト一覧の表示
  const renderPendingFollowRequests = () => {
    if (!isOwnProfile || pendingFollowerUsers.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.pendingRequestsContainer}>
        <Text style={styles.sectionTitle}>フォローリクエスト</Text>
        <Text style={styles.pendingRequestsCount}>{pendingFollowerUsers.length}件のリクエストがあります</Text>
        
        {pendingFollowerUsers.map(user => (
          <View key={`pending-follower-${user.id}`} style={styles.pendingRequestItem}>
            <TouchableOpacity 
              style={styles.pendingRequestUser}
              onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
            >
              <Image
                source={{ uri: user.profilePhoto || DEFAULT_PROFILE_IMAGE }}
                style={styles.pendingRequestUserPhoto}
              />
              <Text style={styles.pendingRequestUserName}>{user.nickname}</Text>
            </TouchableOpacity>
            
            <View style={styles.pendingRequestActions}>
              <TouchableOpacity
                style={[styles.pendingRequestButton, styles.acceptButton]}
                onPress={() => handleAcceptFollowRequest(user.id)}
              >
                <Text style={styles.acceptButtonText}>承認</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.pendingRequestButton, styles.rejectButton]}
                onPress={() => handleRejectFollowRequest(user.id)}
              >
                <Text style={styles.rejectButtonText}>拒否</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // ブロック状態変更後の処理
  const handleBlockStatusChanged = () => {
    setIsUserBlocked(!isUserBlocked);
    fetchUserData(); // プロフィールデータを再取得
  };

  // プロフィールアクションボタンのレンダリング（自分以外のプロフィールの場合）
  const renderProfileActions = () => {
    if (!profileUser || isOwnProfile) return null;
    
    return (
      <View style={styles.profileActions}>
        {/* フォローボタン */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isFollowing ? styles.unfollowButton : styles.followButton,
            hasPendingRequest && styles.pendingButton
          ]}
          onPress={handleFollowToggle}
          disabled={followLoading}
        >
          {followLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? "#333" : "#fff"} />
          ) : (
            <Text style={[
              styles.actionButtonText,
              isFollowing ? styles.unfollowButtonText : styles.followButtonText
            ]}>
              {isFollowing ? 'フォロー中' : (hasPendingRequest ? 'リクエスト中' : 'フォローする')}
            </Text>
          )}
        </TouchableOpacity>
        
        {/* メッセージボタン */}
        <TouchableOpacity
          style={[styles.actionButton, styles.messageButton]}
          onPress={async () => {
            if (!currentUser) return;
            
            const hasPermission = await checkMessagePermission(profileUser);
            if (hasPermission) {
              // ユーザーIDをソートして常に同じルームIDが生成されるようにする
              const participantIds = [currentUser.id, profileUser.id].sort();
              const roomId = `chat_${participantIds[0]}_${participantIds[1]}`;

              // チャットルームが存在するか確認
              try {
                // チャットルームを検索
                const chatRoomRef = await firestore().collection('chatRooms').doc(roomId);
                const chatRoomDoc = await chatRoomRef.get();
                
                if (!chatRoomDoc.exists) {
                  // 存在しない場合は新規作成（hiddenフィールドは含まない）
                  await chatRoomRef.set({
                    participantIds: participantIds,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                    lastMessage: {
                      content: '',
                      senderId: '',
                      timestamp: null,
                    },
                    unreadCount: {
                      [participantIds[0]]: 0,
                      [participantIds[1]]: 0
                    }
                  });
                } else {
                  // すでに存在する場合は、hiddenフィールドを確認してリセット
                  const roomData = chatRoomDoc.data();
                  
                  // hiddenフィールドがあれば確認
                  if (roomData?.hidden) {
                    const hiddenField = {...roomData.hidden};
                    let needsUpdate = false;
                    
                    // どちらかのユーザーがトークを非表示にしていた場合はリセット
                    if (hiddenField[currentUser.id] || hiddenField[profileUser.id]) {
                      delete hiddenField[currentUser.id];
                      delete hiddenField[profileUser.id];
                      needsUpdate = true;
                    }
                    
                    // 更新が必要な場合のみFirestoreを更新
                    if (needsUpdate) {
                      await chatRoomRef.update({
                        hidden: hiddenField,
                        updatedAt: firestore.FieldValue.serverTimestamp()
                      });
                      console.log('チャットルームの表示状態をリセットしました:', roomId);
                    }
                  }
                }
                
                // チャットルーム画面に遷移
                navigation.navigate('ChatRoom', {
                  roomId: roomId,
                  otherUserId: profileUser.id,
                  otherUserName: profileUser.nickname
                });
              } catch (error) {
                console.error("チャットルーム準備エラー:", error);
                Alert.alert("エラー", "チャットルームの準備に失敗しました");
              }
            }
          }}
        >
          <Text style={styles.messageButtonText}>メッセージ</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // プロフィールヘッダー部分
  const renderProfileHeader = () => {
    if (!profileUser) return null;
    
    return (
      <View style={styles.profileHeader}>
        {/* カバー画像 */}
        <Image
          source={{ uri: profileUser.coverPhoto || DEFAULT_COVER_IMAGE }}
          style={styles.coverPhoto}
        />
        
        {/* プロフィール画像 */}
        <View style={styles.profilePhotoContainer}>
          <Image
            source={{ uri: profileUser.profilePhoto || DEFAULT_PROFILE_IMAGE }}
            style={styles.profilePhoto}
          />
        </View>
        
        {/* ユーザー情報 */}
        <View style={styles.userInfoContainer}>
          <Text style={styles.userName}>{profileUser.nickname}</Text>
          
          {/* 距離表示（他人のプロフィールの場合） */}
          {!isOwnProfile && userDistance && (
            <View style={styles.distanceBadge}>
              <Icon name="navigate" size={16} color={theme.colors.text.inverse} />
              <Text style={styles.distanceBadgeText}>{userDistance}</Text>
            </View>
          )}
          
          {/* 性別表示 */}
          {profileUser.gender && (
            <View style={styles.infoContainer}>
              <Icon name="person" size={16} color={theme.colors.text.secondary} />
              <Text style={styles.infoText}>
                {profileUser.gender === 'male' ? '男性' : 
                 profileUser.gender === 'female' ? '女性' : 'その他'}
              </Text>
            </View>
          )}
          
          {/* 居住地表示（都道府県のみ） */}
          {profileUser.prefecture && (
            <View style={styles.locationContainer}>
              <Icon name="home" size={16} color={theme.colors.text.secondary} />
              <Text style={styles.locationText}>
                {getPrefectureById(profileUser.prefecture)?.name || profileUser.prefecture}
              </Text>
            </View>
          )}
          
          {/* 自己紹介 */}
          {profileUser.bio && (
            <Text style={styles.bioText}>{profileUser.bio}</Text>
          )}
          
          {/* フォロー/フォロワー情報 */}
          <View style={styles.statsContainer}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => navigation.navigate('Followers', { userId: profileUser.id })}
            >
              <Text style={styles.statNumber}>{profileUser.followers?.length || 0}</Text>
              <Text style={styles.statLabel}>フォロワー</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => navigation.navigate('Following', { userId: profileUser.id })}
            >
              <Text style={styles.statNumber}>{profileUser.following?.length || 0}</Text>
              <Text style={styles.statLabel}>フォロー中</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => {
                // サークル数にかかわらず常にMyCirclesに遷移する
                // 自分のプロフィールの場合はuserIdパラメータなし、他人の場合はuserIdパラメータ付き
                if (isOwnProfile) {
                  console.log('自分のサークル一覧に遷移');
                  navigation.navigate('MyCircles', {});
                } else {
                  console.log(`${profileUser.nickname}のサークル一覧に遷移`, { userId: profileUser.id });
                  navigation.navigate('MyCircles', { userId: profileUser.id });
                }
              }}
            >
              <Text style={styles.statNumber}>{profileUser.circles?.length || 0}</Text>
              <Text style={styles.statLabel}>サークル</Text>
            </TouchableOpacity>
          </View>
          
          {/* アクションボタン */}
          <View style={styles.actionContainer}>
            {isOwnProfile ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton]}
                  onPress={() => navigation.navigate('EditProfile')}
                >
                  <Text style={styles.primaryButtonText}>プロフィール編集</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={() => setShowPostModal(true)}
                >
                  <Icon name="create" size={20} color={theme.colors.primary} />
                  <Text style={styles.secondaryButtonText}>投稿する</Text>
                </TouchableOpacity>
              </>
            ) : (
              renderProfileActions()
            )}
          </View>
        </View>
      </View>
    );
  };
  
  // サークル一覧表示
  const renderUserCircles = () => {
    if (loadingCircles) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>サークル情報を読み込み中...</Text>
        </View>
      );
    }
    
    if (userCircles.length === 0) {
      return (
        <View style={styles.noCirclesContainer}>
          <Text style={styles.noCirclesText}>
            {isOwnProfile ? 'サークルに参加していません' : 'このユーザーはサークルに参加していません'}
          </Text>
        </View>
      );
    }
    
    return (
      <View style={styles.circlesContainer}>
        <Text style={styles.sectionTitle}>参加中のサークル</Text>
        <FlatList
          data={userCircles}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `circle-${item.id}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.circleItem}
              onPress={() => navigation.navigate('CircleDetails', { circleId: item.id })}
            >
              <Image
                source={{ uri: item.iconUrl || DEFAULT_PROFILE_IMAGE }}
                style={styles.circleImage}
              />
              <Text style={styles.circleName} numberOfLines={1}>{item.name}</Text>
              {item.activityArea && (
                <Text style={styles.circleLocation} numberOfLines={1}>{item.activityArea}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <>
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.colors.primary]}
              />
            }
          >
            {renderProfileHeader()}
            
            {/* フォローリクエスト一覧（自分のプロフィールの場合のみ） */}
            {renderPendingFollowRequests()}
            
            {/* サークル一覧 */}
            {renderUserCircles()}
            
            {/* 投稿一覧 */}
            <View style={styles.postsContainer}>
              <Text style={styles.sectionTitle}>投稿</Text>
              {renderPosts()}
            </View>
          </ScrollView>
          
          {/* 投稿作成モーダル */}
          <Modal
            visible={showPostModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowPostModal(false)}
          >
            {renderPostModal()}
          </Modal>
          
          {/* プロフィールアクションメニュー */}
          {profileUser && !isOwnProfile && (
            <UserActionMenu
              visible={showActionMenu}
              onClose={() => setShowActionMenu(false)}
              userId={profileUser.id}
              userName={profileUser.nickname}
              isBlocked={isUserBlocked}
              onBlockStatusChanged={handleBlockStatusChanged}
            />
          )}
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    marginBottom: 16,
  },
  coverPhoto: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  profilePhotoContainer: {
    alignItems: 'center',
    marginTop: -50,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  userInfoContainer: {
    padding: 16,
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 8,
  },
  distanceBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text.inverse,
    marginLeft: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  bioText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  circlesContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  noCirclesContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noCirclesText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  circleItem: {
    width: 120,
    marginHorizontal: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  circleImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  circleName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  circleLocation: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  postsContainer: {
    flex: 1,
  },
  noPostsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noPostsText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  postItem: {
    backgroundColor: theme.colors.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    padding: 16,
    ...theme.shadows.sm,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postUserPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  postUserInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  postTime: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  postContent: {
    fontSize: 16,
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postActionText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 8,
  },
  postInput: {
    height: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  charCount: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'right',
    marginBottom: 16,
  },
  charCountWarning: {
    color: theme.colors.warning,
  },
  charCountError: {
    color: theme.colors.error,
  },
  postButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: theme.colors.text.disabled,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // フォローリクエスト関連のスタイル
  pendingRequestsContainer: {
    padding: 15,
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    marginHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#efefef',
  },
  pendingRequestsCount: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 10,
  },
  pendingRequestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#efefef',
  },
  pendingRequestUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pendingRequestUserPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  pendingRequestUserName: {
    fontSize: 16,
    fontWeight: '500',
  },
  pendingRequestActions: {
    flexDirection: 'row',
  },
  pendingRequestButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
  },
  acceptButton: {
    backgroundColor: theme.colors.primary,
  },
  rejectButton: {
    backgroundColor: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  rejectButtonText: {
    color: theme.colors.text.primary,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  headerButton: {
    padding: 8,
  },
  notificationBadge: {
    backgroundColor: theme.colors.error,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 4,
  },
  notificationBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionButtonText: {
    color: theme.colors.text.primary,
    fontWeight: 'bold',
  },
  unfollowButton: {
    backgroundColor: theme.colors.error,
  },
  unfollowButtonText: {
    color: '#fff',
  },
  followButton: {
    backgroundColor: theme.colors.primary,
  },
  followButtonText: {
    color: '#fff',
  },
  pendingButton: {
    backgroundColor: theme.colors.primary,
  },
  messageButton: {
    backgroundColor: theme.colors.primary,
  },
  messageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  loadingPostsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProfileScreen;