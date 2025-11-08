import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification 
} from '../services/notificationService';
import { Notification, NotificationType } from '../models/Notification';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { COLORS } from '../constants/colors';
import { User } from '../models/User';

type NotificationsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Notifications'>;

type FilterType = 'all' | 'requests' | 'events';

const NotificationsScreen = () => {
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // 通知を取得する
  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const fetchedNotifications = await getUserNotifications(user.id);
      setNotifications(fetchedNotifications);
      applyFilter(fetchedNotifications, activeFilter);
    } catch (error) {
      console.error('通知の取得中にエラーが発生しました:', error);
      Alert.alert('エラー', '通知の取得に失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // フィルター適用
  const applyFilter = (notifications: Notification[], filter: FilterType) => {
    if (filter === 'all') {
      setFilteredNotifications(notifications);
    } else if (filter === 'requests') {
      const requestTypes: NotificationType[] = ['circle_join_request', 'event_join_request', 'follow_request'];
      setFilteredNotifications(notifications.filter(n => requestTypes.includes(n.type)));
    } else if (filter === 'events') {
      const eventTypes: NotificationType[] = ['upcoming_event', 'nearby_event', 'event_request_approved', 'event_request_rejected', 'circle_request_approved', 'circle_request_rejected'];
      setFilteredNotifications(notifications.filter(n => eventTypes.includes(n.type)));
    }
  };

  // フィルター変更
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    applyFilter(notifications, filter);
  };

  // 画面がフォーカスされるたびに通知を取得する
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [user])
  );

  // 通知をすべて既読にする
  const handleMarkAllAsRead = async () => {
    if (!user || notifications.filter(n => !n.read).length === 0) return;

    try {
      await markAllNotificationsAsRead(user.id);
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => ({
          ...notification,
          read: true
        }))
      );
      applyFilter(notifications.map(n => ({ ...n, read: true })), activeFilter);
    } catch (error) {
      console.error('通知の既読処理中にエラーが発生しました:', error);
      Alert.alert('エラー', '通知の既読処理に失敗しました');
    }
  };

  // 通知をタップした時の処理
  const handleNotificationPress = async (notification: Notification) => {
    if (!user) return;

    // まだ既読でない場合は既読にする
    if (!notification.read) {
      try {
        await markNotificationAsRead(user.id, notification.id);
        const updatedNotifications = notifications.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        );
        setNotifications(updatedNotifications);
        applyFilter(updatedNotifications, activeFilter);
      } catch (error) {
        console.error('通知の既読処理中にエラーが発生しました:', error);
      }
    }

    // 通知のタイプに応じて適切な画面に遷移する
    navigateBasedOnNotificationType(notification);
  };

  // 通知を削除する
  const handleDeleteNotification = async (notificationId: string) => {
    if (!user) return;

    try {
      await deleteNotification(user.id, notificationId);
      const updatedNotifications = notifications.filter(n => n.id !== notificationId);
      setNotifications(updatedNotifications);
      applyFilter(updatedNotifications, activeFilter);
    } catch (error) {
      console.error('通知の削除中にエラーが発生しました:', error);
      Alert.alert('エラー', '通知の削除に失敗しました');
    }
  };

  // 通知の種類に応じて適切な画面に遷移する
  const navigateBasedOnNotificationType = (notification: Notification) => {
    const { type, data } = notification;
    
    switch (type) {
      case 'circle_join_request':
        if (data?.circleId && data?.userId) {
          // @ts-ignore - 型定義の問題を一時的に回避
          navigation.navigate('CircleRequests', { circleId: data.circleId });
        }
        break;
      
      case 'circle_request_approved':
      case 'circle_request_rejected':
        if (data?.circleId) {
          navigation.navigate('CircleDetails', { circleId: data.circleId });
        }
        break;
      
      case 'event_join_request':
        if (data?.eventId && data?.userId) {
          // @ts-ignore - 型定義の問題を一時的に回避
          navigation.navigate('EventAttendees', { eventId: data.eventId });
        }
        break;
      
      case 'event_request_approved':
      case 'event_request_rejected':
      case 'upcoming_event':
      case 'nearby_event':
        if (data?.eventId) {
          navigation.navigate('EventDetails', { eventId: data.eventId });
        }
        break;
      
      case 'follow_request':
        if (data?.userId) {
          navigation.navigate('UserProfile', { userId: data.userId });
        }
        break;
      
      default:
        break;
    }
  };

  // PullToRefresh処理
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  // リクエスト通知かどうかを判定する
  const isRequestNotification = (type: NotificationType): boolean => {
    return type === 'circle_join_request' || type === 'event_join_request' || type === 'follow_request';
  };

  // 通知アイコンを取得する
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'circle_join_request':
        return 'account-multiple-plus';
      case 'circle_request_approved':
        return 'account-check';
      case 'circle_request_rejected':
        return 'account-cancel';
      case 'event_join_request':
        return 'calendar-plus';
      case 'event_request_approved':
        return 'calendar-check';
      case 'event_request_rejected':
        return 'calendar-remove';
      case 'nearby_event':
        return 'map-marker-radius';
      case 'upcoming_event':
        return 'clock-alert';
      case 'follow_request':
        return 'account-plus';
      default:
        return 'bell';
    }
  };

  // 右スワイプで削除機能を表示する
  const renderRightActions = (notificationId: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteNotification(notificationId)}
      >
        <Icon name="delete" size={24} color="white" />
        <Text style={styles.deleteText}>削除</Text>
      </TouchableOpacity>
    );
  };

  // 通知アイテムをレンダリングする
  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const isRequest = isRequestNotification(item.type);
    
    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item.id)}
      >
        <TouchableOpacity
          style={[
            styles.notificationItem,
            item.read ? styles.readNotification : styles.unreadNotification,
            isRequest && styles.requestNotification
          ]}
          onPress={() => handleNotificationPress(item)}
        >
          <View style={[
            styles.iconContainer,
            isRequest && styles.requestIconContainer
          ]}>
            <Icon
              name={getNotificationIcon(item.type)}
              size={24}
              color={isRequest ? COLORS.accent : COLORS.primary}
            />
          </View>
          <View style={styles.contentContainer}>
            <Text style={[styles.title, isRequest && styles.requestTitle]}>
              {item.title}
              {isRequest && ' 🔔'}
            </Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>
              {formatDistanceToNow(item.createdAt, { addSuffix: true, locale: ja })}
            </Text>
          </View>
          {!item.read && <View style={[
            styles.unreadDot,
            isRequest && styles.requestUnreadDot
          ]} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  // 通知リストが空の場合のレンダリング
  const renderEmptyList = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="bell-off" size={50} color={COLORS.mediumGray} />
        <Text style={styles.emptyText}>
          {activeFilter === 'all' 
            ? '通知はありません' 
            : activeFilter === 'requests' 
              ? 'リクエスト通知はありません'
              : 'イベント通知はありません'
          }
        </Text>
      </View>
    );
  };

  // フィルタータブをレンダリングする
  const renderFilterTabs = () => {
    return (
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'all' && styles.activeFilterTab]}
          onPress={() => handleFilterChange('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>すべて</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'requests' && styles.activeFilterTab]}
          onPress={() => handleFilterChange('requests')}
        >
          <Text style={[styles.filterText, activeFilter === 'requests' && styles.activeFilterText]}>リクエスト</Text>
          {notifications.some(n => isRequestNotification(n.type) && !n.read) && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>
                {notifications.filter(n => isRequestNotification(n.type) && !n.read).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'events' && styles.activeFilterTab]}
          onPress={() => handleFilterChange('events')}
        >
          <Text style={[styles.filterText, activeFilter === 'events' && styles.activeFilterText]}>イベント</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ヘッダー右側のボタン
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleMarkAllAsRead}
          disabled={notifications.filter(n => !n.read).length === 0}
        >
          <Text style={[
            styles.headerButtonText,
            notifications.filter(n => !n.read).length === 0 ? styles.disabledText : null
          ]}>
            すべて既読
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, notifications]);

  return (
    <View style={styles.container}>
      {renderFilterTabs()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={filteredNotifications.length === 0 ? { flex: 1 } : null}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  readNotification: {
    backgroundColor: COLORS.white,
  },
  unreadNotification: {
    backgroundColor: COLORS.paleBlue,
  },
  requestNotification: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
  },
  requestIconContainer: {
    backgroundColor: `${COLORS.accent}20`,
    borderRadius: 20,
    padding: 8,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: COLORS.darkText,
  },
  requestTitle: {
    color: COLORS.accent,
  },
  body: {
    fontSize: 14,
    color: COLORS.darkText,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: COLORS.mediumGray,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    alignSelf: 'center',
    marginLeft: 10,
  },
  requestUnreadDot: {
    backgroundColor: COLORS.accent,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteText: {
    color: COLORS.white,
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.mediumGray,
    marginTop: 16,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  disabledText: {
    color: COLORS.mediumGray,
  },
  filterContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    elevation: 2,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeFilterTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    color: COLORS.mediumGray,
  },
  activeFilterText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  badgeContainer: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    paddingHorizontal: 5,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default NotificationsScreen; 