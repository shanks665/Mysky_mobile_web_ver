export interface User {
  id: string;
  nickname: string;
  email: string;
  phoneNumber?: string;
  gender?: string;
  prefecture?: string;
  city?: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    privacyLevel: 'public' | 'followers' | 'private';
  };
  profilePhoto: string;
  coverPhoto?: string;
  bio?: string;
  createdAt: Date;
  lastActive: Date;
  following: string[]; // ユーザーID配列
  followers: string[]; // ユーザーID配列
  circles: string[]; // サークルID配列
  blockedUsers: string[]; // ブロックしたユーザーID配列
  accountPrivacy: 'public' | 'private'; // アカウントの公開設定（public: オープン、private: 鍵付き）
  pendingFollowers?: string[]; // フォローリクエスト中のユーザーID配列（鍵付きアカウント用）
}

export interface UserCredentials {
  email: string;
  password: string;
}

export interface UserRegistration extends UserCredentials {
  nickname: string;
  phoneNumber?: string;
  gender?: string;
  prefecture?: string;
}

export interface UserDistance {
  userId: string;
  distance: string; // 表示用の距離文字列 ("1.2km", "500m" など)
  numericDistance: number; // ソート用の数値 (メートル単位)
}