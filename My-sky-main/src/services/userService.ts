import firestore from '@react-native-firebase/firestore';
import { User, UserDistance } from '../models/User';
import { Coordinates, calculateDistance, calculateNumericDistance } from '../utils/distanceCalculator';

// 特定のユーザーを取得
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }
    
    const userData = userDoc.data() as any;
    
    return {
      ...userData,
      id: userId,
      createdAt: userData.createdAt?.toDate() || new Date(),
      lastActive: userData.lastActive?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Get user error:', error);
    throw error;
  }
};

// 指定した半径内のユーザーを取得
export const fetchUsersInRadius = async (
  center: Coordinates,
  radiusInMeters: number = 5000, // デフォルト5km
  limit: number = 50, // 最大取得件数
  excludeUserIds: string[] = []
): Promise<UserDistance[]> => {
  try {
    // Firestoreには効率的な地理的クエリがないため、
    // まずはユーザーを取得して距離でフィルタリングする
    const usersSnapshot = await firestore()
      .collection('users')
      .limit(100) // 最初に取得する件数を制限
      .get();
    
    const users: UserDistance[] = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data() as User;
      
      // 除外リストに含まれるユーザーは無視
      if (excludeUserIds.includes(doc.id)) {
        return;
      }
      
      // 位置情報がないユーザーは無視
      if (!userData.location || !userData.location.latitude || !userData.location.longitude) {
        return;
      }
      
      const userCoords: Coordinates = {
        latitude: userData.location.latitude,
        longitude: userData.location.longitude,
      };
      
      // 距離を計算
      const distanceInMeters = calculateNumericDistance(center, userCoords);
      
      // 指定した半径内のユーザーのみを追加
      if (distanceInMeters <= radiusInMeters) {
        users.push({
          userId: doc.id,
          distance: calculateDistance(center, userCoords),
          numericDistance: distanceInMeters,
        });
      }
    });
    
    // 距離順にソート
    users.sort((a, b) => a.numericDistance - b.numericDistance);
    
    // 取得上限数に制限
    return users.slice(0, limit);
  } catch (error) {
    console.error('Fetch users in radius error:', error);
    throw error;
  }
};

// ユーザー検索
export const searchUsers = async (
  query: string,
  limit: number = 20
): Promise<User[]> => {
  try {
    // Firestoreには部分一致検索がないため、
    // クライアント側でフィルタリングする
    const usersSnapshot = await firestore()
      .collection('users')
      .limit(100) // 最初に取得する件数を制限
      .get();
    
    const users: User[] = [];
    const lowerQuery = query.toLowerCase();
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data() as any;
      
      // 検索クエリに一致するユーザーを抽出
      if (
        userData.nickname?.toLowerCase().includes(lowerQuery) ||
        userData.bio?.toLowerCase().includes(lowerQuery)
      ) {
        users.push({
          ...userData,
          id: doc.id,
          createdAt: userData.createdAt?.toDate() || new Date(),
          lastActive: userData.lastActive?.toDate() || new Date(),
        });
      }
    });
    
    // 検索結果を制限
    return users.slice(0, limit);
  } catch (error) {
    console.error('Search users error:', error);
    throw error;
  }
};

// ユーザーがフォローしているユーザーを取得
export const fetchFollowingUsers = async (userId: string): Promise<User[]> => {
  try {
    // まずユーザーデータを取得
    const userDoc = await firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return [];
    }
    
    const userData = userDoc.data() as User;
    const followingIds = userData.following || [];
    
    if (followingIds.length === 0) {
      return [];
    }
    
    // フォローしているユーザーのデータを取得
    const users: User[] = [];
    
    // Firestoreではinクエリの上限があるため、バッチ処理が必要
    const batchSize = 10;
    
    for (let i = 0; i < followingIds.length; i += batchSize) {
      const batch = followingIds.slice(i, i + batchSize);
      
      const batchSnapshot = await firestore()
        .collection('users')
        .where(firestore.FieldPath.documentId(), 'in', batch)
        .get();
      
      batchSnapshot.forEach(doc => {
        const followingUserData = doc.data() as any;
        users.push({
          ...followingUserData,
          id: doc.id,
          createdAt: followingUserData.createdAt?.toDate() || new Date(),
          lastActive: followingUserData.lastActive?.toDate() || new Date(),
        });
      });
    }
    
    return users;
  } catch (error) {
    console.error('Fetch following users error:', error);
    throw error;
  }
};

// ユーザーのフォロワーを取得
export const fetchFollowers = async (userId: string): Promise<User[]> => {
  try {
    // まずユーザーデータを取得
    const userDoc = await firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return [];
    }
    
    const userData = userDoc.data() as User;
    const followerIds = userData.followers || [];
    
    if (followerIds.length === 0) {
      return [];
    }
    
    // フォロワーのデータを取得
    const users: User[] = [];
    
    // Firestoreではinクエリの上限があるため、バッチ処理が必要
    const batchSize = 10;
    
    for (let i = 0; i < followerIds.length; i += batchSize) {
      const batch = followerIds.slice(i, i + batchSize);
      
      const batchSnapshot = await firestore()
        .collection('users')
        .where(firestore.FieldPath.documentId(), 'in', batch)
        .get();
      
      batchSnapshot.forEach(doc => {
        const followerData = doc.data() as any;
        users.push({
          ...followerData,
          id: doc.id,
          createdAt: followerData.createdAt?.toDate() || new Date(),
          lastActive: followerData.lastActive?.toDate() || new Date(),
        });
      });
    }
    
    return users;
  } catch (error) {
    console.error('Fetch followers error:', error);
    throw error;
  }
}; 