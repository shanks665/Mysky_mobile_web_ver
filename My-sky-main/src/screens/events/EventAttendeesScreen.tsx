import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { createEventRequestApprovedNotification, createEventRequestRejectedNotification } from '../../services/notificationService';

type EventAttendeesRouteProp = RouteProp<DiscoverStackParamList, 'EventAttendees'>;
type EventAttendeesNavigationProp = StackNavigationProp<DiscoverStackParamList, 'EventAttendees'>;

const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';

type Attendee = {
  id: string;
  nickname: string;
  profilePhoto?: string;
  isCreator?: boolean;
};

type PendingAttendee = {
  id: string;
  nickname: string;
  profilePhoto?: string;
};

const EventAttendeesScreen: React.FC = () => {
  const { user } = useAuth();
  const route = useRoute<EventAttendeesRouteProp>();
  const navigation = useNavigation<EventAttendeesNavigationProp>();
  const { eventId, mode = 'view', title, initialTab = 'attendees' } = route.params;

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [pendingAttendees, setPendingAttendees] = useState<PendingAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendees' | 'pending'>(initialTab as 'attendees' | 'pending');
  const [processingIds, setProcessingIds] = useState<string[]>([]);

  // ナビゲーションヘッダーの設定
  useEffect(() => {
    navigation.setOptions({
      title: title || 'イベント参加者'
    });
  }, [navigation, title]);

  // イベント情報と参加者リストを取得
  const fetchEventAndAttendees = useCallback(async () => {
    try {
      setLoading(true);
      
      // イベント情報を取得
      const eventDoc = await firestore().collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        Alert.alert('エラー', 'イベントが見つかりませんでした');
        navigation.goBack();
        return;
      }
      
      const eventData = eventDoc.data();
      if (!eventData) {
        Alert.alert('エラー', 'イベントデータが見つかりませんでした');
        navigation.goBack();
        return;
      }
      
      setEvent(eventData);
      
      // 現在のユーザーがイベント作成者かどうか確認
      const userIsCreator = user && eventData.createdBy === user.id;
      setIsCreator(!!userIsCreator);

      // 管理者かどうか確認
      const userIsAdmin = user && eventData.admins && eventData.admins.includes(user.id);
      setIsAdmin(!!userIsAdmin);

      // 管理権限がない場合、承認待ちタブを表示しない
      if (!userIsCreator && !userIsAdmin && activeTab === 'pending') {
        setActiveTab('attendees');
      }
      
      // 参加者情報を取得
      if (eventData.attendees && eventData.attendees.length > 0) {
        const attendeePromises = eventData.attendees.map(async (attendeeId: string) => {
          try {
            const attendeeDoc = await firestore().collection('users').doc(attendeeId).get();
            if (attendeeDoc.exists) {
              const attendeeData = attendeeDoc.data();
              return { 
                id: attendeeDoc.id, 
                nickname: attendeeData?.nickname || '不明なユーザー',
                profilePhoto: attendeeData?.profilePhoto || '',
                isCreator: attendeeId === eventData.createdBy,
                ...attendeeData
              };
            }
            return { 
              id: attendeeId, 
              nickname: '不明なユーザー', 
              profilePhoto: '',
              isCreator: attendeeId === eventData.createdBy
            };
          } catch (err) {
            console.error(`Error fetching attendee ${attendeeId}:`, err);
            return { 
              id: attendeeId, 
              nickname: '不明なユーザー', 
              profilePhoto: '',
              isCreator: attendeeId === eventData.createdBy
            };
          }
        });
        
        const attendeesData = await Promise.all(attendeePromises);
        
        // 作成者を先頭に表示するように並び替え
        attendeesData.sort((a, b) => {
          if (a.isCreator) return -1;
          if (b.isCreator) return 1;
          return 0;
        });
        
        setAttendees(attendeesData);
      } else {
        setAttendees([]);
      }
      
      // 承認待ちユーザー情報を取得（管理者以上の権限がある場合のみ）
      if ((userIsCreator || userIsAdmin) && eventData.pendingAttendees && eventData.pendingAttendees.length > 0) {
        const pendingPromises = eventData.pendingAttendees.map(async (attendeeId: string) => {
          try {
            const attendeeDoc = await firestore().collection('users').doc(attendeeId).get();
            if (attendeeDoc.exists) {
              const attendeeData = attendeeDoc.data();
              return { 
                id: attendeeDoc.id, 
                nickname: attendeeData?.nickname || '不明なユーザー',
                profilePhoto: attendeeData?.profilePhoto || '',
                ...attendeeData
              };
            }
            return { 
              id: attendeeId, 
              nickname: '不明なユーザー', 
              profilePhoto: '',
            };
          } catch (err) {
            console.error(`Error fetching pending attendee ${attendeeId}:`, err);
            return { 
              id: attendeeId, 
              nickname: '不明なユーザー', 
              profilePhoto: '',
            };
          }
        });
        
        const pendingData = await Promise.all(pendingPromises);
        setPendingAttendees(pendingData);
      } else {
        setPendingAttendees([]);
      }
      
    } catch (error) {
      console.error('Error fetching event data:', error);
      Alert.alert('エラー', 'イベント情報の取得に失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, navigation, user, activeTab]);
  
  useEffect(() => {
    fetchEventAndAttendees();
  }, [fetchEventAndAttendees]);
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchEventAndAttendees();
  };
  
  // ユーザープロフィール画面へ遷移
  const navigateToUserProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };
  
  // 管理者権限を譲渡
  const handleTransferCreator = async (newCreatorId: string) => {
    if (!event || !isCreator) return;
    
    console.log('Transferring creator rights from', user?.id, 'to', newCreatorId);
    
    // 自分自身には譲渡できない
    if (newCreatorId === user?.id) {
      Alert.alert('エラー', '自分自身に管理者権限を譲渡することはできません');
      return;
    }
    
    const selectedAttendee = attendees.find(a => a.id === newCreatorId);
    if (!selectedAttendee) {
      Alert.alert('エラー', '選択された参加者が見つかりません');
      return;
    }
    
    Alert.alert(
      '管理者権限の譲渡',
      `${selectedAttendee.nickname}にイベントの管理者権限を譲渡しますか？\n\nこの操作は取り消せません。譲渡後は通常の参加者になります。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '譲渡する', 
          style: 'destructive',
          onPress: async () => {
            try {
              const eventRef = firestore().collection('events').doc(eventId);
              
              console.log('Starting transaction to transfer creator rights');
              
              // トランザクションで更新
              await firestore().runTransaction(async (transaction) => {
                const eventDoc = await transaction.get(eventRef);
                
                if (!eventDoc.exists) {
                  throw new Error('イベントが見つかりませんでした');
                }
                
                const eventData = eventDoc.data();
                
                if (!eventData) {
                  throw new Error('イベントデータが見つかりませんでした');
                }
                
                console.log('Updating event creator from', eventData.createdBy, 'to', newCreatorId);
                
                // 現在の管理者リストを安全に取得
                const currentAdmins = Array.isArray(eventData.admins) ? eventData.admins : [];
                
                // 元の作成者を確実に管理者リストから削除し、新しい作成者を追加
                const newAdmins = currentAdmins
                  .filter((id: string) => id !== user?.id && id !== newCreatorId)
                  .concat([newCreatorId]);
                
                // 管理者権限を譲渡（更新を1回のみに変更）
                transaction.update(eventRef, {
                  createdBy: newCreatorId,
                  admins: newAdmins,
                  updatedAt: firestore.FieldValue.serverTimestamp()
                });
              });
              
              console.log('Transaction completed successfully');
              
              // 状態を更新
              setAttendees(prev => 
                prev.map(attendee => {
                  if (attendee.id === user?.id) {
                    return { ...attendee, isCreator: false };
                  } else if (attendee.id === newCreatorId) {
                    return { ...attendee, isCreator: true };
                  }
                  return attendee;
                }).sort((a, b) => {
                  if (a.isCreator) return -1;
                  if (b.isCreator) return 1;
                  return 0;
                })
              );
              
              setIsCreator(false);
              setEvent((prev: any) => {
                // 現在の管理者リストを安全に取得
                const currentAdmins = Array.isArray(prev.admins) ? prev.admins : [];
                
                // 元の作成者を確実に管理者リストから削除し、新しい作成者を追加
                const newAdmins = currentAdmins
                  .filter((id: string) => id !== user?.id && id !== newCreatorId)
                  .concat([newCreatorId]);
                  
                return { 
                  ...prev, 
                  createdBy: newCreatorId,
                  admins: newAdmins
                };
              });
              
              // 成功アラートを表示
              Alert.alert(
                '成功',
                'イベントの管理者権限を譲渡しました。あなたは通常の参加者になりました。',
                [
                  { 
                    text: 'イベント詳細に戻る', 
                    onPress: () => {
                      console.log('Navigating back to EventDetails with eventId:', eventId);
                      // イベント詳細画面にリセットして戻る（スタックをクリアして新しい状態で表示）
                      navigation.reset({
                        index: 1,
                        routes: [
                          { name: 'Discover' },
                          { 
                            name: 'EventDetails', 
                            params: { 
                              eventId,
                              forceRefresh: true, // 強制的に再読み込みするためのフラグ
                              transferCompleted: true, // 譲渡が完了したフラグ
                              newCreatorId: newCreatorId // 新しい作成者IDを追加
                            }
                          }
                        ],
                      });
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Error transferring event creator:', error);
              Alert.alert('エラー', 'イベント管理者権限の譲渡に失敗しました');
            }
          }
        }
      ]
    );
  };

  // リクエスト承認処理
  const handleApproveRequest = async (attendeeId: string) => {
    if (!event || (!isCreator && !isAdmin)) return;
    
    try {
      setProcessingIds(prev => [...prev, attendeeId]);
      
      const eventRef = firestore().collection('events').doc(eventId);
      
      // トランザクションで安全に更新
      await firestore().runTransaction(async (transaction) => {
        const eventDoc = await transaction.get(eventRef);
        
        if (!eventDoc.exists) {
          throw new Error('イベントが見つかりませんでした');
        }
        
        const eventData = eventDoc.data();
        if (!eventData) {
          throw new Error('イベントデータが見つかりませんでした');
        }
        
        // 現在のpendingAttendeesリストからユーザーIDを削除
        const updatedPendingAttendees = (eventData.pendingAttendees || [])
          .filter((id: string) => id !== attendeeId);
        
        // 現在のattendeesリストにユーザーIDを追加（存在しない場合のみ）
        const currentAttendees = eventData.attendees || [];
        const updatedAttendees = currentAttendees.includes(attendeeId) 
          ? currentAttendees 
          : [...currentAttendees, attendeeId];
        
        // イベントドキュメントを更新
        transaction.update(eventRef, {
          pendingAttendees: updatedPendingAttendees,
          attendees: updatedAttendees,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });
      
      // 承認通知を送信
      await createEventRequestApprovedNotification(eventId, attendeeId);
      
      // ユーザー情報を取得して参加者一覧に追加
      const userDoc = await firestore().collection('users').doc(attendeeId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const newAttendee: Attendee = {
          id: attendeeId,
          nickname: userData?.nickname || '不明なユーザー',
          profilePhoto: userData?.profilePhoto || '',
          isCreator: false,
        };
        
        // 状態を更新
        setPendingAttendees(prev => prev.filter(attendee => attendee.id !== attendeeId));
        setAttendees(prev => [...prev, newAttendee]);
      } else {
        // ユーザーが見つからない場合も、リクエスト一覧からは削除
        setPendingAttendees(prev => prev.filter(attendee => attendee.id !== attendeeId));
      }
      
      // 成功メッセージ
      Alert.alert('成功', 'リクエストを承認しました');
    } catch (error) {
      console.error('Error approving request:', error);
      Alert.alert('エラー', 'リクエスト承認に失敗しました');
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== attendeeId));
    }
  };
  
  // リクエスト拒否処理
  const handleRejectRequest = async (attendeeId: string) => {
    if (!event || (!isCreator && !isAdmin)) return;
    
    try {
      setProcessingIds(prev => [...prev, attendeeId]);
      
      const eventRef = firestore().collection('events').doc(eventId);
      
      // pendingAttendeesリストから削除
      await eventRef.update({
        pendingAttendees: firestore.FieldValue.arrayRemove(attendeeId),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      // 拒否通知を送信
      await createEventRequestRejectedNotification(eventId, attendeeId);
      
      // リストから削除
      setPendingAttendees(prev => prev.filter(attendee => attendee.id !== attendeeId));
      
      // 成功メッセージ
      Alert.alert('成功', 'リクエストを拒否しました');
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('エラー', 'リクエスト拒否に失敗しました');
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== attendeeId));
    }
  };
  
  const renderAttendeeItem = ({ item }: { item: Attendee }) => {
    // 転送モードでのみ管理者ボタンを表示
    const showTransferButton = mode === 'transfer' && isCreator && item.id !== user?.id;
    
    return (
      <View style={styles.attendeeItem}>
        <TouchableOpacity
          style={styles.attendeeInfo}
          onPress={() => navigateToUserProfile(item.id)}
        >
          <Image
            source={{ uri: item.profilePhoto || DEFAULT_PROFILE_IMAGE }}
            style={styles.attendeePhoto}
          />
          <View style={styles.attendeeDetails}>
            <Text style={styles.attendeeName}>{item.nickname}</Text>
            {item.isCreator && (
              <View style={styles.creatorBadge}>
                <Icon name="star" size={12} color="#FFF" />
                <Text style={styles.creatorBadgeText}>管理者</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        {showTransferButton && (
          <TouchableOpacity
            style={styles.transferButton}
            onPress={() => handleTransferCreator(item.id)}
          >
            <Icon name="person-add" size={18} color={theme.colors.primary} />
            <Text style={styles.transferButtonText}>管理者に設定</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderPendingItem = ({ item }: { item: PendingAttendee }) => {
    const isProcessing = processingIds.includes(item.id);
    
    return (
      <View style={styles.attendeeItem}>
        <TouchableOpacity
          style={styles.attendeeInfo}
          onPress={() => navigateToUserProfile(item.id)}
          disabled={isProcessing}
        >
          <Image
            source={{ uri: item.profilePhoto || DEFAULT_PROFILE_IMAGE }}
            style={styles.attendeePhoto}
          />
          <View style={styles.attendeeDetails}>
            <Text style={styles.attendeeName}>{item.nickname}</Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>承認待ち</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        <View style={styles.actionButtons}>
          {isProcessing ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleApproveRequest(item.id)}
              >
                <Icon name="checkmark" size={20} color="#FFF" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleRejectRequest(item.id)}
              >
                <Icon name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // タブボタン
  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'attendees' && styles.activeTabButton,
        ]}
        onPress={() => setActiveTab('attendees')}
      >
        <Text
          style={[
            styles.tabButtonText,
            activeTab === 'attendees' && styles.activeTabButtonText,
          ]}
        >
          参加者 ({attendees.length})
        </Text>
      </TouchableOpacity>
      
      {(isCreator || isAdmin) && (
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'pending' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('pending')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'pending' && styles.activeTabButtonText,
            ]}
          >
            承認待ち ({pendingAttendees.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // 空の状態表示
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.emptyText}>読み込み中...</Text>
        </View>
      );
    }
    
    if (activeTab === 'attendees' && attendees.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="people-outline" size={64} color={theme.colors.text.secondary} />
          <Text style={styles.emptyText}>参加者はいません</Text>
        </View>
      );
    }
    
    if (activeTab === 'pending' && pendingAttendees.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="time-outline" size={64} color={theme.colors.text.secondary} />
          <Text style={styles.emptyText}>承認待ちのリクエストはありません</Text>
        </View>
      );
    }
    
    return null;
  };
  
  if (loading && !attendees.length && !pendingAttendees.length) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>イベント情報を読み込み中...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {renderTabButtons()}
      
      {activeTab === 'attendees' ? (
        <FlatList
          data={attendees}
          keyExtractor={(item) => item.id}
          renderItem={renderAttendeeItem}
          contentContainerStyle={[
            styles.listContent,
            attendees.length === 0 && styles.emptyListContent
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
        />
      ) : (
        <FlatList
          data={pendingAttendees}
          keyExtractor={(item) => item.id}
          renderItem={renderPendingItem}
          contentContainerStyle={[
            styles.listContent,
            pendingAttendees.length === 0 && styles.emptyListContent
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  emptyListContent: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  activeTabButtonText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attendeePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: theme.spacing.md,
  },
  attendeeDetails: {
    flex: 1,
  },
  attendeeName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  creatorBadgeText: {
    fontSize: 12,
    color: '#FFF',
    marginLeft: 4,
  },
  pendingBadge: {
    backgroundColor: theme.colors.warning + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  pendingBadgeText: {
    fontSize: 12,
    color: theme.colors.warning,
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  transferButtonText: {
    fontSize: 12,
    color: theme.colors.primary,
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  approveButton: {
    backgroundColor: theme.colors.success,
  },
  rejectButton: {
    backgroundColor: theme.colors.error,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});

export default EventAttendeesScreen; 