import { NavigatorScreenParams } from '@react-navigation/native';

// 認証スタックのパラメータ
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// メインタブのパラメータ
export type MainTabParamList = {
  HomeTab: undefined;
  DiscoverTab: undefined;
  EventsTab: undefined;
  MessagesTab: undefined;
  NotificationsTab: undefined;
  ProfileTab: undefined;
};

// ホームスタックのパラメータ
export type HomeStackParamList = {
  Feed: undefined;
  PostDetails: { postId: string };
  UserProfile: { userId: string };
  CommentsList: { postId: string };
  LikesList: { postId: string };
  ChatRoom: { 
    roomId: string;
    otherUserId: string;
    otherUserName: string;
  };
  Settings: undefined;
};

// 探索スタックのパラメータ
export type DiscoverStackParamList = {
  Discover: { refresh?: boolean; newCircleId?: string };
  CircleDetails: { circleId: string };
  CircleMembers: { circleId: string; initialTab?: 'members' | 'pending' };
  EventDetails: { eventId: string };
  UserProfile: { userId: string };
  SearchUsers: { exclude?: string[] };
  CreateCircle: undefined;
  EditCircle: { circleId: string };
  CreateEvent: { circleId: string };
  EventMembers: { eventId: string };
  Participants: { circleId: string };
  Search: { filter: 'users' | 'circles' | 'events' };
  CircleBoard: { circleId: string; circleName: string };
  EventBoard: { eventId: string; eventName: string };
  ChatRoom: { 
    roomId: string;
    otherUserId: string;
    otherUserName: string;
  };
  EventAttendees: { eventId: string; mode?: 'view' | 'transfer'; title?: string; initialTab?: 'attendees' | 'pending' };
  EditEvent: { eventId: string };
};

// メッセージスタックのパラメータ
export type MessagesStackParamList = {
  Messages: undefined;
  ChatRoom: { 
    roomId: string;
    otherUserId: string;
    otherUserName: string;
  };
  UserProfile: { userId: string };
};

// イベントスタックのパラメータ
export type EventsStackParamList = {
  Events: undefined;
  EventDetails: { eventId: string };
  CreateEvent: { circleId: string };
  EditEvent: { eventId: string };
  CircleDetails: { circleId: string };
  UserProfile: { userId: string };
  EventAttendees: { eventId: string; mode?: 'view' | 'transfer'; title?: string; initialTab?: 'attendees' | 'pending' };
};

// プロフィールスタックのパラメータ
export type ProfileStackParamList = {
  Profile: undefined;
  UserProfile: { userId: string };
  EditProfile: undefined;
  Settings: undefined;
  Following: { userId: string };
  Followers: { userId: string };
  MyCircles: { userId?: string };
  Notification: undefined;
  CircleDetails: { circleId: string };
  CreateCircle: undefined;
  CreateEvent: { circleId: string };
  ChatRoom: { roomId: string, otherUserId: string, otherUserName: string };
  CommentsList: { postId: string };
  LikesList: { postId: string };
  EditEvent: { eventId: string };
  EventDetails: { eventId: string };
};

// 通知スタックのパラメータ
export type NotificationStackParamList = {
  Notifications: undefined;
  NotificationSettings: undefined;
  EventDetails: { eventId: string };
  CircleDetails: { circleId: string };
  EventAttendees: { eventId: string; mode?: 'view' | 'transfer'; title?: string; initialTab?: 'attendees' | 'pending' };
  UserProfile: { userId: string };
  CircleRequests: { circleId: string };
};

// 全体のルートパラメータ
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Loading: undefined;
  UserProfile: { userId: string };
  CircleDetails: { circleId: string };
  EventDetails: { eventId: string };
  ChatRoom: { 
    roomId: string;
    otherUserId: string;
    otherUserName: string;
  };
  CirclePosts: { circleId: string };
  CreateCirclePost: { circleId: string };
  EditCirclePost: { circleId: string; postId: string };
  CirclePostDetail: { circleId: string; postId: string };
  CircleRequests: { circleId: string };
  Members: { circleId: string };
  CreateCircle: undefined;
  EditCircle: { circleId: string };
  EventAttendees: { eventId: string; initialTab?: 'attendees' | 'pending' };
  CreateEvent: { circleId: string };
  EditEvent: { eventId: string };
  Notifications: undefined;
};