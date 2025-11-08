import { AppState, AppStateStatus } from 'react-native';
import { createNearbyEventNotifications, createUpcomingEventNotifications } from './notificationService';
import auth from '@react-native-firebase/auth';

/**
 * 通知設定を初期化する
 * アプリを開いた時に通知をチェックする簡易版
 */
export const initBackgroundNotifications = async (): Promise<void> => {
  console.log('[NotificationService] Initializing app state listener for notifications');
  
  // アプリの状態変化監視を設定
  AppState.addEventListener('change', handleAppStateChange);
  
  // 初期化時にも一度通知をチェック
  const currentUser = auth().currentUser;
  if (currentUser) {
    try {
      await checkNotifications(currentUser.uid);
    } catch (error) {
      console.error('[NotificationService] Error checking notifications at init:', error);
    }
  }
};

/**
 * アプリの状態変化ハンドラ
 * アプリがフォアグラウンドに戻ったときに通知をチェック
 */
const handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
  console.log(`[AppState] App state changed to: ${nextAppState}`);
  
  // アプリがバックグラウンドからフォアグラウンドに戻った時
  if (nextAppState === 'active') {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      console.log('[AppState] No user logged in, skipping notifications');
      return;
    }

    // ユーザーID（Firebaseではuidプロパティ）
    const userId = currentUser.uid;
    
    try {
      await checkNotifications(userId);
      console.log('[AppState] Notifications processed on app resume');
    } catch (error) {
      console.error('[AppState] Error processing notifications on app resume:', error);
    }
  }
};

/**
 * 通知をチェックする
 */
const checkNotifications = async (userId: string): Promise<void> => {
  // 近くのイベント通知を生成
  await createNearbyEventNotifications(userId);
  
  // 今後1週間以内に開催されるイベントの通知を生成
  await createUpcomingEventNotifications(userId);
  
  console.log('[NotificationService] Notifications checked for user:', userId);
}; 