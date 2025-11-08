import { Timestamp } from '@react-native-firebase/firestore';

export interface Post {
  id: string;
  userId: string;
  text: string;
  image?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  likes: string[]; // ユーザーIDの配列
  comments: number; // コメント数
  quotedPostId?: string; // 引用投稿のID
  replyToPostId?: string; // 返信先の投稿ID
  mentions?: string[]; // 言及されたユーザーIDの配列
  tags?: string[]; // ハッシュタグの配列
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
}

export interface PostCreation {
  text: string;
  image?: string;
  quotedPostId?: string;
  replyToPostId?: string;
  mentions?: string[];
  tags?: string[];
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: Timestamp;
  likes: string[]; // ユーザーIDの配列
}

export interface CommentCreation {
  postId: string;
  text: string;
}

export interface PostWithUser extends Post {
  user: {
    id: string;
    nickname: string;
    profilePhoto: string;
  };
  isLiked: boolean;
  blockedUsers?: string[]; // ユーザーがブロックしているユーザーIDのリスト
} 