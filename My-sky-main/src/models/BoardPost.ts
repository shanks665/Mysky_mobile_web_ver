import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface BoardPost {
  id: string;
  circleId?: string;  // サークル掲示板の場合に設定
  eventId?: string;   // イベント掲示板の場合に設定
  userId: string;     // 投稿者ID
  parentId?: string | null;
  replyToId?: string | null; // 返信の返信の場合は、直接の返信先ID
  text: string;       // 投稿テキスト
  imageUrl?: string;  // 添付画像URL
  createdAt: FirebaseFirestoreTypes.Timestamp | Date | any;
  updatedAt?: FirebaseFirestoreTypes.Timestamp | Date | any;
  likes: string[];    // いいねしたユーザーIDのリスト
  replyCount: number; // 返信数
}

export interface PostCreationData {
  text: string;
  circleId?: string;
  eventId?: string;
  parentId?: string;
  replyToId?: string; // 返信の返信の場合は、直接の返信先ID
  imageUrl?: string;
}

export interface BoardPostUser {
  id: string;
  nickname: string;
  profilePhoto: string;
}

export interface BoardPostWithUser extends BoardPost {
  user: BoardPostUser;
  isLiked: boolean; // 現在のユーザーがいいねしているか
  replies?: BoardPostWithUser[];
  // 返信表示用の追加プロパティ
  nestedLevel?: number; // 返信のネストレベル（0: 通常返信、1: 返信の返信）
  replyToUser?: string; // 返信先ユーザー名
  _hasReplies?: boolean; // UI表示用の返信存在フラグ（replyCountと別に管理）
} 