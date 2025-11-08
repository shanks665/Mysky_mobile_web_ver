import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

import { theme } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';
import { CircleEvent } from '../../models/Circle';
import { DiscoverStackParamList, EventsStackParamList, RootStackParamList } from '../../navigation/types';
import EventBoardContent from './EventBoardContent';
import { 
  createEventJoinRequestNotification, 
  createEventRequestApprovedNotification, 
  createEventRequestRejectedNotification,
} from '../../services/notificationService';
import { getLocationString } from '../../utils/prefectureData';

// Default cover image when none is provided
const DEFAULT_COVER_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/meetify-app-12a8e.appspot.com/o/defaults%2Fdefault-event-cover.jpg?alt=media';
const DEFAULT_USER_AVATAR = 'https://firebasestorage.googleapis.com/v0/b/meetify-app-12a8e.appspot.com/o/defaults%2Fdefault-user-icon.png?alt=media';

// Simple toast message implementation
const showMessage = (message: string, type: 'success' | 'error' | 'warning') => {
  Alert.alert(
    type === 'success' ? '成功' : type === 'error' ? 'エラー' : '警告',
    message,
    [{ text: 'OK' }]
  );
};

type EventDetailsRouteProp = 
  | RouteProp<DiscoverStackParamList, 'EventDetails'>
  | RouteProp<EventsStackParamList, 'EventDetails'>;

type EventDetailsNavigationProp = StackNavigationProp<RootStackParamList>;

// 拡張したイベント型の定義
interface ExtendedCircleEvent extends CircleEvent {
  maxParticipants?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    prefecture?: string;
    city?: string;
  };
}

// 参加者情報の型
interface Attendee {
  id: string;
  displayName: string;
  photoURL: string | null;
  nickname?: string;
}

// タブの種類を定義
type TabType = 'details' | 'board';

const EventDetailsScreen: React.FC = () => {
  const route = useRoute<EventDetailsRouteProp>();
  const navigation = useNavigation<any>(); // NavigationPropの型をanyに緩和
  const { user } = useAuth();
  const { eventId } = route.params;
  
  // userがnullの場合に対応
  const currentUserId = user?.id || null;

  const [event, setEvent] = useState<ExtendedCircleEvent | null>(null);
  const [attendeesCount, setAttendeesCount] = useState(0);
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [circle, setCircle] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [organizer, setOrganizer] = useState<Attendee | null>(null);
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'owner' | 'none'>('none');

  // Leave event handler
  const handleLeaveEvent = useCallback(async () => {
    if (!user) return;

    setJoining(true);
    try {
      const eventDoc = await firestore().collection('events').doc(eventId).get();
      if (!eventDoc.exists) {
        throw new Error('イベントが見つかりませんでした');
      }
      
      const eventData = eventDoc.data() || {};
      
      // 承認待ちリストにいる場合
      if (eventData.pendingAttendees && eventData.pendingAttendees.includes(user.id)) {
        // pendingAttendeesから削除
        await firestore().collection('events').doc(eventId).update({
          pendingAttendees: firestore.FieldValue.arrayRemove(user.id)
        });
        showMessage('参加リクエストをキャンセルしました', 'success');
        
        // UI状態を更新
        setEvent(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            pendingAttendees: (prev.pendingAttendees || []).filter(id => id !== user.id)
          };
        });
      } else {
        // 参加者リストから削除
        await firestore().collection('events').doc(eventId).update({
          attendees: firestore.FieldValue.arrayRemove(user.id)
        });
        showMessage('参加をキャンセルしました', 'success');
        setAttendeesCount(prev => prev - 1);
        
        // UI状態を更新
        setEvent(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            attendees: (prev.attendees || []).filter(id => id !== user.id)
          };
        });
        
        // 参加者一覧から削除
        setAttendees(prev => prev.filter(a => a.id !== user.id));
      }
    } catch (error) {
      console.error('Error leaving event:', error);
      showMessage('参加キャンセルに失敗しました', 'error');
    } finally {
      setJoining(false);
    }
  }, [eventId, user]);

  // Check if the user is attending the event
  const isAttending = useMemo(() => {
    if (!currentUserId || !event?.attendees) return false;
    return event.attendees.includes(currentUserId);
  }, [event, currentUserId]);

  // Check if the user has a pending request to join the event
  const isPendingAttendee = useMemo(() => {
    if (!currentUserId || !event?.pendingAttendees) return false;
    return event.pendingAttendees.includes(currentUserId);
  }, [event, currentUserId]);

  // Check if the user is the creator of the event
  const isCreator = useMemo(() => {
    if (!currentUserId) return false;
    return event?.createdBy === currentUserId;
  }, [event, currentUserId]);

  // Check if the event is in the past
  const isEventPast = useMemo(() => {
    if (!event?.endDate) return false;
    const eventEndDate = event.endDate instanceof Date 
      ? event.endDate 
      : (event.endDate as any).toDate?.() || new Date(event.endDate);
    return eventEndDate < new Date();
  }, [event]);

  // Get user role in the circle
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!currentUserId || !circle?.id) return;
      
      try {
        const circleDoc = await firestore().collection('circles').doc(circle.id).get();
      if (circleDoc.exists) {
        const circleData = circleDoc.data();
        if (circleData) {
            if (circleData.createdBy === currentUserId) {
              setUserRole('owner');
            } else if (circleData.admins?.includes(currentUserId)) {
              setUserRole('admin');
            } else if (circleData.members?.includes(currentUserId)) {
                setUserRole('member');
            } else {
              setUserRole('none');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    if (circle?.id && currentUserId) {
      fetchUserRole();
    }
  }, [circle, currentUserId]);

  // Handle navigate to create event
  const handleCreateEvent = useCallback(() => {
    if (circle?.id) {
      navigation.navigate('CreateEvent', { circleId: circle.id });
    }
  }, [circle, navigation]);

  // 参加者情報取得
  const fetchAttendees = useCallback(async () => {
    if (!event?.attendees?.length) return;
    
    setLoadingAttendees(true);
    try {
      const attendeesData: Attendee[] = [];
      // Promise.allを使用して並列処理
      const fetchPromises = event.attendees.map(async userId => {
        const userDoc = await firestore().collection('users').doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
          if (userData) {
            return {
              id: userId,
              displayName: userData.displayName || '匿名ユーザー',
              nickname: userData.nickname || '匿名ユーザー',
              photoURL: userData.photoURL || userData.profilePhoto || null
            };
          }
        }
        return null;
      });
      
      const results = await Promise.all(fetchPromises);
      // nullでない結果だけをフィルタリング
      setAttendees(results.filter(item => item !== null) as Attendee[]);
    } catch (error) {
      console.error('Error fetching attendees:', error);
    } finally {
      setLoadingAttendees(false);
    }
  }, [event]);
  
  // Load event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const eventDoc = await firestore().collection('events').doc(eventId).get();
        
        if (eventDoc.exists) {
          const eventData = eventDoc.data() as ExtendedCircleEvent;
          // Don't specify id twice
          setEvent({ ...eventData, id: eventDoc.id });
          setAttendeesCount(eventData.attendees?.length || 0);

          // Fetch creator info
          if (eventData.createdBy) {
            const creatorDoc = await firestore().collection('users').doc(eventData.createdBy).get();
            if (creatorDoc.exists) {
              const creatorData = creatorDoc.data();
              setCreatorName(creatorData?.displayName || creatorData?.nickname || '');
              setOrganizer({
                id: eventData.createdBy,
                displayName: creatorData?.displayName || '匿名ユーザー',
                nickname: creatorData?.nickname || '匿名ユーザー',
                photoURL: creatorData?.photoURL || creatorData?.profilePhoto || null
              });
            }
          }

          // Fetch circle info if event has a circle
          if (eventData.circleId) {
            const circleDoc = await firestore().collection('circles').doc(eventData.circleId).get();
            if (circleDoc.exists) {
              setCircle({
                id: circleDoc.id,
                name: circleDoc.data()?.name || '',
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching event details:', error);
        showMessage('イベント情報の取得に失敗しました', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // 参加者情報の取得
  useEffect(() => {
    if (event?.attendees) {
      fetchAttendees();
    }
  }, [event, fetchAttendees]);

  // Join event handler
  const handleJoinEvent = useCallback(async () => {
    // ユーザーがログインしていない場合
    if (!user) {
      showMessage('参加するにはログインが必要です', 'warning');
      return;
    }
      
    if (isAttending) {
      // 直接キャンセル処理を呼び出す
      handleLeaveEvent();
      return;
    }
    
    // 承認待ちの場合は取り消し処理を行う
    if (isPendingAttendee) {
      handleLeaveEvent();
      return;
    }
      
    setJoining(true);
    try {
      // Check if event requires approval
      if (event?.requiresApproval) {
        // Add to pending attendees
        await firestore().collection('events').doc(eventId).update({
          pendingAttendees: firestore.FieldValue.arrayUnion(user.id)
        });
        
        // 参加リクエスト通知を送信
        try {
          await createEventJoinRequestNotification(eventId, user.id);
        } catch (notifError) {
          console.error('Failed to send notification:', notifError);
          // 通知送信エラーはユーザー体験に影響しないため、ここではエラー表示しない
        }
        
        // UI状態を更新
        setEvent(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            pendingAttendees: [...(prev.pendingAttendees || []), user.id]
          };
        });
        
        showMessage('参加リクエストを送信しました', 'success');
      } else {
        // Add directly to attendees
        await firestore().collection('events').doc(eventId).update({
          attendees: firestore.FieldValue.arrayUnion(user.id)
        });
        showMessage('イベントに参加しました', 'success');
        setAttendeesCount(prev => prev + 1);
        // Update local state
        setEvent(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            attendees: [...(prev.attendees || []), user.id]
          };
        });
        
        // 参加者一覧を更新
        fetchAttendees();
      }
    } catch (error) {
      console.error('Error joining event:', error);
      showMessage('参加処理に失敗しました', 'error');
    } finally {
      setJoining(false);
    }
  }, [event, eventId, isAttending, isPendingAttendee, user, fetchAttendees, handleLeaveEvent]);

  // Share event handler
  const handleShareEvent = useCallback(async () => {
    setSharingLoading(true);
    try {
      await Share.share({
        message: `【Meetify】${event?.title}に参加しませんか？詳細はこちら: https://meetify.app/events/${eventId}`,
      });
            } catch (error) {
      console.error('Error sharing event:', error);
    } finally {
      setSharingLoading(false);
    }
  }, [event, eventId]);

  // Edit event handler
  const handleEditEvent = useCallback(() => {
      navigation.navigate('EditEvent', { eventId });
  }, [eventId, navigation]);

  // Delete event handler
  const handleDeleteEvent = useCallback(() => {
    Alert.alert(
      'イベントを削除',
      'このイベントを削除しますか？この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除', 
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore().collection('events').doc(eventId).delete();
              showMessage('イベントを削除しました', 'success');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting event:', error);
              showMessage('イベント削除に失敗しました', 'error');
            }
          }
        }
      ]
    );
  }, [eventId, navigation]);

  // 参加者一覧画面に遷移
  const handleViewAllAttendees = useCallback(() => {
    if (event) {
      navigation.navigate('EventAttendees', { eventId: event.id });
    }
  }, [event, navigation]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    
    const refresh = async () => {
      try {
        const eventDoc = await firestore().collection('events').doc(eventId).get();
        
        if (eventDoc.exists) {
          const eventData = eventDoc.data() as ExtendedCircleEvent;
          setEvent({ ...eventData, id: eventDoc.id });
          setAttendeesCount(eventData.attendees?.length || 0);
          fetchAttendees();
        }
    } catch (error) {
        console.error('Error refreshing event:', error);
      } finally {
        setRefreshing(false);
      }
    };
    
    refresh();
  }, [eventId, fetchAttendees]);

  // イベント参加リクエスト管理画面に遷移
  const handleManagePendingRequests = useCallback(() => {
    navigation.navigate('EventAttendees', {
      eventId,
      initialTab: 'pending',
      title: '参加リクエスト'
    });
  }, [navigation, eventId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>イベント情報を読み込み中...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={64} color={theme.colors.error} />
        <Text style={styles.errorText}>イベントが見つかりませんでした</Text>
      </View>
    );
  }

  const startDate = event.startDate instanceof Date 
    ? event.startDate 
    : (event.startDate as any).toDate?.() || new Date(event.startDate);
  
  const endDate = event.endDate
    ? (event.endDate instanceof Date 
      ? event.endDate 
      : (event.endDate as any).toDate?.() || new Date(event.endDate))
    : null;

  // イベントの場所情報を取得
  const locationText = event.locationName || 
    event.location?.address || 
    (event.prefecture && event.city 
      ? getLocationString(event.prefecture, event.city)
      : event.prefecture ? getLocationString(event.prefecture) : event.city || 
        (event.location?.prefecture && event.location?.city 
          ? getLocationString(event.location.prefecture, event.location.city)
          : event.location?.prefecture ? getLocationString(event.location.prefecture) : event.location?.city || null));
          
  // 場所の詳細情報（会場名と別に表示する場合用）
  const locationDetailText = event.prefecture && event.city 
    ? getLocationString(event.prefecture, event.city)
    : event.prefecture ? getLocationString(event.prefecture) : event.city || '';

  // 詳細なデバッグ情報を出力
  console.log('場所情報の詳細:', {
    eventId: event.id,
    locationName: event.locationName,
    hasLocation: !!event.location,
    prefecture: event.prefecture || event.location?.prefecture,
    city: event.city || event.location?.city,
    address: event.location?.address,
    locationText
  });

  return (
    <View style={styles.container}>
      {/* ヘッダー（サークル画面風） */}
      <View style={styles.grayHeader}>
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.metaInfo}>
          <Icon name="calendar-outline" size={14} color="#666" />
          <Text style={styles.metaText}>
            {format(startDate, 'yyyy年M月d日(E)', { locale: ja })}
          </Text>
          <Icon name="time-outline" size={14} color="#666" />
          <Text style={styles.metaText}>
            {format(startDate, 'H:mm')}
          </Text>
          <Icon name="people-outline" size={14} color="#666" />
          <Text style={styles.metaText}>
            {attendeesCount}人
          </Text>
          {locationText && (
            <>
              <Icon name="location-outline" size={14} color="#666" />
              <Text style={styles.metaText}>
                {locationText}
              </Text>
            </>
          )}
        </View>
      </View>
      
      {/* タブバー - サークル画面と統一 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'details' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('details')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'details' && styles.activeTabButtonText,
            ]}
          >
            詳細
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'board' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('board')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'board' && styles.activeTabButtonText,
            ]}
          >
            掲示板
          </Text>
        </TouchableOpacity>
      </View>

      {/* タブコンテンツ */}
      {activeTab === 'details' ? (
      <ScrollView
          contentContainerStyle={{
            paddingBottom: 100, // 下部ボタン用のスペースを確保
          }}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={true}
          bounces={true}
          style={{flex: 1, width: '100%'}}
        >
          {/* カード情報 */}
          <View style={styles.sectionContainer}>
            {/* 主催者情報 */}
            {organizer && (
              <View style={styles.infoItem}>
                <Icon name="person-outline" size={26} color="#2ecc71" />
                <Text style={styles.infoText}>主催者</Text>
                <View style={styles.flexRow}>
                  <Image
                    source={{ uri: organizer.photoURL || DEFAULT_USER_AVATAR }} 
                    style={styles.organizerImage} 
                  />
                  <Text style={styles.infoValue}>{organizer.nickname}</Text>
                </View>
              </View>
            )}
          
            {/* 場所情報 - 常に表示するように修正 */}
            <View style={styles.infoItem}>
              <Icon name="location-outline" size={26} color="#e74c3c" />
              <Text style={styles.infoText}>場所</Text>
              <View style={styles.locationContainer}>
                <Text style={styles.infoValue}>
                  {locationText || '未設定'}
                </Text>
                {/* 会場名と地域情報の両方がある場合は地域情報を小さく表示 */}
                {event.locationName && (event.prefecture || event.city) && (
                  <Text style={styles.locationSubText}>
                    {locationDetailText}
                  </Text>
                )}
              </View>
              {event.location?.latitude && event.location?.longitude && (
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={() => {
                    // 地図アプリで開く処理をここに追加
                  }}
                >
                  <Icon name="map-outline" size={18} color="#3498db" />
                </TouchableOpacity>
              )}
            </View>
        
            {/* 参加者情報 */}
            <TouchableOpacity
              style={[styles.infoItem, { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }]}
              onPress={handleViewAllAttendees}
            >
              <Icon name="people-outline" size={26} color="#3498db" />
              <Text style={styles.infoText}>参加者</Text>
              <View style={styles.attendeeValueContainer}>
                <Text style={styles.infoValue}>{attendeesCount}人が参加予定</Text>
                {/* 参加リクエスト通知 - イベント管理者/作成者の場合のみ表示 */}
                {(isCreator || (event?.admins && event.admins.includes(currentUserId || ''))) && 
                  event?.pendingAttendees && event.pendingAttendees.length > 0 && (
                  <TouchableOpacity 
                    style={styles.pendingRequestsButton}
                    onPress={handleManagePendingRequests}
                  >
                    <Icon name="mail" size={14} color="#FFF" />
                    <Text style={styles.pendingRequestsText}>
                      {event.pendingAttendees.length}件のリクエスト
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Icon name="chevron-forward" size={16} color="#999" style={styles.infoArrow} />
            </TouchableOpacity>
          </View>
          
          {/* 操作ボタン */}
          <View style={styles.actionButtons}>
            {/* 参加/キャンセルボタン */}
                <TouchableOpacity
              style={[
                styles.mainActionButton, 
                isPendingAttendee ? styles.pendingButton : isAttending ? styles.cancelButton : styles.joinButton
              ]} 
              onPress={handleJoinEvent}
              disabled={joining || isEventPast}
            >
              {joining ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Icon 
                    name={isAttending ? "close-circle-outline" : isPendingAttendee ? "close-circle-outline" : "add-circle-outline"} 
                    size={22} 
                    color="#FFF" 
                  />
                  <Text style={styles.actionButtonText}>
                    {isAttending ? 'キャンセル' : isPendingAttendee ? 'リクエスト取消' : '参加する'}
                  </Text>
                </>
              )}
                </TouchableOpacity>
              
            <View style={styles.actionIconsContainer}>
              {/* シェアボタン */}
                <TouchableOpacity
                style={styles.circleButton}
                onPress={handleShareEvent}
                disabled={sharingLoading}
              >
                {sharingLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Icon name="share-social-outline" size={22} color="#4560db" />
                )}
              </TouchableOpacity>

              {/* 管理者向け編集/削除ボタン */}
              {(isCreator || (event?.admins && event.admins.includes(currentUserId || ''))) && (
                <>
              <TouchableOpacity
                    style={styles.circleButton}
                    onPress={handleEditEvent}
                  >
                    <Icon name="create-outline" size={22} color="#333" />
              </TouchableOpacity>
              
                      <TouchableOpacity 
                    style={styles.circleButton}
                    onPress={handleDeleteEvent}
                  >
                    <Icon name="trash-outline" size={22} color={theme.colors.error} />
                      </TouchableOpacity>
                </>
              )}
            </View>
        </View>
        
          {/* イベント詳細欄 */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>イベント詳細</Text>
            <Text style={styles.description}>{event.description || 'イベント詳細はありません'}</Text>
        </View>
        
          {/* 参加者リスト */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>参加者</Text>
            <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={handleViewAllAttendees}
              >
                <Text style={styles.viewAllText}>すべて表示</Text>
                <Icon name="chevron-forward" size={16} color="#4560db" />
              </TouchableOpacity>
            </View>
            
            {loadingAttendees ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : attendees.length === 0 ? (
              <Text style={styles.emptyText}>参加者はまだいません</Text>
          ) : (
              <View style={styles.attendeesList}>
                {attendees.slice(0, Math.min(8, attendees.length)).map((attendee, index) => (
            <TouchableOpacity 
                    key={`attendee-${attendee.id}-${index}`}
                    style={styles.attendeeItem}
                    onPress={() => navigation.navigate('UserProfile', { userId: attendee.id })}
                  >
                    <Image
                      source={{ uri: attendee.photoURL || DEFAULT_USER_AVATAR }} 
                      style={styles.attendeeImage} 
                    />
                    <Text style={styles.attendeeName} numberOfLines={1}>
                      {attendee.nickname}
              </Text>
            </TouchableOpacity>
                ))}
        </View>
            )}
          </View>
      </ScrollView>
      ) : (
        // 掲示板タブ表示
        <View style={styles.boardContainer}>
          <EventBoardContent eventId={eventId} eventName={event.title} />
      </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  grayHeader: {
    backgroundColor: '#E5E5E5',
    padding: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    marginRight: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#888',
  },
  activeTabButton: {
    backgroundColor: '#4560db',
    borderRadius: 20,
  },
  activeTabButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sectionContainer: {
    margin: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 16,
    width: 70,
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  infoArrow: {
    position: 'absolute',
    right: 0,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  organizerImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(90, 120, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#4560db',
    fontWeight: '500',
    marginRight: 4,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  mainActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 50,
    flex: 1,
    maxWidth: '60%',
  },
  actionIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  joinButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButton: {
    backgroundColor: '#ffa500', // オレンジ色に変更
  },
  pendingButton: {
    backgroundColor: '#FFB030',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 8,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    marginLeft: 8,
  },
  boardContainer: {
    flex: 1,
  },
  attendeesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  attendeeItem: {
    alignItems: 'center',
    width: '25%',
    marginBottom: 20,
  },
  attendeeImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  attendeeName: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    maxWidth: '90%',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  attendeeValueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 16,
  },
  pendingRequestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.error,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  pendingRequestsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  locationButton: {
    padding: 4,
    marginLeft: 8,
  },
  locationContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  locationSubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default EventDetailsScreen; 