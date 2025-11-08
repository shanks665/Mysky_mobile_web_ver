import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../styles/theme';
import { MessagesStackParamList } from '../../navigation/types';
import { Swipeable } from 'react-native-gesture-handler';

// デフォルトのユーザーアイコン
const DEFAULT_USER_ICON = 'https://via.placeholder.com/50?text=User';

// メッセージの種類
type MessageType = 'text' | 'image' | 'system';

// メッセージデータの型
interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: MessageType;
  createdAt: any;
  read: boolean;
}

// チャットルームの型
interface ChatRoom {
  id: string;
  participantIds: string[];
  lastMessage: {
    content: string;
    senderId: string;
    timestamp: any;
  };
  unreadCount: number;
  updatedAt: any;
}

// ユーザー情報の型
interface UserInfo {
  id: string;
  nickname: string;
  profilePhoto: string;
}

const MessagesScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<StackNavigationProp<MessagesStackParamList, 'Messages'>>();
  
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // スワイプアクションオープン中のアイテム参照を保持
  const [openSwipeableRef, setOpenSwipeableRef] = useState<Swipeable | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  
  useEffect(() => {
    if (!user) return;
    
    // チャットルームを取得
    const unsubscribe = firestore()
      .collection('chatRooms')
      .where('participantIds', 'array-contains', user.id)
      .orderBy('updatedAt', 'desc')
      .onSnapshot(
        snapshot => {
          const rooms: ChatRoom[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            
            // 非表示設定の確認 - hidden フィールドがあり、かつ current userId が true に設定されていたら表示しない
            if (data.hidden && data.hidden[user.id] === true) {
              return; // このチャットルームはスキップ
            }
            
            rooms.push({
              id: doc.id,
              participantIds: data.participantIds,
              lastMessage: data.lastMessage || {
                content: '',
                senderId: '',
                timestamp: null,
              },
              unreadCount: data.unreadCount?.[user.id] || 0,
              updatedAt: data.updatedAt,
            });
          });
          
          setChatRooms(rooms);
          
          // ユーザー情報を取得
          const userIds = new Set<string>();
          rooms.forEach(room => {
            room.participantIds.forEach(id => {
              if (id !== user.id) {
                userIds.add(id);
              }
            });
          });
          
          fetchUserInfo(Array.from(userIds));
        },
        error => {
          console.error('Error fetching chat rooms:', error);
          setLoading(false);
        }
      );
    
    return () => unsubscribe();
  }, [user]);
  
  const fetchUserInfo = async (userIds: string[]) => {
    try {
      const userMap: Record<string, UserInfo> = {};
      
      const promises = userIds.map(id => 
        firestore().collection('users').doc(id).get()
      );
      
      const snapshots = await Promise.all(promises);
      
      snapshots.forEach(doc => {
        if (doc.exists) {
          const data = doc.data();
          userMap[doc.id] = {
            id: doc.id,
            nickname: data?.nickname || 'Unknown User',
            profilePhoto: data?.profilePhoto || DEFAULT_USER_ICON,
          };
        }
      });
      
      setUsers(userMap);
    } catch (error) {
      console.error('Error fetching user info:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getOtherUserId = (room: ChatRoom) => {
    return room.participantIds.find(id => id !== user?.id) || '';
  };
  
  const getOtherUserInfo = (room: ChatRoom) => {
    const otherUserId = getOtherUserId(room);
    return users[otherUserId] || { 
      id: otherUserId, 
      nickname: 'Unknown User', 
      profilePhoto: DEFAULT_USER_ICON 
    };
  };
  
  const handleOpenChat = async (room: ChatRoom) => {
    const otherUser = getOtherUserInfo(room);
    
    if (user) {
      try {
        // チャットルームドキュメントを取得して現在のデータを確認
        const roomDoc = await firestore().collection('chatRooms').doc(room.id).get();
        
        if (roomDoc.exists) {
          const roomData = roomDoc.data();
          
          // hiddenフィールドがあれば確認してリセット
          if (roomData?.hidden) {
            const hiddenField = {...roomData.hidden};
            let needsUpdate = false;
            
            // 自分のhidden状態をリセット
            if (hiddenField[user.id]) {
              delete hiddenField[user.id];
              needsUpdate = true;
            }
            
            // 更新が必要な場合のみFirestoreを更新
            if (needsUpdate) {
              await firestore().collection('chatRooms').doc(room.id).update({
                hidden: hiddenField,
                updatedAt: firestore.FieldValue.serverTimestamp()
              });
              console.log('チャットルームの表示状態をリセットしました:', room.id);
            }
          }
        }
      } catch (error) {
        console.error('Error checking room hidden status:', error);
      }
    }
    
    // チャットルーム画面に遷移
    navigation.navigate('ChatRoom', { 
      roomId: room.id,
      otherUserId: otherUser.id,
      otherUserName: otherUser.nickname,
    });
  };
  
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      // 今日の場合は時間を表示
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      // 別の日の場合は日付を表示
      return date.toLocaleDateString();
    }
  };
  
  // トークを削除する関数
  const handleDeleteChat = (roomId: string, otherUserName: string) => {
    Alert.alert(
      'トークを削除',
      `${otherUserName}とのトークを削除しますか？\n※メッセージ履歴は残りますが、このリストから削除されます。`,
      [
        {
          text: 'キャンセル',
          style: 'cancel'
        },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              
              // チャットルームドキュメントを取得
              const roomDoc = await firestore().collection('chatRooms').doc(roomId).get();
              
              if (!roomDoc.exists) {
                throw new Error('チャットルームが見つかりません');
              }
              
              // 現在のhiddenフィールドを取得
              const roomData = roomDoc.data();
              const hiddenField = roomData?.hidden || {};
              
              // hiddenフィールドを更新
              hiddenField[user.id] = true;
              
              // ユーザーごとの表示設定を更新
              await firestore().collection('chatRooms').doc(roomId).update({
                hidden: hiddenField,
                updatedAt: firestore.FieldValue.serverTimestamp()
              });
              
              // ローカルの状態も更新（すでにリスナーでフィルタリングされますが、UI即時反映のため）
              setChatRooms(prevRooms => prevRooms.filter(room => room.id !== roomId));
              
              console.log('トークを削除しました:', roomId);
            } catch (error) {
              console.error('Error deleting chat:', error);
              Alert.alert('エラー', 'トークの削除に失敗しました');
            }
          }
        }
      ]
    );
  };

  // スワイプアクションを閉じる
  const closeOpenSwipeable = () => {
    if (openSwipeableRef) {
      openSwipeableRef.close();
      setOpenSwipeableRef(null);
      setActiveRoomId(null);
    }
  };

  const renderChatRoomItem = ({ item }: { item: ChatRoom }) => {
    const otherUser = getOtherUserInfo(item);
    
    // 検索フィルタリング
    if (
      searchQuery &&
      !otherUser.nickname.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return null;
    }
    
    // 右側のスワイプアクション（トーク削除）
    const renderRightActions = () => {
      return (
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => handleDeleteChat(item.id, otherUser.nickname)}
        >
          <Icon name="trash-outline" size={24} color="#fff" />
          <Text style={styles.deleteActionText}>削除</Text>
        </TouchableOpacity>
      );
    };
    
    return (
      <Swipeable
        renderRightActions={renderRightActions}
        onSwipeableOpen={(direction) => {
          // 他のスワイプアクションが開いていたら閉じる
          if (activeRoomId && activeRoomId !== item.id) {
            closeOpenSwipeable();
          }
          // 現在のスワイプアブルの参照を保存
          setActiveRoomId(item.id);
        }}
        onSwipeableClose={() => {
          if (activeRoomId === item.id) {
            setActiveRoomId(null);
          }
        }}
        ref={(ref) => {
          if (activeRoomId === item.id) {
            setOpenSwipeableRef(ref);
          }
        }}
      >
        <TouchableOpacity
          style={styles.chatRoomItem}
          onPress={() => {
            closeOpenSwipeable();
            handleOpenChat(item);
          }}
        >
          <Image
            source={{ uri: otherUser.profilePhoto }}
            style={styles.avatar}
          />
          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={styles.userName} numberOfLines={1}>
                {otherUser.nickname}
              </Text>
              <Text style={styles.timeText}>
                {item.updatedAt ? formatTimestamp(item.updatedAt) : ''}
              </Text>
            </View>
            <View style={styles.chatPreview}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage?.content || 'メッセージがありません'}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };
  
  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.emptyText}>読み込み中...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="chatbubble-ellipses-outline" size={60} color={theme.colors.text.secondary} />
        <Text style={styles.emptyTitle}>メッセージはありません</Text>
        <Text style={styles.emptyText}>
          他のユーザーとのメッセージがここに表示されます
        </Text>
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>メッセージ</Text>
        <TouchableOpacity style={styles.newMessageButton}>
          <Icon name="mail-sharp" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color={theme.colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="ユーザーを検索"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={18} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <FlatList
        data={chatRooms}
        renderItem={renderChatRoomItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={chatRooms.length === 0 ? { flex: 1 } : null}
        onScroll={closeOpenSwipeable}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  newMessageButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: theme.colors.text.primary,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  chatRoomItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  timeText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  chatPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  unreadMessage: {
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  unreadBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  deleteAction: {
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    flexDirection: 'column',
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
});

export default MessagesScreen;
