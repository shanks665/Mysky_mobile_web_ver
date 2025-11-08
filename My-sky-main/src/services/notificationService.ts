import firestore from '@react-native-firebase/firestore';
import { Notification, NotificationCreation, NotificationType } from '../models/Notification';
import { User } from '../models/User';
import { calculateDistance } from '../utils/distanceCalculator';
import { Circle } from '../models/Circle';
import { CircleEvent } from '../models/Circle';

// 通知を作成する
export const createNotification = async (notification: NotificationCreation): Promise<string> => {
  try {
    const notificationData = {
      ...notification,
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };
    
    const docRef = await firestore()
      .collection('notifications')
      .doc(notification.userId)
      .collection('items')
      .add(notificationData);
      
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// ユーザーの通知を取得する
export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const snapshot = await firestore()
      .collection('notifications')
      .doc(userId)
      .collection('items')
      .orderBy('createdAt', 'desc')
      .get();
      
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as Notification));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

// 通知を既読にする
export const markNotificationAsRead = async (userId: string, notificationId: string): Promise<void> => {
  try {
    await firestore()
      .collection('notifications')
      .doc(userId)
      .collection('items')
      .doc(notificationId)
      .update({ read: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// 全ての通知を既読にする
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const snapshot = await firestore()
      .collection('notifications')
      .doc(userId)
      .collection('items')
      .where('read', '==', false)
      .get();
      
    const batch = firestore().batch();
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// 通知を削除する
export const deleteNotification = async (userId: string, notificationId: string): Promise<void> => {
  try {
    await firestore()
      .collection('notifications')
      .doc(userId)
      .collection('items')
      .doc(notificationId)
      .delete();
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// サークル参加リクエスト通知を作成する
export const createCircleJoinRequestNotification = async (
  circleId: string, 
  requestUserId: string
): Promise<void> => {
  try {
    // サークル情報を取得
    const circleDoc = await firestore().collection('circles').doc(circleId).get();
    const circle = circleDoc.data() as Circle;
    
    // リクエストユーザー情報を取得
    const userDoc = await firestore().collection('users').doc(requestUserId).get();
    const user = userDoc.data() as User;
    
    // サークルの管理者全員に通知を送信
    const admins = circle.admins || [];
    
    for (const adminId of admins) {
      await createNotification({
        userId: adminId,
        type: 'circle_join_request',
        title: 'サークル参加リクエスト',
        body: `${user.nickname}さんが「${circle.name}」への参加をリクエストしました`,
        data: {
          circleId,
          userId: requestUserId,
        },
      });
    }
  } catch (error) {
    console.error('Error creating circle join request notification:', error);
    throw error;
  }
};

// サークル参加リクエスト承認通知を作成する
export const createCircleRequestApprovedNotification = async (
  circleId: string, 
  userId: string
): Promise<void> => {
  try {
    // サークル情報を取得
    const circleDoc = await firestore().collection('circles').doc(circleId).get();
    const circle = circleDoc.data() as Circle;
    
    await createNotification({
      userId,
      type: 'circle_request_approved',
      title: 'サークル参加リクエスト承認',
      body: `「${circle.name}」への参加リクエストが承認されました`,
      data: {
        circleId,
      },
    });
  } catch (error) {
    console.error('Error creating circle request approved notification:', error);
    throw error;
  }
};

// サークル参加リクエスト拒否通知を作成する
export const createCircleRequestRejectedNotification = async (
  circleId: string, 
  userId: string
): Promise<void> => {
  try {
    // サークル情報を取得
    const circleDoc = await firestore().collection('circles').doc(circleId).get();
    const circle = circleDoc.data() as Circle;
    
    await createNotification({
      userId,
      type: 'circle_request_rejected',
      title: 'サークル参加リクエスト拒否',
      body: `「${circle.name}」への参加リクエストが拒否されました`,
      data: {
        circleId,
      },
    });
  } catch (error) {
    console.error('Error creating circle request rejected notification:', error);
    throw error;
  }
};

// イベント参加リクエスト通知を作成する
export const createEventJoinRequestNotification = async (
  eventId: string, 
  requestUserId: string
): Promise<void> => {
  try {
    // イベント情報を取得
    const eventDoc = await firestore().collection('events').doc(eventId).get();
    const event = eventDoc.data() as CircleEvent;
    
    // リクエストユーザー情報を取得
    const userDoc = await firestore().collection('users').doc(requestUserId).get();
    const user = userDoc.data() as User;
    
    // イベント作成者に通知を送信
    await createNotification({
      userId: event.createdBy,
      type: 'event_join_request',
      title: 'イベント参加リクエスト',
      body: `${user.nickname}さんが「${event.title}」への参加をリクエストしました`,
      data: {
        eventId,
        userId: requestUserId,
      },
    });
    
    // イベントに管理者がいる場合は、管理者にも通知を送信
    if (event.admins && event.admins.length > 0) {
      for (const adminId of event.admins) {
        if (adminId !== event.createdBy) { // 作成者は既に通知を受け取っているので除外
          await createNotification({
            userId: adminId,
            type: 'event_join_request',
            title: 'イベント参加リクエスト',
            body: `${user.nickname}さんが「${event.title}」への参加をリクエストしました`,
            data: {
              eventId,
              userId: requestUserId,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error creating event join request notification:', error);
    throw error;
  }
};

// イベント参加リクエスト承認通知を作成する
export const createEventRequestApprovedNotification = async (
  eventId: string, 
  userId: string
): Promise<void> => {
  try {
    // イベント情報を取得
    const eventDoc = await firestore().collection('events').doc(eventId).get();
    const event = eventDoc.data() as CircleEvent;
    
    await createNotification({
      userId,
      type: 'event_request_approved',
      title: 'イベント参加リクエスト承認',
      body: `「${event.title}」への参加リクエストが承認されました`,
      data: {
        eventId,
      },
    });
  } catch (error) {
    console.error('Error creating event request approved notification:', error);
    throw error;
  }
};

// イベント参加リクエスト拒否通知を作成する
export const createEventRequestRejectedNotification = async (
  eventId: string, 
  userId: string
): Promise<void> => {
  try {
    // イベント情報を取得
    const eventDoc = await firestore().collection('events').doc(eventId).get();
    const event = eventDoc.data() as CircleEvent;
    
    await createNotification({
      userId,
      type: 'event_request_rejected',
      title: 'イベント参加リクエスト拒否',
      body: `「${event.title}」への参加リクエストが拒否されました`,
      data: {
        eventId,
      },
    });
  } catch (error) {
    console.error('Error creating event request rejected notification:', error);
    throw error;
  }
};

// ユーザーの近くで開催されるイベントの通知を作成する
export const createNearbyEventNotifications = async (userId: string): Promise<void> => {
  try {
    // ユーザーの位置情報を取得
    const userDoc = await firestore().collection('users').doc(userId).get();
    const user = userDoc.data() as User;
    
    if (!user.location || !user.location.latitude || !user.location.longitude) {
      return; // 位置情報がない場合は通知を作成しない
    }
    
    const userCoords = {
      latitude: user.location.latitude,
      longitude: user.location.longitude,
    };
    
    // 今日以降のイベントを取得
    const now = new Date();
    const snapshot = await firestore()
      .collection('events')
      .where('startDate', '>=', now)
      .get();
      
    const events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startDate: doc.data().startDate?.toDate() || new Date(),
    } as CircleEvent));
    
    // 既存の通知をチェックするため、ユーザーの未読通知を取得
    const existingNotificationsSnapshot = await firestore()
      .collection('notifications')
      .doc(userId)
      .collection('items')
      .where('type', '==', 'nearby_event')
      .where('read', '==', false)
      .get();
      
    // 既に通知済みのイベントIDを Set に格納
    const notifiedEventIds = new Set<string>();
    existingNotificationsSnapshot.docs.forEach(doc => {
      const notification = doc.data();
      if (notification.data && notification.data.eventId) {
        notifiedEventIds.add(notification.data.eventId);
      }
    });
    
    console.log(`[Notification] 既存の nearby_event 通知数: ${notifiedEventIds.size}`);
    
    // ユーザーがまだ参加していない、15km以内で開催されるイベントを探す
    const nearbyEvents = events.filter(event => {
      // ユーザーが既に参加しているイベントは除外
      if (event.attendees && event.attendees.includes(userId)) {
        return false;
      }
      
      // 位置情報がないイベントは除外
      if (!event.location || !event.location.latitude || !event.location.longitude) {
        return false;
      }
      
      // イベントの位置情報
      const eventCoords = {
        latitude: event.location.latitude,
        longitude: event.location.longitude,
      };
      
      // 距離を計算
      const distanceInKm = parseFloat(calculateDistance(userCoords, eventCoords)) / 1000;
      
      // 15km以内のイベントのみフィルタリング
      return distanceInKm <= 15;
    });
    
    console.log(`[Notification] 近くのイベント候補数: ${nearbyEvents.length}`);
    
    // 近くのイベント通知を作成（既に通知済みのものを除く）
    for (const event of nearbyEvents) {
      // 既に通知済みの場合はスキップ
      if (notifiedEventIds.has(event.id)) {
        console.log(`[Notification] イベント ${event.id} は既に通知済みのためスキップ`);
        continue;
      }
      
      // イベントの位置情報
      const eventCoords = {
        latitude: event.location!.latitude,
        longitude: event.location!.longitude,
      };
      
      // 距離を計算
      const distanceInKm = parseFloat(calculateDistance(userCoords, eventCoords)) / 1000;
      
      await createNotification({
        userId,
        type: 'nearby_event',
        title: '近くで開催されるイベント',
        body: `${distanceInKm.toFixed(1)}km先で「${event.title}」が開催されます`,
        data: {
          eventId: event.id,
          distance: distanceInKm,
        },
      });
      
      console.log(`[Notification] イベント ${event.id} の近くのイベント通知を作成しました`);
    }
  } catch (error) {
    console.error('Error creating nearby event notifications:', error);
    throw error;
  }
};

// 参加予定のイベントの開催が近いことを通知する
export const createUpcomingEventNotifications = async (userId: string): Promise<void> => {
  try {
    // 今日の日付
    const now = new Date();
    
    // 7日後の日付（検索範囲用）
    const oneWeekLater = new Date();
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    
    // ユーザーが参加するイベントを取得
    const snapshot = await firestore()
      .collection('events')
      .where('attendees', 'array-contains', userId)
      .where('startDate', '>=', now)
      .where('startDate', '<=', oneWeekLater)
      .get();
      
    const events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startDate: doc.data().startDate?.toDate() || new Date(),
    } as CircleEvent));
    
    // 既存の通知をチェックするため、ユーザーの全ての通知を取得（既読/未読に関わらず）
    const existingNotificationsSnapshot = await firestore()
      .collection('notifications')
      .doc(userId)
      .collection('items')
      .where('type', '==', 'upcoming_event')
      .get();
      
    // 既に通知済みのイベントIDと通知日数のマッピングを作成
    const notifiedEventMap = new Map<string, number[]>();
    existingNotificationsSnapshot.docs.forEach(doc => {
      const notification = doc.data();
      if (notification.data && notification.data.eventId) {
        const eventId = notification.data.eventId;
        const message = notification.body || '';
        
        // 日数を抽出 (例: 「イベント名は3日後に開催されます」から「3」を抽出)
        let daysBefore = 0;
        if (message.includes('3日後')) {
          daysBefore = 3;
        } else if (message.includes('明日')) {
          daysBefore = 1;
        }
        
        if (!notifiedEventMap.has(eventId)) {
          notifiedEventMap.set(eventId, []);
        }
        
        if (daysBefore > 0) {
          notifiedEventMap.get(eventId)!.push(daysBefore);
        }
      }
    });
    
    console.log(`[Notification] 既存の upcoming_event 通知数（既読/未読含む）: ${existingNotificationsSnapshot.size}`);
    
    // 特定の日前（3日前と1日前）のイベントのみ通知を作成
    for (const event of events) {
      // イベント開催までの日数を計算
      const daysUntilEvent = Math.ceil((event.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // 3日前と1日前（翌日）のイベントだけ通知する
      if (daysUntilEvent === 3 || daysUntilEvent === 1) {
        // 既に同じ日数で通知済みかチェック
        const existingDays = notifiedEventMap.get(event.id) || [];
        if (existingDays.includes(daysUntilEvent)) {
          console.log(`[Notification] イベント ${event.id} は既に ${daysUntilEvent}日前の通知が作成済みのためスキップ`);
          continue;
        }
        
        let message = '';
        if (daysUntilEvent === 1) {
          message = `「${event.title}」は明日開催されます`;
        } else if (daysUntilEvent === 3) {
          message = `「${event.title}」は3日後に開催されます`;
        }
        
        await createNotification({
          userId,
          type: 'upcoming_event',
          title: 'イベント開催間近',
          body: message,
          data: {
            eventId: event.id,
            eventStartDate: event.startDate,
          },
        });
        
        console.log(`[Notification] イベント ${event.id} の ${daysUntilEvent}日前通知を作成しました`);
      }
    }
  } catch (error) {
    console.error('Error creating upcoming event notifications:', error);
    throw error;
  }
};

// フォローリクエスト通知を作成する
export const createFollowRequestNotification = async (
  targetUserId: string,
  requestUserId: string
): Promise<void> => {
  try {
    // リクエストユーザー情報を取得
    const userDoc = await firestore().collection('users').doc(requestUserId).get();
    const user = userDoc.data() as User;
    
    await createNotification({
      userId: targetUserId,
      type: 'follow_request',
      title: 'フォローリクエスト',
      body: `${user.nickname}さんがあなたをフォローしたいと思っています`,
      data: {
        userId: requestUserId,
      },
    });
  } catch (error) {
    console.error('Error creating follow request notification:', error);
    throw error;
  }
};

// フォロー通知を作成する
export const createFollowNotification = async (
  targetUserId: string,
  followerId: string
): Promise<void> => {
  try {
    // フォローしたユーザー情報を取得
    const userDoc = await firestore().collection('users').doc(followerId).get();
    const user = userDoc.data() as User;
    
    await createNotification({
      userId: targetUserId,
      type: 'follow_request', // 既存の通知タイプを使用
      title: 'フォロー通知',
      body: `${user.nickname}さんがあなたをフォローしました`,
      data: {
        userId: followerId,
      },
    });
  } catch (error) {
    console.error('Error creating follow notification:', error);
    throw error;
  }
}; 