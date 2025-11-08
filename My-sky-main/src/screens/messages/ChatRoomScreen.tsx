import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../styles/theme';
import { MessagesStackParamList } from '../../navigation/types';
import { UserActionMenu } from '../../components/modals/UserActionMenu';
import { User } from '../../models/User';

// デフォルトのユーザーアイコン
const DEFAULT_USER_ICON = 'https://via.placeholder.com/50?text=User';

// メッセージの型
interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  read: boolean;
  imageUrl?: string; // 画像URL（写真送信機能用）
}

type ChatRoomRouteProp = RouteProp<MessagesStackParamList, 'ChatRoom'>;
type ChatRoomNavigationProp = StackNavigationProp<MessagesStackParamList, 'ChatRoom'>;

// 利用可能なテーマタイプ
type ThemeType = 'default' | 'light' | 'dark' | 'pastel' | 'nature';

const ChatRoomScreen: React.FC = () => {
  const { user } = useAuth();
  const route = useRoute<ChatRoomRouteProp>();
  const navigation = useNavigation<ChatRoomNavigationProp>();
  
  const { roomId, otherUserId, otherUserName } = route.params;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUserPhoto, setOtherUserPhoto] = useState<string>(DEFAULT_USER_ICON);
  const [userPhoto, setUserPhoto] = useState<string>(DEFAULT_USER_ICON);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  // テーマ選択機能用の状態
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('default');
  const [showThemeModal, setShowThemeModal] = useState(false);
  
  // ブロック関連の状態
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  
  // 現在選択されているテーマの色を取得
  const getThemeColors = () => {
    return theme.colors.chatThemes[currentTheme];
  };
  
  useEffect(() => {
    navigation.setOptions({
      title: otherUserName,
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity 
            style={{ marginRight: 15 }} 
            onPress={() => setShowThemeModal(true)}
          >
            <Icon name="color-palette-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ marginRight: 15 }} 
            onPress={() => setShowActionMenu(true)}
          >
            <Icon name="ellipsis-vertical" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
    
    // 相手と自分のプロフィール画像を取得
    const fetchProfilePhotos = async () => {
      try {
        // 相手のプロフィール画像
        const otherUserDoc = await firestore().collection('users').doc(otherUserId).get();
        if (otherUserDoc.exists) {
          const userData = otherUserDoc.data() as User;
          setOtherUser(userData);
          if (userData?.profilePhoto) {
            setOtherUserPhoto(userData.profilePhoto);
          }
          
          // 相手からブロックされているかチェック
          if (userData.blockedUsers && user && userData.blockedUsers.includes(user.id)) {
            // 相手からブロックされている場合
            Alert.alert(
              'アクセス制限',
              'このユーザーとのメッセージのやりとりはできません。',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            return;
          }
        }

        // 自分のプロフィール画像
        if (user) {
          const userDoc = await firestore().collection('users').doc(user.id).get();
          if (userDoc.exists) {
            const userData = userDoc.data() as User;
            if (userData?.profilePhoto) {
              setUserPhoto(userData.profilePhoto);
            }
            
            // ブロック状態を確認
            if (userData.blockedUsers && userData.blockedUsers.includes(otherUserId)) {
              setIsUserBlocked(true);
            } else {
              setIsUserBlocked(false);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching profile photos:', error);
      }
    };
    
    fetchProfilePhotos();

    // チャットルームのテーマ設定を取得
    const fetchRoomTheme = async () => {
      try {
        const roomDoc = await firestore().collection('chatRooms').doc(roomId).get();
        if (roomDoc.exists) {
          const roomData = roomDoc.data();
          if (roomData?.theme) {
            setCurrentTheme(roomData.theme as ThemeType);
          }
        }
      } catch (error) {
        console.error('Error fetching room theme:', error);
      }
    };

    fetchRoomTheme();
    
    // メッセージを取得
    const unsubscribe = firestore()
      .collection('chatRooms')
      .doc(roomId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          const messageList: Message[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            messageList.push({
              id: doc.id,
              text: data.text,
              senderId: data.senderId,
              createdAt: data.createdAt,
              read: data.read || false,
              imageUrl: data.imageUrl,
            });
          });
          
          setMessages(messageList);
          setLoading(false);
          
          // 未読メッセージを既読にする
          markMessagesAsRead(messageList);
        },
        error => {
          console.error('Error fetching messages:', error);
          setLoading(false);
        }
      );
    
    return () => unsubscribe();
  }, [roomId, otherUserId, otherUserName, navigation, user]);
  
  const markMessagesAsRead = async (messageList: Message[]) => {
    if (!user) return;
    
    try {
      let unreadCount = 0;
      
      // 各メッセージを個別に処理
      for (const message of messageList) {
        if (message.senderId !== user.id && !message.read) {
          unreadCount++;
          
          try {
            // 各メッセージを個別に更新
            await firestore()
              .collection('chatRooms')
              .doc(roomId)
              .collection('messages')
              .doc(message.id)
              .update({ read: true });
              
            console.log('メッセージを既読にしました:', message.id);
          } catch (updateError) {
            console.error('メッセージ既読更新エラー:', updateError);
            // エラーが発生しても続行
          }
        }
      }
      
      // 未読カウントがある場合のみルームの更新を行う
      if (unreadCount > 0) {
        try {
          // チャットルームの未読カウントを更新
          await firestore()
            .collection('chatRooms')
            .doc(roomId)
            .update({
              [`unreadCount.${user.id}`]: 0,
            });
            
          console.log('ルームの未読カウントをリセットしました');
        } catch (roomUpdateError) {
          console.error('ルーム未読カウント更新エラー:', roomUpdateError);
        }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };
  
  // ブロック状態変更後の処理
  const handleBlockStatusChanged = () => {
    setIsUserBlocked(!isUserBlocked);
    // ブロックした場合はチャット画面を閉じる
    if (!isUserBlocked) {
      Alert.alert(
        'ブロックしました',
        'ユーザーをブロックしました。チャット画面を閉じます。',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };
  
  const handleSendMessage = async () => {
    if (!user || (!newMessage.trim() && !uploadingImage) || sending) return;
    
    // ブロック状態のチェック
    if (isUserBlocked) {
      Alert.alert('エラー', 'ブロックしているユーザーにはメッセージを送信できません。');
      return;
    }
    
    try {
      setSending(true);
      
      // ブロックされているかチェック
      if (otherUser && otherUser.blockedUsers && otherUser.blockedUsers.includes(user.id)) {
        // ブロックされている場合、メッセージを送信せずに成功したふりをする
        console.log('ブロックされているユーザーへのメッセージ送信をシミュレーション');
        
        // 送信成功の見た目だけを作る
        setTimeout(() => {
          setNewMessage('');
          setSending(false);
          
          // 仮のメッセージをUI上に表示するためのダミーデータを作成
          const dummyMessage: Message = {
            id: `dummy-${Date.now()}`,
            text: newMessage.trim() || '',
            senderId: user.id,
            createdAt: new Date(),
            read: false,
          };
          
          // メッセージリストに仮のメッセージを追加（UIのみ）
          setMessages(prevMessages => [dummyMessage, ...prevMessages]);
        }, 500); // リアルな送信遅延をシミュレート
        
        return;
      }
      
      const messageData: any = {
        text: newMessage.trim() || '',
        senderId: user.id,
        createdAt: firestore.FieldValue.serverTimestamp(),
        read: false,
      };
      
      // メッセージを追加
      await firestore()
        .collection('chatRooms')
        .doc(roomId)
        .collection('messages')
        .add(messageData);
      
      // チャットルームドキュメントを取得して現在のデータを確認
      const roomDoc = await firestore().collection('chatRooms').doc(roomId).get();
      const roomData = roomDoc.data() || {};
      
      // hiddenフィールドがあれば更新
      const hiddenField = roomData.hidden || {};
      
      // 自分と相手のhidden状態をリセット（両者にトークを表示）
      if (hiddenField[user.id] || hiddenField[otherUserId]) {
        // どちらかのユーザーがトークを非表示にしていた場合はリセット
        delete hiddenField[user.id];
        delete hiddenField[otherUserId];
      }
      
      // チャットルームの最終メッセージを更新
      await firestore().collection('chatRooms').doc(roomId).update({
        lastMessage: {
          content: newMessage.trim() || '画像',
          senderId: user.id,
          timestamp: firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: firestore.FieldValue.serverTimestamp(),
        [`unreadCount.${otherUserId}`]: firestore.FieldValue.increment(1),
        // hidden状態を更新
        hidden: hiddenField
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('エラー', 'メッセージの送信に失敗しました');
    } finally {
      setSending(false);
    }
  };
  
  // 写真送信機能
  const handleSelectImage = async () => {
    if (!user || sending) return;
    
    // ブロック状態のチェック
    if (isUserBlocked) {
      Alert.alert('エラー', 'ブロックしているユーザーには画像を送信できません。');
      return;
    }
    
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });
      
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (asset.uri) {
          setUploadingImage(true);
          
          // ブロックされているかチェック
          if (otherUser && otherUser.blockedUsers && otherUser.blockedUsers.includes(user.id)) {
            // ブロックされている場合、画像をアップロードせずに成功したふりをする
            console.log('ブロックされているユーザーへの画像送信をシミュレーション');
            
            // アップロード中の表示を数秒間表示してから消す
            setTimeout(() => {
              setUploadingImage(false);
              
              // 仮のメッセージをUI上に表示するためのダミーデータを作成
              const dummyMessage: Message = {
                id: `dummy-${Date.now()}`,
                text: '',
                senderId: user.id,
                createdAt: new Date(),
                read: false,
                imageUrl: asset.uri, // ローカルのURIを使用（実際にはアップロードされない）
              };
              
              // メッセージリストに仮のメッセージを追加（UIのみ）
              setMessages(prevMessages => [dummyMessage, ...prevMessages]);
            }, 1500); // リアルな送信遅延をシミュレート
            
            return;
          }
          
          // ストレージに画像をアップロード
          const fileName = `chatImages/${roomId}/${Date.now()}_${user.id}`;
          const reference = storage().ref(fileName);
          
          await reference.putFile(asset.uri);
          const url = await reference.getDownloadURL();
          
          const messageData: any = {
            text: '',
            senderId: user.id,
            createdAt: firestore.FieldValue.serverTimestamp(),
            read: false,
            imageUrl: url,
          };
          
          // メッセージを追加
          await firestore()
            .collection('chatRooms')
            .doc(roomId)
            .collection('messages')
            .add(messageData);
          
          // チャットルームの最終メッセージを更新
          await firestore().collection('chatRooms').doc(roomId).update({
            lastMessage: {
              content: '画像',
              senderId: user.id,
              timestamp: firestore.FieldValue.serverTimestamp(),
            },
            updatedAt: firestore.FieldValue.serverTimestamp(),
            [`unreadCount.${otherUserId}`]: firestore.FieldValue.increment(1),
          });
          
          setUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadingImage(false);
      Alert.alert('エラー', '画像のアップロードに失敗しました');
    }
  };
  
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // テーマ選択モーダル
  const renderThemeModal = () => {
    const themeOptions: {key: ThemeType, label: string, icon: string}[] = [
      { key: 'default', label: 'デフォルト', icon: 'color-fill' },
      { key: 'light', label: 'ライト', icon: 'sunny' },
      { key: 'dark', label: 'ダーク', icon: 'moon' },
      { key: 'pastel', label: 'パステル', icon: 'flower' },
      { key: 'nature', label: '自然', icon: 'leaf' },
    ];

    // テーマを選択して保存する関数
    const selectAndSaveTheme = async (selectedTheme: ThemeType) => {
      try {
        // 現在のテーマを設定
        setCurrentTheme(selectedTheme);
        
        // Firestoreにテーマ設定を保存
        await firestore().collection('chatRooms').doc(roomId).update({
          theme: selectedTheme,
          updatedAt: firestore.FieldValue.serverTimestamp()
        });
        
        // モーダルを閉じる
        setShowThemeModal(false);
      } catch (error) {
        console.error('Error saving theme:', error);
        Alert.alert('エラー', 'テーマの保存に失敗しました');
        // エラーが発生してもモーダルは閉じる
        setShowThemeModal(false);
      }
    };

    return (
      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>背景テーマを選択</Text>
              <TouchableOpacity onPress={() => setShowThemeModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.themeList}>
              {themeOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.themeOption,
                    currentTheme === option.key ? styles.selectedThemeOption : {}
                  ]}
                  onPress={() => selectAndSaveTheme(option.key)}
                >
                  <View style={styles.themeIconContainer}>
                    <Icon name={option.icon} size={24} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.themeLabel}>{option.label}</Text>
                  {currentTheme === option.key && (
                    <Icon name="checkmark" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };
  
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === user?.id;
    const themeColors = getThemeColors();
    
    // テーマによってテキスト色を変更
    const getTextColor = () => {
      if (isMyMessage) {
        // 自分のメッセージのテキスト色
        return currentTheme === 'light' ? '#212121' : '#ffffff';
      } else {
        // 相手のメッセージのテキスト色
        return theme.colors.text.primary;
      }
    };
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
      ]}>
        {!isMyMessage && (
          <Image
            source={{ uri: otherUserPhoto }}
            style={styles.avatar}
          />
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage 
            ? [styles.myMessageBubble, { backgroundColor: themeColors.myBubble }] 
            : [styles.otherMessageBubble, { backgroundColor: themeColors.otherBubble }],
        ]}>
          {/* 画像の表示 */}
          {item.imageUrl && (
            <TouchableOpacity
              onPress={() => {
                // 画像の拡大表示など
              }}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          
          {/* テキストメッセージの表示 */}
          {item.text && (
            <Text style={[
              styles.messageText,
              { color: getTextColor() }
            ]}>
              {item.text}
            </Text>
          )}
          
          <Text style={[
            styles.messageTime, 
            { color: isMyMessage 
              ? (currentTheme === 'light' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)') 
              : theme.colors.text.secondary 
            }
          ]}>
            {item.createdAt ? formatTimestamp(item.createdAt) : '送信中...'}
            {isMyMessage && item.read && (
              <Text style={[
                styles.readIndicator,
                { color: currentTheme === 'light' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)' }
              ]}> ✓</Text>
            )}
          </Text>
        </View>
        
        {isMyMessage && (
          <Image
            source={{ uri: userPhoto }}
            style={styles.avatar}
          />
        )}
      </View>
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
        <Icon name="chatbubbles-outline" size={60} color={theme.colors.text.secondary} />
        <Text style={styles.emptyTitle}>メッセージはありません</Text>
        <Text style={styles.emptyText}>
          最初のメッセージを送信しましょう
        </Text>
      </View>
    );
  };
  
  const themeColors = getThemeColors();
  
  return (
    <SafeAreaView style={[
      styles.container, 
      { backgroundColor: themeColors.background }
    ]}>
      {renderThemeModal()}
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: themeColors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          style={styles.messageList}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={item => item.id}
          inverted
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={messages.length === 0 ? { flex: 1 } : null}
        />
        
        <View style={styles.inputContainer}>
          {/* テーマ選択ボタン */}
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={() => setShowThemeModal(true)}
          >
            <Icon name="color-fill" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          
          {/* 画像選択ボタン */}
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={handleSelectImage}
            disabled={uploadingImage}
          >
            <Icon name="images" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="メッセージを入力..."
            placeholderTextColor={theme.colors.text.secondary}
            multiline
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() && !uploadingImage) ? styles.sendButtonDisabled : {}
            ]}
            onPress={handleSendMessage}
            disabled={(!newMessage.trim() && !uploadingImage) || sending || uploadingImage}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Icon name="send-sharp" size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
        
        {uploadingImage && (
          <View style={styles.uploading}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.uploadingText}>画像をアップロード中...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
      
      {/* ユーザーアクションメニュー */}
      {otherUser && (
        <UserActionMenu
          visible={showActionMenu}
          onClose={() => setShowActionMenu(false)}
          userId={otherUserId}
          userName={otherUserName}
          isBlocked={isUserBlocked}
          onBlockStatusChanged={handleBlockStatusChanged}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.chatThemes.default.background,
  },
  messageList: {
    flex: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginHorizontal: 8,
  },
  messageBubble: {
    maxWidth: '70%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 4,
  },
  myMessageBubble: {
    backgroundColor: theme.colors.chatThemes.default.myBubble,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: theme.colors.chatThemes.default.otherBubble,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  messageTime: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  readIndicator: {
    color: 'rgba(255,255,255,0.9)',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#FFF',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    color: theme.colors.text.primary,
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#C0C0C0',
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
    marginVertical: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  uploading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  uploadingText: {
    color: '#FFF',
    marginLeft: 8,
  },
  // テーマモーダル用スタイル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  themeList: {
    maxHeight: 300,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedThemeOption: {
    backgroundColor: '#F5F5F5',
  },
  themeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  themeLabel: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
});

export default ChatRoomScreen;
