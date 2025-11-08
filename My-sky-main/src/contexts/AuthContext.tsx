import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserCredentials, UserRegistration } from '../models/User';
import { getUserById } from '../services/userService';
import { createFollowRequestNotification, createFollowNotification } from '../services/notificationService';

interface AuthContextData {
  user: User | null;
  loading: boolean;
  signIn: (credentials: UserCredentials) => Promise<void>;
  signUp: (userData: UserRegistration) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  followUser: (userId: string) => Promise<{ success: boolean; isPending: boolean }>;
  unfollowUser: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  acceptFollowRequest: (userId: string) => Promise<void>;
  rejectFollowRequest: (userId: string) => Promise<void>;
  cancelFollowRequest: (userId: string) => Promise<{ success: boolean }>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ユーザーの認証状態を監視
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // ユーザーがログインしている場合、Firestoreからユーザーデータを取得
        const userData = await fetchUserData(firebaseUser.uid);
        setUser(userData);
      } else {
        // ユーザーがログアウトしている場合
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Firestoreからユーザーデータを取得
  const fetchUserData = async (userId: string): Promise<User | null> => {
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data() as any;
        
        // FirestoreのタイムスタンプをDateオブジェクトに変換
        const createdAt = userData.createdAt ? new Date(userData.createdAt.toDate()) : new Date();
        const lastActive = userData.lastActive ? new Date(userData.lastActive.toDate()) : new Date();
        
        return {
          ...userData,
          id: userId,
          createdAt,
          lastActive,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      return null;
    }
  };

  // サインイン
  const signIn = async (credentials: UserCredentials) => {
    try {
      setLoading(true);
      const { email, password } = credentials;
      
      try {
        const userCredential = await auth().signInWithEmailAndPassword(email, password);
        
        // 最終ログイン時間を更新
        await firestore()
          .collection('users')
          .doc(userCredential.user.uid)
          .update({ lastActive: firestore.FieldValue.serverTimestamp() });
        
        const userData = await fetchUserData(userCredential.user.uid);
        setUser(userData);
      } catch (authError: any) {
        console.error('Sign in error:', authError);
        
        // Firebase Consoleで認証が有効になっていない場合の一時的な対応
        if (authError.code === 'auth/operation-not-allowed') {
          console.warn('Firebase Authentication is not enabled. Using temporary mock user.');
          // 一時的なモックユーザーを設定
          const mockUser: User = {
            id: 'temp-user-id',
            nickname: 'テストユーザー',
            email: email,
            phoneNumber: '',
            gender: '',
            location: {
              latitude: 35.6812,
              longitude: 139.7671,
              privacyLevel: 'private',
            },
            profilePhoto: '',
            bio: 'テスト用アカウント',
            createdAt: new Date(),
            lastActive: new Date(),
            following: [],
            followers: [],
            circles: [],
            blockedUsers: [],
            accountPrivacy: 'public', // デフォルトはオープンアカウント
            pendingFollowers: [], // 初期値は空配列
          };
          setUser(mockUser);
        } else {
          throw authError;
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // サインアップ
  const signUp = async (userData: UserRegistration) => {
    try {
      setLoading(true);
      const { email, password, nickname, phoneNumber, gender } = userData;
      
      try {
        // Firebase Authでユーザー作成
        const userCredential = await auth().createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        
        // ユーザープロフィールのデフォルト値
        const newUserData: User = {
          id: uid,
          nickname,
          email,
          phoneNumber: phoneNumber || '',
          gender: gender || '',
          location: {
            latitude: 0,
            longitude: 0,
            privacyLevel: 'private',
          },
          profilePhoto: '',
          bio: '',
          createdAt: new Date(),
          lastActive: new Date(),
          following: [],
          followers: [],
          circles: [],
          blockedUsers: [],
          accountPrivacy: 'public', // デフォルトはオープンアカウント
          pendingFollowers: [], // 初期値は空配列
        };
        
        // Firestoreにユーザーデータを保存
        await firestore().collection('users').doc(uid).set({
          ...newUserData,
          createdAt: firestore.FieldValue.serverTimestamp(),
          lastActive: firestore.FieldValue.serverTimestamp(),
        });
        
        setUser(newUserData);
      } catch (authError: any) {
        console.error('Register error:', authError);
        
        // Firebase Consoleで認証が有効になっていない場合の一時的な対応
        if (authError.code === 'auth/operation-not-allowed') {
          console.warn('Firebase Authentication is not enabled. Using temporary mock user.');
          // 一時的なモックユーザーを設定
          const mockUser: User = {
            id: 'temp-user-id',
            nickname: nickname,
            email: email,
            phoneNumber: phoneNumber || '',
            gender: gender || '',
            location: {
              latitude: 35.6812,
              longitude: 139.7671,
              privacyLevel: 'private',
            },
            profilePhoto: '',
            bio: 'テスト用アカウント',
            createdAt: new Date(),
            lastActive: new Date(),
            following: [],
            followers: [],
            circles: [],
            blockedUsers: [],
            accountPrivacy: 'public', // デフォルトはオープンアカウント
            pendingFollowers: [], // 初期値は空配列
          };
          setUser(mockUser);
        } else {
          throw authError;
        }
      }
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // サインアウト
  const signOut = async () => {
    try {
      setLoading(true);
      await auth().signOut();
      setUser(null);
      await AsyncStorage.removeItem('@user');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // パスワードリセット
  const forgotPassword = async (email: string) => {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  // プロフィール更新
  const updateProfile = async (userData: Partial<User>) => {
    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      setLoading(true);
      
      // Firestoreでユーザーデータを更新
      await firestore().collection('users').doc(user.id).update({
        ...userData,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      // ローカルのユーザー状態を更新
      setUser(prev => prev ? { ...prev, ...userData } : null);
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ユーザーをフォロー
  const followUser = async (userId: string): Promise<{ success: boolean; isPending: boolean }> => {
    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      // 自分自身をフォローしようとしている場合
      if (user.id === userId) {
        throw new Error('Cannot follow yourself');
      }
      
      // ブロックしているユーザーはフォローできない
      if (user.blockedUsers && user.blockedUsers.includes(userId)) {
        throw new Error('Cannot follow a blocked user');
      }
      
      // 既にフォローしている場合
      if (user.following && user.following.includes(userId)) {
        throw new Error('Already following this user');
      }
      
      // 対象ユーザーの情報を取得
      const targetUserDoc = await firestore().collection('users').doc(userId).get();
      if (!targetUserDoc.exists) {
        throw new Error('User not found');
      }
      
      const targetUser = targetUserDoc.data() as User;
      
      // 非公開アカウントかどうかチェック
      if (targetUser.accountPrivacy === 'private') {
        // リクエストが既に送信されている場合
        if (targetUser.pendingFollowers && targetUser.pendingFollowers.includes(user.id)) {
          throw new Error('Follow request already sent');
        }
        
        // 先にローカル状態を更新（UI応答を高速化）
        const isPending = true;
        
        // フォローリクエストを送信
        await firestore().collection('users').doc(userId).update({
          pendingFollowers: firestore.FieldValue.arrayUnion(user.id)
        });
        
        // フォローリクエスト通知を送信（バックグラウンドで実行）
        createFollowRequestNotification(userId, user.id).catch(err => 
          console.error('Error sending follow request notification:', err)
        );
        
        return { success: true, isPending };
      } else {
        // 公開アカウントの場合は直接フォロー
        // 先にローカル状態を更新（UI応答を高速化）
        setUser(prev => {
          if (!prev) return null;
          const updatedFollowing = [...(prev.following || []), userId];
          
          return {
            ...prev,
            following: updatedFollowing
          };
        });
        
        // バッチ処理をバックグラウンドで実行
        const batch = firestore().batch();
        
        // 自分のフォロー中リストにユーザーを追加
        batch.update(firestore().collection('users').doc(user.id), {
          following: firestore.FieldValue.arrayUnion(userId)
        });
        
        // 相手のフォロワーリストに自分を追加
        batch.update(firestore().collection('users').doc(userId), {
          followers: firestore.FieldValue.arrayUnion(user.id)
        });
        
        // バッチ処理を実行
        await batch.commit();
        
        // フォロー通知を送信（バックグラウンドで実行）
        createFollowNotification(userId, user.id).catch(err => 
          console.error('Error sending follow notification:', err)
        );
        
        return { success: true, isPending: false };
      }
    } catch (error) {
      console.error('Follow user error:', error);
      throw error;
    }
  };

  // ユーザーのフォローを解除
  const unfollowUser = async (userId: string) => {
    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      if (!user.following.includes(userId)) {
        // フォローしていない場合は何もしない
        return;
      }
      
      // 先にローカル状態を更新（UI応答を高速化）
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          following: prev.following.filter(id => id !== userId),
        };
      });
      
      // バッチ処理をバックグラウンドで実行
      const batch = firestore().batch();
      
      // 自分のフォロー中リストから削除
      const currentUserRef = firestore().collection('users').doc(user.id);
      batch.update(currentUserRef, {
        following: firestore.FieldValue.arrayRemove(userId),
      });
      
      // 相手のフォロワーリストから削除
      const targetUserRef = firestore().collection('users').doc(userId);
      batch.update(targetUserRef, {
        followers: firestore.FieldValue.arrayRemove(user.id),
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Unfollow user error:', error);
      // エラー時に状態を戻す
      const userId = user?.id;
      if (userId) {
        fetchUserData(userId).then(updatedUser => {
          if (updatedUser) {
            setUser(updatedUser);
          }
        }).catch(err => console.error('Error refreshing user data:', err));
      }
      throw error;
    }
  };

  // ユーザーをブロック
  const blockUser = async (userId: string) => {
    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      if (user.blockedUsers.includes(userId)) {
        // すでにブロック済みの場合は何もしない
        return;
      }
      
      const batch = firestore().batch();
      
      // ブロックリストに追加
      const userRef = firestore().collection('users').doc(user.id);
      batch.update(userRef, {
        blockedUsers: firestore.FieldValue.arrayUnion(userId),
      });
      
      // もし相手をフォローしていれば、フォローを解除
      if (user.following.includes(userId)) {
        batch.update(userRef, {
          following: firestore.FieldValue.arrayRemove(userId),
        });
        
        const targetUserRef = firestore().collection('users').doc(userId);
        batch.update(targetUserRef, {
          followers: firestore.FieldValue.arrayRemove(user.id),
        });
      }
      
      await batch.commit();
      
      // ローカルのユーザー状態を更新
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          blockedUsers: [...prev.blockedUsers, userId],
          following: prev.following.filter(id => id !== userId),
        };
      });
    } catch (error) {
      console.error('Block user error:', error);
      throw error;
    }
  };

  // ユーザーのブロックを解除
  const unblockUser = async (userId: string) => {
    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      if (!user.blockedUsers.includes(userId)) {
        // ブロックしていない場合は何もしない
        return;
      }
      
      // ブロックリストから削除
      await firestore()
        .collection('users')
        .doc(user.id)
        .update({
          blockedUsers: firestore.FieldValue.arrayRemove(userId),
        });
      
      // ローカルのユーザー状態を更新
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          blockedUsers: prev.blockedUsers.filter(id => id !== userId),
        };
      });
    } catch (error) {
      console.error('Unblock user error:', error);
      throw error;
    }
  };

  // フォローリクエストを承認
  const acceptFollowRequest = async (userId: string) => {
    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      // 最新のユーザー情報を取得
      const currentUserDoc = await firestore().collection('users').doc(user.id).get();
      if (!currentUserDoc.exists) {
        throw new Error('User not found');
      }
      
      const currentUserData = currentUserDoc.data() as User;
      
      // リクエスト中のフォロワーリストにユーザーが存在するか確認
      if (!currentUserData.pendingFollowers || !currentUserData.pendingFollowers.includes(userId)) {
        throw new Error('No pending follow request from this user');
      }
      
      // バッチ処理ではなく個別に更新
      // 1. まず自分のpendingFollowersからユーザーを削除
      await firestore().collection('users').doc(user.id).update({
        pendingFollowers: firestore.FieldValue.arrayRemove(userId)
      });
      
      // 2. 次に自分のフォロワーリストにユーザーを追加
      await firestore().collection('users').doc(user.id).update({
        followers: firestore.FieldValue.arrayUnion(userId)
      });
      
      // 3. リクエスト送信者のフォロー中リストに自分を追加
      await firestore().collection('users').doc(userId).update({
        following: firestore.FieldValue.arrayUnion(user.id)
      });
      
      // 承認後に最新のユーザー情報を取得
      const updatedUserDoc = await firestore().collection('users').doc(user.id).get();
      const updatedUser = updatedUserDoc.data() as User;
      
      // ローカルのユーザー状態を更新
      setUser(prev => {
        if (!prev) return null;
        
        // ユーザーのフォロワーリストを更新
        const updatedFollowers = updatedUser.followers || [];
        
        // pendingFollowersリストを更新
        const updatedPendingFollowers = updatedUser.pendingFollowers || [];
        
        return {
          ...prev,
          followers: updatedFollowers,
          pendingFollowers: updatedPendingFollowers
        };
      });
    } catch (error) {
      console.error('Accept follow request error:', error);
      throw error;
    }
  };
  
  // フォローリクエストを拒否
  const rejectFollowRequest = async (userId: string) => {
    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      // 最新のユーザー情報を取得
      const currentUserDoc = await firestore().collection('users').doc(user.id).get();
      if (!currentUserDoc.exists) {
        throw new Error('User not found');
      }
      
      const currentUserData = currentUserDoc.data() as User;
      
      // リクエスト中のフォロワーリストにユーザーが存在するか確認
      if (!currentUserData.pendingFollowers || !currentUserData.pendingFollowers.includes(userId)) {
        throw new Error('No pending follow request from this user');
      }
      
      // 承認待ちリストからユーザーを削除
      await firestore().collection('users').doc(user.id).update({
        pendingFollowers: firestore.FieldValue.arrayRemove(userId)
      });
      
      // ローカルのユーザー状態を更新
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          pendingFollowers: prev.pendingFollowers?.filter(id => id !== userId) || []
        };
      });
    } catch (error) {
      console.error('Reject follow request error:', error);
      throw error;
    }
  };

  // フォローリクエストをキャンセル
  const cancelFollowRequest = async (userId: string): Promise<{ success: boolean }> => {
    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      // ターゲットユーザーの情報を取得
      const targetUserDoc = await firestore().collection('users').doc(userId).get();
      if (!targetUserDoc.exists) {
        throw new Error('User not found');
      }
      
      const targetUser = targetUserDoc.data() as User;
      
      // リクエストが送信されていることを確認
      if (!targetUser.pendingFollowers || !targetUser.pendingFollowers.includes(user.id)) {
        throw new Error('No pending follow request found');
      }
      
      // フォローリクエストをキャンセル（pendingFollowersからユーザーIDを削除）
      await firestore().collection('users').doc(userId).update({
        pendingFollowers: firestore.FieldValue.arrayRemove(user.id)
      });
      
      return { success: true };
    } catch (error) {
      console.error('Cancel follow request error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        forgotPassword,
        updateProfile,
        followUser,
        unfollowUser,
        blockUser,
        unblockUser,
        acceptFollowRequest,
        rejectFollowRequest,
        cancelFollowRequest
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}; 