import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
  TextInput,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList, ProfileStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { Circle } from '../../models/Circle';
import { calculateDistance } from '../../utils/locationUtils';
import { createCircleJoinRequestNotification } from '../../services/notificationService';
import CircleBoardContent from './CircleBoardContent';

type CircleDetailsRouteProp = RouteProp<DiscoverStackParamList | ProfileStackParamList, 'CircleDetails'>;
type CircleDetailsNavigationProp = CompositeNavigationProp<
  StackNavigationProp<DiscoverStackParamList, 'CircleDetails'>,
  StackNavigationProp<ProfileStackParamList>
>;

const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';
const DEFAULT_COVER_IMAGE = 'https://via.placeholder.com/800x200';

const { width } = Dimensions.get('window');

// タブのタイプを定義
type TabType = 'details' | 'board';

const CircleDetailsScreen: React.FC = () => {
  const { user } = useAuth();
  const route = useRoute<CircleDetailsRouteProp>();
  const navigation = useNavigation<CircleDetailsNavigationProp>();
  const { circleId } = route.params;

  const [circle, setCircle] = useState<Circle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [userRole, setUserRole] = useState<'none' | 'member' | 'admin' | 'owner'>('none');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('details');
  
  // エラーハンドリングを最初にレンダリングするためのステート追加
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // 承認待ちリクエストの数を取得
  const [pendingRequestCount, setPendingRequestCount] = useState<number>(0);
  
  const fetchMembers = useCallback(async (id: string) => {
    try {
      const memberList: any[] = [];
      const membersSnapshot = await firestore()
        .collection('circles')
        .doc(id)
        .collection('members')
        .get();
      
      for (const doc of membersSnapshot.docs) {
        const memberData = doc.data();
        try {
          const userDoc = await firestore()
            .collection('users')
            .doc(doc.id)
            .get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            memberList.push({
              id: doc.id,
              nickname: userData?.nickname || 'Unknown',
              profilePhoto: userData?.profilePhoto || DEFAULT_PROFILE_IMAGE,
              role: memberData.role || 'member'
            });
          }
        } catch (err) {
          console.error('メンバー情報取得エラー:', err);
        }
      }
      
      setMembers(memberList);
    } catch (error) {
      console.error('メンバーリスト取得エラー:', error);
    }
  }, []);

  const fetchEvents = useCallback(async (id: string) => {
    try {
      const eventList: any[] = [];
      const eventsSnapshot = await firestore()
        .collection('events')
        .where('circleId', '==', id)
        .orderBy('startDate', 'asc')
        .limit(5)
        .get();
      
      eventsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        eventList.push({ 
          id: doc.id, 
          title: data.title || '',
          description: data.description || '',
          startDate: data.startDate,
          attendees: data.attendees || [],
          coverPhoto: data.coverPhoto || '',
          ...data 
        });
      });
      
      setEvents(eventList);
    } catch (error) {
      console.error('イベント取得エラー:', error);
    }
  }, []);

  const fetchCircleDetails = useCallback(async (isRefresh = false) => {
    if (!user || !circleId) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!loading) {
        setLoading(true);
      }
      
      // サークル取得
      const circleDoc = await firestore().collection('circles').doc(circleId).get();
      
      if (!circleDoc.exists) {
        setHasError(true);
        setErrorMessage('サークルが見つかりませんでした');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const circleData = {
        id: circleDoc.id,
        ...circleDoc.data()
      } as Circle;
      
      console.log('Fetched circle data:', circleData?.name);

      // ブロック関係をチェック（強化版）
      try {
        // 自分のユーザー情報を取得
        const userDoc = await firestore().collection('users').doc(user.id).get();
        if (!userDoc.exists) {
          console.error('User document not found');
          setHasError(true);
          setErrorMessage('ユーザー情報が見つかりませんでした');
          setLoading(false);
          setRefreshing(false);
          return;
        }
        
        const userData = userDoc.data() || {};
        const myBlockedUsers = Array.isArray(userData.blockedUsers) ? userData.blockedUsers : [];
        
        // サークル作成者の情報を取得
        const creatorDoc = await firestore().collection('users').doc(circleData.createdBy).get();
        if (!creatorDoc.exists) {
          console.error('Creator document not found');
          // 作成者が存在しない場合でもサークル情報は表示可能にする
        } else {
          const creatorData = creatorDoc.data() || {};
          const creatorBlockedUsers = Array.isArray(creatorData.blockedUsers) ? creatorData.blockedUsers : [];
          
          // ブロック関係をチェック
          // 自分がサークル作成者をブロックしている場合
          if (myBlockedUsers.includes(circleData.createdBy)) {
            console.log('You blocked the circle creator. Access denied.');
            setHasError(true);
            setErrorMessage('このサークルにはアクセスできません');
            setLoading(false);
            setRefreshing(false);
            return;
          }
          
          // サークル作成者に自分がブロックされている場合
          if (creatorBlockedUsers.includes(user.id)) {
            console.log('You are blocked by the circle creator. Access denied.');
            setHasError(true);
            setErrorMessage('このサークルにはアクセスできません');
            setLoading(false);
            setRefreshing(false);
            return;
          }
          
          // ブロック関係がある場合、自動的にメンバーからも削除
          if (myBlockedUsers.includes(circleData.createdBy) || creatorBlockedUsers.includes(user.id)) {
            console.log('Block relationship detected. Removing from members if needed.');
            
            // 自分がメンバーである場合、自動的に退会
            if (circleData.members && circleData.members.includes(user.id)) {
              console.log('Removing blocked user from members');
              try {
                // トランザクションでメンバーから削除
                await firestore().runTransaction(async (transaction) => {
                  const circleRef = firestore().collection('circles').doc(circleId);
                  
                  // メンバーから削除
                  transaction.update(circleRef, {
                    members: firestore.FieldValue.arrayRemove(user.id)
                  });
                  
                  // 管理者からも削除
                  if (circleData.admins && circleData.admins.includes(user.id)) {
                    transaction.update(circleRef, {
                      admins: firestore.FieldValue.arrayRemove(user.id)
                    });
                  }
                  
                  // ユーザーのサークルリストからも削除
                  const userRef = firestore().collection('users').doc(user.id);
                  transaction.update(userRef, {
                    circles: firestore.FieldValue.arrayRemove(circleId)
                  });
                });
                
                console.log('Successfully removed blocked user from circle members');
              } catch (removeError) {
                console.error('Error removing blocked user from circle:', removeError);
              }
            }
          }
        }
      } catch (blockError) {
        console.error('ブロック関係チェックエラー:', blockError);
      }

      // サークル情報更新
      setCircle(circleData);
      
      // ユーザーのロールを正確に取得（サークルデータから直接）
      // メンバー配列にユーザーIDが含まれているかをチェック
      if (user.id) {
        const isCreator = circleData.createdBy === user.id;
        const isAdmin = circleData.admins && circleData.admins.includes(user.id);
        const isMember = circleData.members && circleData.members.includes(user.id);
        const isPendingMember = circleData.pendingMembers && circleData.pendingMembers.includes(user.id);
        
        if (isCreator) {
          setUserRole('owner');
        } else if (isAdmin) {
          setUserRole('admin');
        } else if (isMember) {
          setUserRole('member');
        } else {
          setUserRole('none');
        }
        
        setJoinRequestSent(isPendingMember === true);
        
        console.log('ユーザーロール確認:', { 
          isCreator, 
          isAdmin, 
          isMember, 
          isPendingMember, 
          role: isCreator ? 'owner' : isAdmin ? 'admin' : isMember ? 'member' : 'none' 
        });
      }

      // メンバー情報を取得（従来のメソッドに戻す）
      try {
        const memberList: any[] = [];
        
        // サークルのメンバーリストがある場合
        if (circleData.members && circleData.members.length > 0) {
          const memberPromises = circleData.members.slice(0, 10).map(async (memberId) => {
            try {
              const memberDoc = await firestore().collection('users').doc(memberId).get();
              if (memberDoc.exists) {
                const userData = memberDoc.data();
                return { 
                  id: memberId,
                  nickname: userData?.nickname || '不明なユーザー',
                  profilePhoto: userData?.profilePhoto || DEFAULT_PROFILE_IMAGE
                };
              }
              return null;
            } catch (err) {
              console.error(`メンバー情報取得エラー: ${memberId}`, err);
              return null;
            }
          });
          
          const memberResults = await Promise.all(memberPromises);
          const validMembers = memberResults.filter(m => m !== null);
          memberList.push(...validMembers);
        }
        
        setMembers(memberList);
        console.log(`取得したメンバー数: ${memberList.length}`);
      } catch (memberError) {
        console.error('メンバーリスト取得エラー:', memberError);
      }
      
      // イベント情報を取得
      fetchEvents(circleId);
      
    } catch (error) {
      console.error('サークル詳細取得エラー:', error);
      setHasError(true);
      setErrorMessage('サークル情報の取得に失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [circleId, user, fetchEvents]);
  
  // 初回のみ実行する効率的なデータ取得
  useEffect(() => {
    let isMounted = true;
    let hasLoaded = false;
    
    const loadInitialData = async () => {
      if (hasLoaded || !isMounted || !user?.id) return;
      
      hasLoaded = true;
      await fetchCircleDetails();
    };
    
    if (user?.id && circleId) {
      loadInitialData();
    }
    
    return () => {
      isMounted = false;
    };
  }, [fetchCircleDetails, circleId, user]);

  useEffect(() => {
    // 管理者またはオーナーで、非公開サークルの場合のみ実行
    if ((userRole === 'admin' || userRole === 'owner') && circle?.isPrivate && circle?.pendingMembers) {
      setPendingRequestCount(circle.pendingMembers.length);
    } else {
      setPendingRequestCount(0);
    }
  }, [circle, userRole]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCircleDetails().catch(error => {
      console.error('Error in onRefresh:', error);
      setRefreshing(false);
      Alert.alert('エラー', '更新中にエラーが発生しました');
    });
  }, [fetchCircleDetails]);
  
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    
    const refresh = async () => {
      try {
        await fetchCircleDetails();
      } catch (error) {
        console.error('Error during refresh:', error);
        Alert.alert('エラー', '更新中にエラーが発生しました');
      } finally {
        setRefreshing(false);
      }
    };
    
    refresh();
  }, [fetchCircleDetails]);
  
  const handleJoinRequest = async () => {
    if (!user || !circleId) {
      Alert.alert('エラー', 'この機能を利用するにはログインが必要です');
      return;
    }
    
    try {
      setLoading(true);
      
      const circleRef = firestore().collection('circles').doc(circleId);
      
      // サークル情報を取得して確認
      const circleDoc = await circleRef.get();
      if (!circleDoc.exists) {
        Alert.alert('エラー', 'サークルが見つかりませんでした');
        return;
      }
      
      const circleData = circleDoc.data() || {};
      
      // すでにメンバーまたは申請中かチェック
      if (circleData.members && Array.isArray(circleData.members) && circleData.members.includes(user.id)) {
        Alert.alert('エラー', 'すでにこのサークルのメンバーです');
        return;
      }
      
      if (circleData.pendingMembers && Array.isArray(circleData.pendingMembers) && circleData.pendingMembers.includes(user.id)) {
        Alert.alert('エラー', 'すでに参加リクエストを送信済みです');
        return;
      }
      
      // 公開・非公開の設定に基づいて処理分岐
      if (circleData.isPrivate) {
        // 非公開サークルの場合：承認制（pendingMembersに追加）
        await circleRef.update({
          pendingMembers: firestore.FieldValue.arrayUnion(user.id)
        });
        
        // サークル管理者に通知を送信
        await createCircleJoinRequestNotification(circleId, user.id);
        
        setJoinRequestSent(true);
        Alert.alert('リクエスト送信完了', 'サークル参加リクエストを送信しました。管理者の承認をお待ちください。');
      } else {
        // 公開サークルの場合：直接参加（membersに追加）
        const batch = firestore().batch();
        
        // サークルのメンバーリストにユーザーを追加
        batch.update(circleRef, {
          members: firestore.FieldValue.arrayUnion(user.id)
        });
        
        // ユーザーのサークルリストにこのサークルを追加
        const userRef = firestore().collection('users').doc(user.id);
        batch.update(userRef, {
          circles: firestore.FieldValue.arrayUnion(circleId)
        });
        
        await batch.commit();
        
        // ユーザーの役割を更新
        setUserRole('member');
        Alert.alert('参加完了', 'サークルに参加しました！');
      }
      
      // 再読み込み
      fetchCircleDetails();
      
    } catch (error) {
      console.error('Error handling circle join:', error);
      Alert.alert('エラー', 'サークル参加処理に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLeaveCircle = () => {
    Alert.alert(
      'サークルを退会',
      'このサークルから退会しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '退会する', 
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user || !circle || !circleId) return;
              
              // サークル作成者で最後の管理者の場合は削除確認
              const adminsCount = circle?.admins?.length || 0;
              if (userRole === 'owner' && adminsCount <= 1) {
                Alert.alert(
                  'サークルを削除',
                  'あなたはこのサークルの唯一の管理者です。退会するとサークルは削除されます。よろしいですか？',
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    {
                      text: '削除する',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          if (!circleId || !user?.id) return;
                          
                          // サークルの削除
                          await firestore().collection('circles').doc(circleId).delete();
                          
                          // メンバー全員のプロフィールからサークルIDを削除
                          if (circle && circle.members && circle.members.length > 0) {
                            const batch = firestore().batch();
                            
                            for (const memberId of circle.members) {
                              if (!memberId) continue;
                              
                              const userRef = firestore().collection('users').doc(memberId);
                              const userDoc = await userRef.get();
                              
                              if (userDoc.exists) {
                                const userData = userDoc.data();
                                const userCircles = userData?.circles || [];
                                const updatedCircles = userCircles.filter((id: string) => id !== circleId);
                                
                                batch.update(userRef, { circles: updatedCircles });
                              }
                            }
                            
                            await batch.commit();
                          }
                          
                          Alert.alert('削除完了', 'サークルを削除しました');
                          navigation.goBack();
                        } catch (error) {
                          console.error('Error deleting circle:', error);
                          Alert.alert('エラー', 'サークル削除に失敗しました: ' + (error instanceof Error ? error.message : String(error)));
                        }
                      }
                    }
                  ]
                );
                return;
              } 
              // サークル作成者で他の管理者がいる場合は権限委譲の確認
              else if (userRole === 'owner' && adminsCount > 1) {
                Alert.alert(
                  '権限委譲',
                  'サークル作成者が退会するには、別の管理者に権限を委譲する必要があります。管理者リストから新しい作成者を選んでください。',
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    {
                      text: '管理者リストへ',
                      onPress: () => {
                        if (!circleId) return;
                        navigation.navigate('CircleMembers', { 
                          circleId
                        });
                      }
                    }
                  ]
                );
                return;
              }
              else {
                // 他にも管理者がいる場合は普通に退会
                leaveCircle();
              }
              
            } catch (error) {
              console.error('Error leaving circle:', error);
              Alert.alert('エラー', 'サークル退会に失敗しました: ' + (error instanceof Error ? error.message : String(error)));
            }
          }
        }
      ]
    );
  };
  
  // 退会処理を共通化
  const leaveCircle = async () => {
    try {
      if (!user || !user.id || !circleId) {
        Alert.alert('エラー', 'ユーザー情報またはサークル情報が不足しています');
        return;
      }
      
      console.log('サークル退会処理を開始:', { 
        circleId, 
        userId: user.id, 
        userRole 
      });
      
      // トランザクションを使用して整合性を保つ
      await firestore().runTransaction(async (transaction) => {
        // サークルドキュメントの参照
        const circleDocRef = firestore().collection('circles').doc(circleId);
        const circleDocument = await transaction.get(circleDocRef);
        
        if (!circleDocument.exists) {
          throw new Error('サークルが見つかりません');
        }
        
        // ユーザードキュメントの参照
        const userDocRef = firestore().collection('users').doc(user.id);
        const userDocument = await transaction.get(userDocRef);
        
        if (!userDocument.exists) {
          throw new Error('ユーザーが見つかりません');
        }
        
        // サークルからユーザーを削除
        const circleData = circleDocument.data() || {};
        const members = Array.isArray(circleData.members) ? circleData.members : [];
        const admins = Array.isArray(circleData.admins) ? circleData.admins : [];
        
        const updatedMembers = members.filter((id: string) => id !== user.id);
        const updatedAdmins = admins.filter((id: string) => id !== user.id);
        
        console.log('サークルデータ更新:', {
          現在のメンバー: members,
          更新後のメンバー: updatedMembers,
          現在の管理者: admins,
          更新後の管理者: updatedAdmins
        });
        
        transaction.update(circleDocRef, {
          members: updatedMembers,
          admins: updatedAdmins
        });
        
        // ユーザープロフィールのサークル情報を更新
        const userData = userDocument.data() || {};
        const userCircles = Array.isArray(userData.circles) ? userData.circles : [];
        const updatedUserCircles = userCircles.filter((id: string) => id !== circleId);
        
        console.log('ユーザーデータ更新:', {
          現在のサークル: userCircles,
          更新後のサークル: updatedUserCircles
        });
        
        transaction.update(userDocRef, {
          circles: updatedUserCircles
        });
      });
      
      console.log('サークル退会処理成功');
      setUserRole('none');
      Alert.alert('退会完了', 'サークルから退会しました');
      
      // 前の画面に戻る
      navigation.goBack();
      
    } catch (error) {
      console.error('Error leaving circle:', error);
      
      // エラー詳細をログに出力
      if (error instanceof Error) {
        console.error('エラー詳細:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      
      // ユーザーフレンドリーなエラーメッセージ
      let errorMessage = 'サークル退会に失敗しました';
      
      if (error instanceof Error) {
        if (error.message.includes('permission-denied')) {
          errorMessage = '権限がありません。この操作を実行するための適切な権限がないようです。';
        } else {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
      }
      
      Alert.alert('エラー', errorMessage);
    }
  };
  
  const navigateToEditCircle = () => {
    navigation.navigate('EditCircle', { circleId });
  };
  
  const navigateToBulletinBoard = () => {
    navigation.navigate('CircleBoard', { circleId, circleName: circle?.name || '' });
  };
  
  const navigateToCircleMembers = () => {
    navigation.navigate('CircleMembers', { circleId });
  };
  
  const navigateToCircleMembersWithPendingTab = () => {
    navigation.navigate('CircleMembers', { circleId, initialTab: 'pending' });
  };
  
  const renderTabContent = useCallback(() => {
    if (activeTab === 'board') {
      // 掲示板タブの場合
      if (userRole === 'none') {
    return (
          <View style={styles.emptyContainer}>
            <Icon name={circle?.isPrivate ? "lock-closed" : "people"} size={48} color={theme.colors.text.secondary} />
            <Text style={styles.emptyText}>このサークルの掲示板はメンバー専用です</Text>
            <Text style={styles.emptySubText}>サークルに参加するとコンテンツを閲覧できます</Text>
            {!joinRequestSent && (
              <TouchableOpacity 
                style={styles.joinCircleButton}
                onPress={handleJoinRequest}
              >
                <Text style={styles.joinCircleButtonText}>
                  {circle?.isPrivate ? '参加リクエストを送信' : 'サークルに参加する'}
                </Text>
              </TouchableOpacity>
            )}
      </View>
    );
  }
  
    return (
        <CircleBoardContent 
          circleId={circleId} 
          circleName={circle?.name || 'サークル掲示板'} 
        />
      );
    }
    
    // 詳細タブの場合は既存のコードを使用
    if (!circle) return null;
    
    return (
      <>
        {/* サークル紹介 */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>サークル紹介</Text>
        <Text style={styles.descriptionText}>{circle.description}</Text>
      </View>
      
        {/* サークルルール */}
      {circle.rules && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>サークルルール</Text>
          <Text style={styles.rulesText}>{circle.rules}</Text>
        </View>
      )}
      
      {/* メンバー */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>メンバー</Text>
            <TouchableOpacity
              onPress={navigateToCircleMembers}
              style={styles.viewAllButton}
            >
            <Text style={styles.viewAllText}>すべて表示</Text>
              <Icon name="chevron-forward" size={16} color={'#4560db'} />
          </TouchableOpacity>
        </View>
        
          {/* 承認待ちメンバーがいる場合の通知バナー */}
          {pendingRequestCount > 0 && (userRole === 'admin' || userRole === 'owner') && (
          <TouchableOpacity 
              style={styles.pendingRequestsBanner}
              onPress={navigateToCircleMembersWithPendingTab}
            >
              <View style={styles.pendingRequestsBadge}>
                <Text style={styles.pendingRequestsBadgeText}>{pendingRequestCount}</Text>
              </View>
              <Icon name="people" size={18} color="#4560db" style={{marginRight: 8}} />
              <Text style={styles.pendingRequestsText}>
                {pendingRequestCount}件の参加リクエストが承認待ちです
            </Text>
              <Icon name="chevron-forward" size={16} color="#4560db" />
          </TouchableOpacity>
        )}
        
          {members && members.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.membersRow}
            >
              {members.map((member, index) => (
                <TouchableOpacity 
                  key={`member-${member.id}-${index}`}
                  style={styles.memberItem}
                  onPress={() => navigation.navigate('UserProfile', { userId: member.id })}
                >
              <Image
                source={{ uri: member.profilePhoto || DEFAULT_PROFILE_IMAGE }}
                style={styles.memberPhoto}
              />
              <Text style={styles.memberName} numberOfLines={1}>{member.nickname}</Text>
                  {circle && circle.createdBy === member.id && (
                <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>管理者</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
          ) : (
            <Text style={styles.emptyText}>メンバーがいません</Text>
          )}
      </View>
      
      {/* イベント */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>イベント</Text>
              {(userRole === 'admin' || userRole === 'owner' || userRole === 'member') && (
              <TouchableOpacity
                style={styles.createEventButton}
                  onPress={() => navigation.navigate('CreateEvent', { circleId })}
              >
                  <Icon name="add-circle-outline" size={20} color={'#4560db'} />
                <Text style={styles.createEventText}>作成</Text>
              </TouchableOpacity>
            )}
        </View>
        
            {/* イベントリスト */}
            {events.length > 0 ? (
          <View style={styles.eventsContainer}>
                {events.slice(0, 3).map((event) => (
                <TouchableOpacity
                    key={event.id}
                  style={styles.eventCard}
                    onPress={() => navigation.navigate('EventDetails', { eventId: event.id })}
                >
                  <Image
                    source={{ uri: event.coverPhoto || DEFAULT_COVER_IMAGE }}
                    style={styles.eventImage}
                  />
                  <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                    <View style={styles.eventMeta}>
                      <View style={styles.eventMetaItem}>
                          <Icon name="calendar-outline" size={14} color={theme.colors.text.secondary} />
                        <Text style={styles.eventMetaText}>
                          {new Date(event.startDate?.toDate ? event.startDate.toDate() : event.startDate).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.eventMetaItem}>
                          <Icon name="people-outline" size={14} color={theme.colors.text.secondary} />
                          <Text style={styles.eventMetaText}>{event.attendees ? event.attendees.length : 0}人</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.noEventsContainer}>
                <View style={styles.calendarIconContainer}>
                  <Icon name="calendar-outline" size={48} color={theme.colors.text.secondary} />
              </View>
                
                <Text style={styles.noEventsText}>イベントはまだありません</Text>
                
                {(userRole === 'admin' || userRole === 'owner' || userRole === 'member') && (
                  <TouchableOpacity
                    style={styles.createEventButtonLarge}
                    onPress={() => navigation.navigate('CreateEvent', { circleId })}
                  >
                    <Text style={styles.createEventButtonText}>イベントを作成する</Text>
                  </TouchableOpacity>
            )}
          </View>
            )}
          </View>
        </>
    );
  }, [activeTab, userRole, circle, circleId, members, events, handleJoinRequest, joinRequestSent, navigateToCircleMembers, navigation, onRefresh]);

  useEffect(() => {
    // サークルのメタデータが取得できたら、ヘッダータイトルを設定
    if (circle) {
      // ヘッダータイトルを設定
      navigation.setOptions({
        title: circle.name,
        headerRight: () => (
          userRole === 'owner' || userRole === 'admin' ? (
            <View style={{ flexDirection: 'row' }}>
              {/* 非公開サークルの鍵マーク */}
              {circle.isPrivate && (
                <View style={{ marginRight: 8, justifyContent: 'center' }}>
                  <Icon name="lock-closed" size={18} color={theme.colors.primary} />
                </View>
              )}
              
              {/* サークル管理者用のメニュー */}
              <TouchableOpacity
                style={{ paddingHorizontal: 10 }}
                onPress={() => {
                  Alert.alert(
                    'サークル管理',
                    '操作を選択してください',
                    [
                      { text: 'キャンセル', style: 'cancel' },
                      {
                        text: '編集',
                        onPress: () => navigation.navigate('EditCircle', { circleId }),
                      },
                      {
                        text: '削除',
                        style: 'destructive',
                        onPress: () => {
                          Alert.alert(
                            'サークルを削除',
                            'このサークルを完全に削除しますか？この操作は取り消せません。',
                            [
                              { text: 'キャンセル', style: 'cancel' },
                              {
                                text: '削除',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    // サークル削除処理
                                    await firestore().collection('circles').doc(circleId).delete();
                                    Alert.alert('成功', 'サークルが削除されました');
                                    navigation.goBack();
                                  } catch (error) {
                                    console.error('Error deleting circle:', error);
                                    Alert.alert('エラー', 'サークルの削除に失敗しました');
                                  }
                                },
                              },
                            ]
                          );
                        },
                      },
                    ]
                  );
                }}
              >
                <Icon name="ellipsis-vertical" size={22} color={theme.colors.text.primary} />
              </TouchableOpacity>
          </View>
        ) : (
            // 非管理者向けの表示（非公開サークルなら鍵マークだけ表示）
            circle.isPrivate ? (
              <View style={{ marginRight: 15, justifyContent: 'center' }}>
                <Icon name="lock-closed" size={18} color={theme.colors.primary} />
              </View>
            ) : null
          )
        ),
      });
    }
  }, [navigation, circle, userRole, circleId]);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      ) : hasError ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color={theme.colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity
            style={styles.retryButton}
            onPress={onRefresh}
          >
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ヘッダー部分とプロフィールセクションを修正 */}
          <View style={styles.header}>
            {/* カバー画像 */}
                  <Image
              source={{ 
                uri: circle?.coverPhoto || 
                     (circle as any)?.coverUrl || 
                     DEFAULT_COVER_IMAGE 
              }}
              style={styles.coverImage}
            />
            
            {/* サークルアイコンとメンバーボタンを横に並べてコンパクトに */}
            <View style={styles.headerContent}>
              <View style={styles.headerRow}>
                <Image
                  source={{ 
                    uri: circle?.icon || 
                         (circle as any)?.iconUrl || 
                         DEFAULT_PROFILE_IMAGE 
                  }}
                  style={styles.circleIcon}
                />
                
                <View style={styles.headerInfo}>
                  <Text style={styles.circleName}>{circle?.name}</Text>
                  
                  {/* アクションボタンを名前の横に配置 */}
                  <View style={styles.actionButtonsContainer}>
                    {userRole === 'none' && !joinRequestSent && (
                      <TouchableOpacity
                        style={styles.joinButton}
                        onPress={handleJoinRequest}
                        disabled={loading || refreshing}
                      >
                        <Text style={styles.joinButtonText}>参加する</Text>
                      </TouchableOpacity>
                    )}
                    
                    {userRole === 'none' && joinRequestSent && (
                      <View style={[styles.joinButton, styles.pendingButton]}>
                        <Text style={styles.pendingButtonText}>申請中</Text>
                      </View>
                    )}
                    
                    {(userRole === 'member' || userRole === 'admin' || userRole === 'owner') && (
                      <TouchableOpacity
                        style={styles.memberButton}
                        onPress={() => 
                          pendingRequestCount > 0 && (userRole === 'admin' || userRole === 'owner') 
                            ? navigateToCircleMembersWithPendingTab() 
                            : navigateToCircleMembers()
                        }
                      >
                        <Text style={styles.memberButtonText}>メンバー</Text>
                        {pendingRequestCount > 0 && (userRole === 'admin' || userRole === 'owner') && (
                          <View style={styles.memberButtonBadge}>
                            <Text style={styles.memberButtonBadgeText}>{pendingRequestCount}</Text>
                      </View>
                        )}
                </TouchableOpacity>
                    )}
                    
                    {(userRole === 'admin' || userRole === 'owner') && (
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={navigateToEditCircle}
                      >
                        <Text style={styles.editButtonText}>編集</Text>
                      </TouchableOpacity>
                    )}
                    
                {(userRole === 'member' || userRole === 'admin' || userRole === 'owner') && (
                  <TouchableOpacity
                        style={styles.leaveButton}
                        onPress={handleLeaveCircle}
                  >
                        <Text style={styles.leaveButtonText}>退会</Text>
                  </TouchableOpacity>
                )}
              </View>
                </View>
              </View>
            </View>
          </View>
          
          {/* タブバーをすぐ下に配置 */}
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
              {pendingRequestCount > 0 && (userRole === 'admin' || userRole === 'owner') && activeTab !== 'details' && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingRequestCount}</Text>
          </View>
        )}
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
          
          {/* タブの内容を表示 - どちらのタブでもフルスクリーンで表示 */}
          {activeTab === 'details' ? (
            <ScrollView
              contentContainerStyle={{
                paddingBottom: 70,
                // flex: 1を削除してコンテンツの高さに合わせてスクロール可能に
              }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              showsVerticalScrollIndicator={true}
              bounces={true}
              style={{flex: 1, width: '100%'}}
            >
              {renderTabContent()}
    </ScrollView>
          ) : (
            // 掲示板タブをフレックスで表示してスクロール可能に
            <View style={styles.boardContainer}>
              {renderTabContent()}
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    paddingBottom: 70,
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  errorText: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  header: {
    backgroundColor: theme.colors.background,
  },
  coverImage: {
    width: '100%',
    height: 120, // カバー画像の高さを少し小さく
    resizeMode: 'cover',
  },
  headerContent: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: -30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleIcon: {
    width: 60, // アイコンを小さく
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#f0f0f0',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  circleName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  joinButton: {
    backgroundColor: '#4560db',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginRight: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  memberButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  editButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginRight: 8,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  leaveButton: {
    backgroundColor: '#f44336',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  leaveButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pendingButton: {
    backgroundColor: theme.colors.secondary,
  },
  pendingButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#333',
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
    fontSize: 12,
    color: '#4560db',
    fontFamily: theme.typography.fontFamily.medium,
    marginRight: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  rulesText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  membersRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  memberItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  memberPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    width: 70,
  },
  adminBadge: {
    backgroundColor: 'rgba(90, 120, 255, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    color: '#4560db',
    fontFamily: theme.typography.fontFamily.medium,
  },
  eventHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  createEventText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginLeft: 2,
  },
  eventsContainer: {
    marginTop: 8,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  eventImage: {
    width: 80,
    height: 80,
    resizeMode: 'cover',
  },
  eventInfo: {
    flex: 1,
    padding: theme.spacing.sm,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#333',
    marginBottom: theme.spacing.xs,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  eventMetaText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  noEventsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  noEventsText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  createEventButtonLarge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    alignSelf: 'center',
  },
  createEventButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  eventSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  eventSearchInput: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  viewAllEventsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  viewAllEventsText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  pendingMembersNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.primary + '10',
  },
  pendingMembersText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.medium,
    flex: 1,
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
    fontFamily: theme.typography.fontFamily.medium,
    color: '#888',
  },
  activeTabButton: {
    backgroundColor: '#4560db',
    borderRadius: 20,
  },
  activeTabButtonText: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.bold,
  },
  disabledTabButtonText: {
    color: theme.colors.text.disabled,
  },
  emptyContainer: {
    margin: 12,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 12, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 10,
  },
  searchContainer: {
    padding: theme.spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    color: theme.colors.text.primary,
  },
  clearButton: {
    padding: theme.spacing.xs,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  eventsList: {
    padding: theme.spacing.md,
  },
  circleInfoHeader: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  circleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  circleSeparator: {
    width: 1,
    height: '100%',
    backgroundColor: theme.colors.border,
  },
  circleStatText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    marginLeft: theme.spacing.sm,
  },
  boardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginTop: theme.spacing.sm,
  },
  boardLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  boardLinkText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginLeft: theme.spacing.sm,
  },
  calendarIconContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  refreshButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginTop: 16,
    shadowColor: '#4560db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
  },
  boardContainer: {
    flex: 1,
    backgroundColor: '#f6f6f9',
  },
  emptySubText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  joinCircleButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 10,
  },
  joinCircleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
  },
  pendingRequestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(69, 96, 219, 0.08)',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 15,
  },
  pendingRequestsBadge: {
    backgroundColor: '#4560db',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 5,
  },
  pendingRequestsBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pendingRequestsText: {
    flex: 1,
    fontSize: 14,
    color: '#4560db',
    fontWeight: '500',
  },
  memberButtonBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  memberButtonBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabBadge: {
    position: 'absolute',
    top: -3,
    right: -8,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default CircleDetailsScreen;