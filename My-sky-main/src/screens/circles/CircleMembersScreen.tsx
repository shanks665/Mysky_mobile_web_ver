import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import { Circle } from '../../models/Circle';

type CircleMembersRouteProp = RouteProp<DiscoverStackParamList, 'CircleMembers'>;
type CircleMembersNavigationProp = StackNavigationProp<DiscoverStackParamList, 'CircleMembers'>;

interface CircleMembersParams {
  circleId: string;
  initialTab?: 'members' | 'pending';
}

interface Member {
  id: string;
  nickname: string;
  profilePhoto?: string;
  bio?: string;
  role: 'owner' | 'admin' | 'member';
}

interface PendingMember {
  id: string;
  nickname: string;
  profilePhoto?: string;
}

const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';

const CircleMembersScreen: React.FC = () => {
  const { user } = useAuth();
  const route = useRoute<CircleMembersRouteProp>();
  const navigation = useNavigation<CircleMembersNavigationProp>();
  const { circleId, initialTab } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [userRole, setUserRole] = useState<'none' | 'member' | 'admin' | 'owner'>('none');
  const [activeTab, setActiveTab] = useState<'members' | 'pending'>('members');
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  const fetchCircleMembers = useCallback(async () => {
    try {
      setLoading(true);
      
      // サークル情報を取得
      const circleDoc = await firestore().collection('circles').doc(circleId).get();
      
      if (!circleDoc.exists) {
        Alert.alert('エラー', 'サークルが見つかりませんでした');
        navigation.goBack();
        return;
      }
      
      const circleData = { id: circleDoc.id, ...circleDoc.data() } as Circle;
      setCircle(circleData);
      
      // ユーザーの役割を確認
      if (user) {
        if (circleData.createdBy === user.id) {
          setUserRole('owner');
        } else if (circleData.admins.includes(user.id)) {
          setUserRole('admin');
        } else if (circleData.members.includes(user.id)) {
          setUserRole('member');
        }
      }
      
      // メンバー情報を取得
      const memberPromises = circleData.members.map(async (memberId) => {
        const memberDoc = await firestore().collection('users').doc(memberId).get();
        const memberData = memberDoc.data();
        
        if (!memberData) return null;
        
        let role: 'owner' | 'admin' | 'member' = 'member';
        if (memberId === circleData.createdBy) {
          role = 'owner';
        } else if (circleData.admins.includes(memberId)) {
          role = 'admin';
        }
        
        return {
          id: memberId,
          nickname: memberData.nickname || 'ユーザー',
          profilePhoto: memberData.profilePhoto,
          bio: memberData.bio,
          role,
        } as Member;
      });
      
      const membersData = (await Promise.all(memberPromises)).filter(Boolean) as Member[];
      
      // オーナー、管理者、一般メンバーの順に並べ替え
      const sortedMembers = membersData.sort((a, b) => {
        const roleOrder = { owner: 0, admin: 1, member: 2 };
        return roleOrder[a.role] - roleOrder[b.role];
      });
      
      setMembers(sortedMembers);
      
      // 招待中のメンバー情報を取得（管理者権限以上のみ）
      if ((userRole === 'admin' || userRole === 'owner') && circleData.pendingMembers) {
        const pendingPromises = circleData.pendingMembers.map(async (pendingId) => {
          const pendingDoc = await firestore().collection('users').doc(pendingId).get();
          const pendingData = pendingDoc.data();
          
          if (!pendingData) return null;
          
          return {
            id: pendingId,
            nickname: pendingData.nickname || 'ユーザー',
            profilePhoto: pendingData.profilePhoto,
          } as PendingMember;
        });
        
        const pendingData = (await Promise.all(pendingPromises)).filter(Boolean) as PendingMember[];
        setPendingMembers(pendingData);
      }
      
    } catch (error) {
      console.error('Error fetching circle members:', error);
      Alert.alert('エラー', 'メンバー情報の取得に失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [circleId, navigation, user, userRole]);
  
  useEffect(() => {
    fetchCircleMembers();
  }, [fetchCircleMembers]);
  
  // 初期タブの設定
  useEffect(() => {
    if (initialTab && (initialTab === 'pending' || initialTab === 'members')) {
      // 権限チェック - 承認待ちタブは管理者・オーナーのみアクセス可能
      if (initialTab === 'pending' && (userRole === 'admin' || userRole === 'owner')) {
        setActiveTab(initialTab);
      } else if (initialTab === 'members') {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab, userRole]);
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchCircleMembers();
  };
  
  const handleApproveMember = async (memberId: string) => {
    if (!circle || (userRole !== 'admin' && userRole !== 'owner')) return;
    
    try {
      // トランザクションを使用して一貫性のある更新を行う
      await firestore().runTransaction(async (transaction) => {
        // 参照を取得
        const circleRef = firestore().collection('circles').doc(circleId);
        const userRef = firestore().collection('users').doc(memberId);
        
        // 現在のドキュメント状態を取得
        const circleDoc = await transaction.get(circleRef);
        const userDoc = await transaction.get(userRef);
        
        if (!circleDoc.exists) {
          throw new Error('サークルが見つかりませんでした');
        }
        
        // サークルのデータを取得
        const circleData = circleDoc.data() || {};
        const pendingMembers = circleData.pendingMembers || [];
        const members = circleData.members || [];
        
        // ユーザーのデータを取得
        const userData = userDoc.exists ? userDoc.data() || {} : {};
        const userCircles = userData.circles || [];
        
        // すでにメンバーに追加されている場合は何もしない
        if (members.includes(memberId)) {
          return;
        }
        
        // メンバーリストを更新
        transaction.update(circleRef, {
          pendingMembers: pendingMembers.filter((id: string) => id !== memberId),
          members: [...members, memberId],
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        
        // ユーザーのcirclesフィールドを更新
        if (userDoc.exists) {
          transaction.update(userRef, {
            circles: [...userCircles, circleId]
          });
        }
      });
      
      // 状態を更新
      setPendingMembers((prev) => prev.filter((member) => member.id !== memberId));
      
      // 承認されたメンバーの情報を取得して追加
      const memberDoc = await firestore().collection('users').doc(memberId).get();
      const memberData = memberDoc.data();
      
      if (memberData) {
        const newMember: Member = {
          id: memberId,
          nickname: memberData.nickname || 'ユーザー',
          profilePhoto: memberData.profilePhoto,
          bio: memberData.bio,
          role: 'member',
        };
        
        setMembers((prev) => [...prev, newMember].sort((a, b) => {
          const roleOrder = { owner: 0, admin: 1, member: 2 };
          return roleOrder[a.role] - roleOrder[b.role];
        }));
      }
      
      Alert.alert('成功', 'メンバーを承認しました');
      
    } catch (error) {
      console.error('Error approving member:', error);
      Alert.alert('エラー', 'メンバー承認に失敗しました: ' + (error instanceof Error ? error.message : String(error)));
    }
  };
  
  const handleRejectMember = async (memberId: string) => {
    if (!circle || (userRole !== 'admin' && userRole !== 'owner')) return;
    
    try {
      const circleRef = firestore().collection('circles').doc(circleId);
      
      await circleRef.update({
        pendingMembers: firestore.FieldValue.arrayRemove(memberId),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      setPendingMembers((prev) => prev.filter((member) => member.id !== memberId));
      Alert.alert('成功', 'リクエストを拒否しました');
      
    } catch (error) {
      console.error('Error rejecting member:', error);
      Alert.alert('エラー', 'リクエスト拒否に失敗しました');
    }
  };
  
  const handlePromoteToAdmin = async (memberId: string) => {
    if (!circle || userRole !== 'owner') return;
    
    try {
      const circleRef = firestore().collection('circles').doc(circleId);
      
      await circleRef.update({
        admins: firestore.FieldValue.arrayUnion(memberId),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      // 状態を更新
      setMembers((prev) => 
        prev.map((member) => 
          member.id === memberId 
            ? { ...member, role: 'admin' as const } 
            : member
        ).sort((a, b) => {
          const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 };
          return roleOrder[a.role] - roleOrder[b.role];
        })
      );
      
      Alert.alert('成功', '管理者に昇格しました');
      
    } catch (error) {
      console.error('Error promoting to admin:', error);
      Alert.alert('エラー', '管理者昇格に失敗しました');
    }
  };
  
  const handleDemoteFromAdmin = async (memberId: string) => {
    if (!circle || userRole !== 'owner') return;
    
    try {
      const circleRef = firestore().collection('circles').doc(circleId);
      
      await circleRef.update({
        admins: firestore.FieldValue.arrayRemove(memberId),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      // 状態を更新
      setMembers((prev) => 
        prev.map((member) => 
          member.id === memberId 
            ? { ...member, role: 'member' as const } 
            : member
        ).sort((a, b) => {
          const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 };
          return roleOrder[a.role] - roleOrder[b.role];
        })
      );
      
      Alert.alert('成功', 'メンバーに降格しました');
      
    } catch (error) {
      console.error('Error demoting from admin:', error);
      Alert.alert('エラー', 'メンバー降格に失敗しました');
    }
  };
  
  const handleRemoveMember = async (memberId: string) => {
    if (!circle || (userRole !== 'admin' && userRole !== 'owner')) return;
    
    try {
      const circleRef = firestore().collection('circles').doc(circleId);
      const userRef = firestore().collection('users').doc(memberId);
      
      // バッチ処理でサークルとユーザーの両方を更新
      const batch = firestore().batch();
      
      // サークルからメンバーを削除
      batch.update(circleRef, {
        members: firestore.FieldValue.arrayRemove(memberId),
        // 管理者でもある場合は管理者からも削除
        admins: firestore.FieldValue.arrayRemove(memberId),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      // ユーザーのcirclesからこのサークルを削除
      batch.update(userRef, {
        circles: firestore.FieldValue.arrayRemove(circleId)
      });
      
      await batch.commit();
      
      // 状態を更新
      setMembers((prev) => prev.filter((member) => member.id !== memberId));
      
      Alert.alert('成功', 'メンバーを削除しました');
      
    } catch (error) {
      console.error('Error removing member:', error);
      Alert.alert('エラー', 'メンバー削除に失敗しました');
    }
  };
  
  const handleTransferOwnership = async (newOwnerId: string) => {
    if (!circle || userRole !== 'owner') return;
    
    // 自分自身には譲渡できない
    if (newOwnerId === user?.id) {
      Alert.alert('エラー', '自分自身にオーナー権限を譲渡することはできません');
      return;
    }
    
    // 管理者以外には譲渡できない
    const member = members.find((m) => m.id === newOwnerId);
    if (!member || member.role !== 'admin') {
      Alert.alert('エラー', 'オーナー権限は管理者にのみ譲渡できます');
      return;
    }
    
    Alert.alert(
      'オーナー権限の譲渡',
      `${member.nickname}にサークルのオーナー権限を譲渡しますか？\n\nこの操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '譲渡する', 
          style: 'destructive',
          onPress: async () => {
            try {
              const circleRef = firestore().collection('circles').doc(circleId);
              
              // トランザクションで更新
              await firestore().runTransaction(async (transaction) => {
                const circleDoc = await transaction.get(circleRef);
                
                if (!circleDoc.exists) {
                  throw new Error('サークルが見つかりませんでした');
                }
                
                const circleData = circleDoc.data();
                
                if (!circleData) {
                  throw new Error('サークルデータが見つかりませんでした');
                }
                
                // オーナー権限を譲渡
                transaction.update(circleRef, {
                  createdBy: newOwnerId,
                  updatedAt: firestore.FieldValue.serverTimestamp(),
                });
              });
              
              // 状態を更新
              setMembers((prev) => 
                prev.map((member) => {
                  if (member.id === user?.id) {
                    return { ...member, role: 'admin' as const };
                  } else if (member.id === newOwnerId) {
                    return { ...member, role: 'owner' as const };
                  }
                  return member;
                }).sort((a, b) => {
                  const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 };
                  return roleOrder[a.role] - roleOrder[b.role];
                })
              );
              
              // 自分の役割を更新
              setUserRole('admin');
              
              Alert.alert('成功', 'オーナー権限を譲渡しました');
              
            } catch (error) {
              console.error('Error transferring ownership:', error);
              Alert.alert('エラー', 'オーナー権限の譲渡に失敗しました');
            }
          }
        }
      ]
    );
  };
  
  const navigateToUserProfile = (userId: string) => {
    // 自分のプロフィールの場合は自分のプロフィール画面へ
    if (userId === user?.id) {
      navigation.navigate('Profile' as any);
    } else {
      navigation.navigate('UserProfile', { userId });
    }
  };
  
  const renderMemberActions = (member: Member) => {
    if (!user) return null;
    
    // 自分自身には操作できない
    if (member.id === user.id) return null;
    
    // オーナーには操作できない
    if (member.role === 'owner') return null;
    
    return (
      <View style={styles.memberActions}>
        {userRole === 'owner' && (
          <>
            {member.role === 'admin' ? (
              <View style={styles.actionButtonContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDemoteFromAdmin(member.id)}
                >
                  <Icon name="arrow-down" size={16} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.actionButtonLabel}>降格</Text>
              </View>
            ) : (
              <View style={styles.actionButtonContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handlePromoteToAdmin(member.id)}
                >
                  <Icon name="arrow-up" size={16} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.actionButtonLabel}>昇格</Text>
              </View>
            )}
          </>
        )}
        
        {/* 管理者は管理者を削除できない */}
        {(userRole === 'owner' || (userRole === 'admin' && member.role === 'member')) && (
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={() => handleRemoveMember(member.id)}
            >
              <Icon name="close" size={16} color={theme.colors.error} />
            </TouchableOpacity>
            <Text style={styles.actionButtonLabel}>削除</Text>
          </View>
        )}
        
        {userRole === 'owner' && member.role === 'admin' && (
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleTransferOwnership(member.id)}
            >
              <Icon name="swap-horizontal" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.actionButtonLabel}>譲渡</Text>
          </View>
        )}
      </View>
    );
  };
  
  const renderMemberItem = ({ item }: { item: Member }) => (
    <TouchableOpacity
      style={styles.memberItem}
      onPress={() => navigateToUserProfile(item.id)}
    >
      <Image
        source={{ uri: item.profilePhoto || DEFAULT_PROFILE_IMAGE }}
        style={styles.memberPhoto}
      />
      
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.nickname}</Text>
        {item.bio && <Text style={styles.memberBio} numberOfLines={1}>{item.bio}</Text>}
        
        <View style={styles.roleContainer}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {item.role === 'owner' ? 'オーナー' : item.role === 'admin' ? '管理者' : 'メンバー'}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.memberActions}>
        {/* オーナーの場合、右側にヘルプアイコンを表示 */}
        {item.role === 'owner' && (
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowHelpModal(true)}
            >
              <Icon name="help-circle" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.actionButtonLabel}>ヘルプ</Text>
          </View>
        )}
        {renderMemberActions(item)}
      </View>
    </TouchableOpacity>
  );
  
  const renderPendingItem = ({ item }: { item: PendingMember }) => (
    <View style={styles.memberItem}>
      <Image
        source={{ uri: item.profilePhoto || DEFAULT_PROFILE_IMAGE }}
        style={styles.memberPhoto}
      />
      
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.nickname}</Text>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>承認待ち</Text>
        </View>
      </View>
      
      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApproveMember(item.id)}
        >
          <Icon name="checkmark" size={16} color={theme.colors.success} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleRejectMember(item.id)}
        >
          <Icon name="close" size={16} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'members' && styles.activeTabButton,
        ]}
        onPress={() => setActiveTab('members')}
      >
        <Text
          style={[
            styles.tabButtonText,
            activeTab === 'members' && styles.activeTabButtonText,
          ]}
        >
          メンバー ({members.length})
        </Text>
      </TouchableOpacity>
      
      {(userRole === 'admin' || userRole === 'owner') && (
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
            承認待ち ({pendingMembers.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
  
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.emptyText}>読み込み中...</Text>
        </View>
      );
    }
    
    if (activeTab === 'members' && members.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="people-outline" size={48} color={theme.colors.text.secondary} />
          <Text style={styles.emptyText}>メンバーがいません</Text>
        </View>
      );
    }
    
    if (activeTab === 'pending' && pendingMembers.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="time-outline" size={48} color={theme.colors.text.secondary} />
          <Text style={styles.emptyText}>承認待ちのメンバーはいません</Text>
        </View>
      );
    }
    
    return null;
  };
  
  // ヘルプモーダルを表示するコンポーネント
  const renderHelpModal = () => (
    <Modal
      visible={showHelpModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowHelpModal(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowHelpModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalContent} 
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>管理者操作について</Text>
            <TouchableOpacity onPress={() => setShowHelpModal(false)}>
              <Icon name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.helpSection}>
              <Text style={styles.helpSectionTitle}>昇格</Text>
              <Text style={styles.helpText}>
                一般メンバーを「管理者」に昇格させます。管理者は以下の権限を持ちます：
              </Text>
              <View style={styles.helpList}>
                <Text style={styles.helpListItem}>• メンバーの承認・削除</Text>
                <Text style={styles.helpListItem}>• サークルの投稿管理</Text>
                <Text style={styles.helpListItem}>• イベントの作成・編集</Text>
              </View>
            </View>
            
            <View style={styles.helpSection}>
              <Text style={styles.helpSectionTitle}>降格</Text>
              <Text style={styles.helpText}>
                管理者を一般メンバーに降格させます。管理者権限が削除されます。
              </Text>
            </View>
            
            <View style={styles.helpSection}>
              <Text style={styles.helpSectionTitle}>削除</Text>
              <Text style={styles.helpText}>
                メンバーをサークルから削除します。削除されたメンバーは再度参加申請が必要になります。
              </Text>
            </View>
            
            <View style={styles.helpSection}>
              <Text style={styles.helpSectionTitle}>譲渡</Text>
              <Text style={styles.helpText}>
                サークルのオーナー権限を他の管理者に譲渡します。オーナー権限には以下が含まれます：
              </Text>
              <View style={styles.helpList}>
                <Text style={styles.helpListItem}>• サークルの削除権限</Text>
                <Text style={styles.helpListItem}>• 管理者の昇格・降格</Text>
                <Text style={styles.helpListItem}>• オーナー権限の譲渡</Text>
              </View>
              <Text style={styles.helpNote}>
                ※ 権限譲渡後、元のオーナーは管理者になります
              </Text>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {circle ? `${circle.name} のメンバー` : 'メンバー一覧'}
        </Text>
      </View>
      
      {renderTabButtons()}
      
      {activeTab === 'members' ? (
        <FlatList
          data={members}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={members.length === 0 ? { flex: 1 } : null}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        <FlatList
          data={pendingMembers}
          renderItem={renderPendingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={pendingMembers.length === 0 ? { flex: 1 } : null}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
      
      {renderHelpModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.secondary,
  },
  activeTabButtonText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.bold,
  },
  memberItem: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  memberPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: theme.spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  memberBio: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  pendingBadge: {
    backgroundColor: theme.colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  pendingText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.warning,
    fontFamily: theme.typography.fontFamily.medium,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonContainer: {
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
    width: 50,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  removeButton: {
    borderColor: theme.colors.error + '50',
  },
  actionButtonLabel: {
    fontSize: 10,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  pendingActions: {
    flexDirection: 'row',
  },
  approveButton: {
    borderColor: theme.colors.success + '50',
    marginRight: theme.spacing.sm,
  },
  rejectButton: {
    borderColor: theme.colors.error + '50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.md,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    flex: 1,
  },
  modalBody: {
    maxHeight: 400,
  },
  helpSection: {
    marginBottom: theme.spacing.md,
  },
  helpSectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  helpText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  helpList: {
    marginLeft: theme.spacing.md,
  },
  helpListItem: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  helpNote: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  helpIconButton: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
});

export default CircleMembersScreen; 