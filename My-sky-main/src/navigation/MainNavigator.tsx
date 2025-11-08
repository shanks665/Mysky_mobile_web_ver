import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { MainTabParamList, HomeStackParamList, DiscoverStackParamList, ProfileStackParamList, MessagesStackParamList, EventsStackParamList, NotificationStackParamList } from './types';
import { theme } from '../styles/theme';
import { TouchableOpacity } from 'react-native';

// スクリーンのインポート
import FeedScreen from '../screens/feed/FeedScreen';
import CirclesScreen from '../screens/circles/CirclesScreen';
import CircleDetailsScreen from '../screens/circles/CircleDetailsScreen';
import CreateCircleScreen from '../screens/circles/CreateCircleScreen';
import EditCircleScreen from '../screens/circles/EditCircleScreen';
import CircleBoardScreen from '../screens/circles/CircleBoardScreen';
import EventDetailsScreen from '../screens/events/EventDetailsScreen';
import CreateEventScreen from '../screens/events/CreateEventScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import FollowersScreen from '../screens/profile/FollowersScreen';
import FollowingScreen from '../screens/profile/FollowingScreen';
import MyCirclesScreen from '../screens/profile/MyCirclesScreen';
import CommentsListScreen from '../screens/feed/CommentsListScreen';
import LikesListScreen from '../screens/feed/LikesListScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ChatRoomScreen from '../screens/messages/ChatRoomScreen';
import CircleMembersScreen from '../screens/circles/CircleMembersScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import EditEventScreen from '../screens/events/EditEventScreen';
import EventsScreen from '../screens/events/EventsScreen';
import EventAttendeesScreen from '../screens/events/EventAttendeesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EventBoardScreen from '../screens/events/EventBoardScreen';

// 他のスタックナビゲーターを作成
const HomeStack = createStackNavigator<HomeStackParamList>();
const DiscoverStack = createStackNavigator<DiscoverStackParamList>();
const ProfileStack = createStackNavigator<ProfileStackParamList>();
const MessagesStack = createStackNavigator<MessagesStackParamList>();
const EventsStack = createStackNavigator<EventsStackParamList>();
const NotificationStack = createStackNavigator<NotificationStackParamList>();

// Homeスタックナビゲーター
const HomeNavigator = () => {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.colors.text.primary,
          fontWeight: 'bold',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <HomeStack.Screen 
        name="Feed" 
        component={FeedScreen}
        options={{ title: 'ホーム' }}
      />
      <HomeStack.Screen 
        name="UserProfile" 
        component={ProfileScreen}
        options={{ title: 'プロフィール' }}
      />
      <HomeStack.Screen 
        name="CommentsList" 
        component={CommentsListScreen}
        options={{ title: 'コメント' }}
      />
      <HomeStack.Screen 
        name="LikesList" 
        component={LikesListScreen}
        options={{ title: 'いいね' }}
      />
      <HomeStack.Screen 
        name="ChatRoom" 
        component={ChatRoomScreen}
        options={({ route }) => ({ 
          title: route.params?.otherUserName || 'チャット',
        })}
      />
      <HomeStack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: '設定' }}
      />
    </HomeStack.Navigator>
  );
};

// Discoverスタックナビゲーター
const DiscoverNavigator = () => {
  return (
    <DiscoverStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.colors.text.primary,
          fontWeight: 'bold',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <DiscoverStack.Screen 
        name="Discover" 
        component={CirclesScreen}
        options={{ title: '探索' }}
      />
      <DiscoverStack.Screen 
        name="CircleDetails" 
        component={CircleDetailsScreen}
        options={{ title: 'サークル詳細' }}
      />
      <DiscoverStack.Screen 
        name="EventDetails" 
        component={EventDetailsScreen}
        options={{ title: 'イベント詳細' }}
      />
      <DiscoverStack.Screen 
        name="UserProfile" 
        component={ProfileScreen}
        options={{ title: 'プロフィール' }}
      />
      <DiscoverStack.Screen 
        name="CreateCircle" 
        component={CreateCircleScreen}
        options={{ title: 'サークル作成' }}
      />
      <DiscoverStack.Screen 
        name="EditCircle" 
        component={EditCircleScreen}
        options={{ title: 'サークル編集' }}
      />
      <DiscoverStack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen}
        options={{ title: 'イベント作成' }}
      />
      <DiscoverStack.Screen 
        name="ChatRoom" 
        component={ChatRoomScreen}
        options={({ route }) => ({ 
          title: route.params?.otherUserName || 'チャット',
        })}
      />
      <DiscoverStack.Screen 
        name="CircleMembers" 
        component={CircleMembersScreen}
        options={{ title: 'メンバー一覧' }}
      />
      <DiscoverStack.Screen 
        name="EventAttendees" 
        component={EventAttendeesScreen}
        options={({ route }) => ({ 
          title: route.params?.title || 'イベント参加者一覧',
        })}
      />
      <DiscoverStack.Screen 
        name="Search" 
        component={CirclesScreen}
        options={({ route }) => ({ 
          title: `検索: ${route.params?.filter || ''}`,
        })}
      />
      <DiscoverStack.Screen
        name="EditEvent"
        component={EditEventScreen}
        options={{ title: 'イベント編集' }}
      />
      <DiscoverStack.Screen 
        name="CircleBoard"
        component={CircleBoardScreen}
        options={({ route }) => ({ 
          title: route.params?.circleName ? `${route.params.circleName}の掲示板` : '掲示板',
        })}
      />
      <DiscoverStack.Screen 
        name="EventBoard"
        component={EventBoardScreen}
        options={({ route }) => ({ 
          title: route.params?.eventName ? `${route.params.eventName}の掲示板` : 'イベント掲示板',
        })}
      />
    </DiscoverStack.Navigator>
  );
};

// Profileスタックナビゲーター
const ProfileNavigator = () => {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.colors.text.primary,
          fontWeight: 'bold',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <ProfileStack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'マイページ' }}
      />
      <ProfileStack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: '設定' }}
      />
      <ProfileStack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{ title: 'プロフィール編集' }}
      />
      <ProfileStack.Screen 
        name="CommentsList" 
        component={CommentsListScreen}
        options={{ title: 'コメント' }}
      />
      <ProfileStack.Screen 
        name="LikesList" 
        component={LikesListScreen}
        options={{ title: 'いいね' }}
      />
      <ProfileStack.Screen 
        name="Followers" 
        component={FollowersScreen}
        options={{ title: 'フォロワー' }}
      />
      <ProfileStack.Screen 
        name="Following" 
        component={FollowingScreen}
        options={{ title: 'フォロー中' }}
      />
      <ProfileStack.Screen 
        name="MyCircles" 
        component={MyCirclesScreen}
        options={{ title: 'マイサークル' }}
      />
      <ProfileStack.Screen 
        name="CircleDetails" 
        component={CircleDetailsScreen}
        options={{ title: 'サークル詳細' }}
      />
      <ProfileStack.Screen 
        name="CreateCircle" 
        component={CreateCircleScreen}
        options={{ title: 'サークル作成' }}
      />
      <ProfileStack.Screen 
        name="EditCircle" 
        component={EditCircleScreen}
        options={{ title: 'サークル編集' }}
      />
      <ProfileStack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen}
        options={{ title: 'イベント作成' }}
      />
      <ProfileStack.Screen 
        name="EventDetails" 
        component={EventDetailsScreen}
        options={{ title: 'イベント詳細' }}
      />
      <ProfileStack.Screen 
        name="EditEvent" 
        component={EditEventScreen}
        options={{ title: 'イベント編集' }}
      />
      <ProfileStack.Screen 
        name="ChatRoom" 
        component={ChatRoomScreen}
        options={({ route }) => ({ 
          title: route.params?.otherUserName || 'チャット',
        })}
      />
      <ProfileStack.Screen 
        name="UserProfile" 
        component={ProfileScreen}
        options={{ title: 'プロフィール' }}
      />
    </ProfileStack.Navigator>
  );
};

// Messagesスタックナビゲーター
const MessagesNavigator = () => {
  return (
    <MessagesStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.colors.text.primary,
          fontWeight: 'bold',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <MessagesStack.Screen 
        name="Messages" 
        component={MessagesScreen}
        options={{ title: 'メッセージ' }}
      />
      <MessagesStack.Screen 
        name="ChatRoom" 
        component={ChatRoomScreen}
        options={({ route }) => ({ 
          title: route.params?.otherUserName || 'チャット',
        })}
      />
      <MessagesStack.Screen 
        name="UserProfile" 
        component={ProfileScreen}
        options={{ title: 'プロフィール' }}
      />
    </MessagesStack.Navigator>
  );
};

// Eventsスタックナビゲーター
const EventsNavigator = () => {
  return (
    <EventsStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.colors.text.primary,
          fontWeight: 'bold',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <EventsStack.Screen 
        name="Events" 
        component={EventsScreen}
        options={{ title: 'イベント' }}
      />
      <EventsStack.Screen 
        name="EventDetails" 
        component={EventDetailsScreen}
        options={{ title: 'イベント詳細' }}
      />
      <EventsStack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen}
        options={{ title: 'イベント作成' }}
      />
      <EventsStack.Screen 
        name="EditEvent" 
        component={EditEventScreen}
        options={{ title: 'イベント編集' }}
      />
      <EventsStack.Screen 
        name="CircleDetails" 
        component={CircleDetailsScreen}
        options={{ title: 'サークル詳細' }}
      />
      <EventsStack.Screen 
        name="UserProfile" 
        component={ProfileScreen}
        options={{ title: 'プロフィール' }}
      />
      <EventsStack.Screen 
        name="EventAttendees" 
        component={EventAttendeesScreen}
        options={({ route }) => ({ 
          title: route.params?.title || 'イベント参加者一覧',
        })}
      />
    </EventsStack.Navigator>
  );
};

// Notificationスタックナビゲーター
const NotificationNavigator = () => {
  return (
    <NotificationStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.colors.text.primary,
          fontWeight: 'bold',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <NotificationStack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ title: '通知' }}
      />
      <NotificationStack.Screen 
        name="EventDetails" 
        component={EventDetailsScreen}
        options={{ title: 'イベント詳細' }}
      />
      <NotificationStack.Screen 
        name="CircleDetails" 
        component={CircleDetailsScreen}
        options={{ title: 'サークル詳細' }}
      />
      <NotificationStack.Screen 
        name="EventAttendees" 
        component={EventAttendeesScreen}
        options={({ route }) => ({ 
          title: route.params?.title || 'イベント参加者一覧',
        })}
      />
      <NotificationStack.Screen 
        name="UserProfile" 
        component={ProfileScreen}
        options={{ title: 'プロフィール' }}
      />
      <NotificationStack.Screen 
        name="CircleRequests" 
        component={CircleMembersScreen}
        options={({ route }) => ({ 
          title: 'サークル参加リクエスト',
        })}
      />
    </NotificationStack.Navigator>
  );
};

// 一時的なプレースホルダーコンポーネント
const PlaceholderScreen = () => <></>;

// メインのタブナビゲーター
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = 'alert-circle'; // デフォルト値を設定

          // 一目でわかる直感的なアイコン
          if (route.name === 'HomeTab') {
            iconName = 'home-sharp';  // シンプルなホームアイコン
          } else if (route.name === 'DiscoverTab') {
            iconName = 'compass-sharp';  // 探索のコンパスアイコン
          } else if (route.name === 'EventsTab') {
            iconName = 'calendar-sharp';  // イベントを示すカレンダーアイコン
          } else if (route.name === 'MessagesTab') {
            iconName = 'chatbubbles-sharp';  // チャットを示す吹き出しアイコン
          } else if (route.name === 'NotificationsTab') {
            iconName = 'notifications-sharp';  // 通知を示すベルアイコン
          } else if (route.name === 'ProfileTab') {
            iconName = 'person-sharp';  // プロフィールを示す人物アイコン
          }

          // サイズを少し小さくする
          return <Icon name={iconName} size={size - 2} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 2, // 上部のパディングを減らす
          justifyContent: 'space-around', // space-betweenからspace-aroundに変更
          alignItems: 'center',
          paddingHorizontal: 10 // 水平方向の内側の余白を追加
        },
        tabBarLabelStyle: {
          fontSize: 9, // フォントサイズを小さく
          marginTop: 0, 
          marginBottom: 4,
        },
        tabBarIconStyle: {
          marginTop: 0,
          alignItems: 'center',
          justifyContent: 'center',
          width: 22, // アイコンの幅を制限
          height: 22, // アイコンの高さを制限
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 0,
          paddingHorizontal: 0,
          height: 50,
          width: '16%', // 幅をさらに小さく
          marginHorizontal: 0,
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{
          tabBarLabel: 'ホーム',
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              name={focused ? 'home-sharp' : 'home-outline'}
              size={focused ? 20 : 18}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: 'ホーム画面',
        }}
      />
      <Tab.Screen
        name="DiscoverTab"
        component={DiscoverNavigator}
        options={{
          tabBarLabel: '探索',
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              name={focused ? 'compass-sharp' : 'compass-outline'}
              size={focused ? 20 : 18}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: '探索画面',
        }}
      />
      <Tab.Screen
        name="EventsTab"
        component={EventsNavigator}
        options={{
          tabBarLabel: 'イベント',
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              name={focused ? 'calendar-sharp' : 'calendar-outline'}
              size={focused ? 20 : 18}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: 'イベント画面',
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesNavigator}
        options={{
          tabBarLabel: 'メッセージ',
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              name={focused ? 'chatbubbles-sharp' : 'chatbubbles-outline'}
              size={focused ? 20 : 18}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: 'メッセージ画面',
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationNavigator}
        options={{
          tabBarLabel: '通知',
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              name={focused ? 'notifications-sharp' : 'notifications-outline'}
              size={focused ? 20 : 18}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: '通知画面',
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          tabBarLabel: 'プロフィール',
          tabBarIcon: ({ color, size, focused }) => (
            <Icon
              name={focused ? 'person-sharp' : 'person-outline'}
              size={focused ? 20 : 18}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: 'プロフィール画面',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
