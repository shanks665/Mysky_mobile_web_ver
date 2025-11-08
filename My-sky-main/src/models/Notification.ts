export type NotificationType = 
  | 'circle_join_request'  // サークル参加リクエスト
  | 'circle_request_approved' // サークル参加承認
  | 'circle_request_rejected' // サークル参加拒否
  | 'event_join_request'   // イベント参加リクエスト
  | 'event_request_approved' // イベント参加承認
  | 'event_request_rejected' // イベント参加拒否
  | 'nearby_event'         // 近くで開催されるイベント
  | 'upcoming_event'       // 参加予定のイベントが近づいている
  | 'follow_request';      // フォローリクエスト

export interface Notification {
  id: string;
  userId: string;         // 通知先ユーザーID
  type: NotificationType; // 通知タイプ
  title: string;          // 通知タイトル
  body: string;           // 通知内容
  read: boolean;          // 既読フラグ
  createdAt: Date;        // 作成日時
  data?: {                // 追加データ
    circleId?: string;    // サークルID（関連するサークルがある場合）
    eventId?: string;     // イベントID（関連するイベントがある場合）
    userId?: string;      // ユーザーID（関連するユーザーがある場合）
    distance?: number;    // 距離（km）
    eventStartDate?: Date; // イベント開催日（upcoming_eventの場合）
  };
}

export interface CircleJoinRequestNotification extends Notification {
  type: 'circle_join_request';
  data: {
    circleId: string;
    userId: string;
  };
}

export interface CircleRequestApprovedNotification extends Notification {
  type: 'circle_request_approved';
  data: {
    circleId: string;
  };
}

export interface CircleRequestRejectedNotification extends Notification {
  type: 'circle_request_rejected';
  data: {
    circleId: string;
  };
}

export interface EventJoinRequestNotification extends Notification {
  type: 'event_join_request';
  data: {
    eventId: string;
    userId: string;
  };
}

export interface EventRequestApprovedNotification extends Notification {
  type: 'event_request_approved';
  data: {
    eventId: string;
  };
}

export interface EventRequestRejectedNotification extends Notification {
  type: 'event_request_rejected';
  data: {
    eventId: string;
  };
}

export interface NearbyEventNotification extends Notification {
  type: 'nearby_event';
  data: {
    eventId: string;
    distance: number; // km
  };
}

export interface UpcomingEventNotification extends Notification {
  type: 'upcoming_event';
  data: {
    eventId: string;
    eventStartDate: Date;
  };
}

export interface FollowRequestNotification extends Notification {
  type: 'follow_request';
  data: {
    userId: string;
  };
}

// 通知作成用インターフェース（ID, 既読フラグ, 作成日時は自動生成）
export interface NotificationCreation {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    circleId?: string;
    eventId?: string;
    userId?: string;
    distance?: number;
    eventStartDate?: Date;
  };
} 