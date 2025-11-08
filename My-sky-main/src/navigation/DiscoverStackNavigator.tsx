import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { DiscoverStackParamList } from './types';
import { theme } from '../styles/theme';

// スクリーンのインポート
import CirclesScreen from '../screens/circles/CirclesScreen';
import CircleDetailsScreen from '../screens/circles/CircleDetailsScreen';
import CircleMembersScreen from '../screens/circles/CircleMembersScreen';
import CircleBoardScreen from '../screens/circles/CircleBoardScreen';
import EventDetailsScreen from '../screens/events/EventDetailsScreen';
import EventBoardScreen from '../screens/events/EventBoardScreen';
import EventAttendeesScreen from '../screens/events/EventAttendeesScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import CreateCircleScreen from '../screens/circles/CreateCircleScreen';
import EditCircleScreen from '../screens/circles/EditCircleScreen';
import CreateEventScreen from '../screens/events/CreateEventScreen';
import EditEventScreen from '../screens/events/EditEventScreen';
import ChatRoomScreen from '../screens/messages/ChatRoomScreen';

const Stack = createStackNavigator<DiscoverStackParamList>();

const DiscoverStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
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
      <Stack.Screen 
        name="Discover" 
        component={CirclesScreen}
        options={{ title: '探索' }}
      />
      <Stack.Screen 
        name="CircleDetails" 
        component={CircleDetailsScreen}
        options={{ title: 'サークル詳細' }}
      />
      <Stack.Screen 
        name="EventDetails" 
        component={EventDetailsScreen}
        options={{ title: 'イベント詳細' }}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={ProfileScreen}
        options={{ title: 'プロフィール' }}
      />
      <Stack.Screen 
        name="CreateCircle" 
        component={CreateCircleScreen}
        options={{ title: 'サークル作成' }}
      />
      <Stack.Screen 
        name="EditCircle" 
        component={EditCircleScreen}
        options={{ title: 'サークル編集' }}
      />
      <Stack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen}
        options={{ title: 'イベント作成' }}
      />
      <Stack.Screen 
        name="ChatRoom" 
        component={ChatRoomScreen}
        options={({ route }) => ({ 
          title: route.params?.otherUserName || 'チャット',
        })}
      />
      <Stack.Screen 
        name="CircleMembers" 
        component={CircleMembersScreen}
        options={{ title: 'メンバー一覧' }}
      />
      <Stack.Screen 
        name="EventAttendees" 
        component={EventAttendeesScreen}
        options={({ route }) => ({ 
          title: route.params?.title || 'イベント参加者一覧',
        })}
      />
      <Stack.Screen 
        name="Search" 
        component={CirclesScreen}
        options={({ route }) => ({ 
          title: `検索: ${route.params?.filter || ''}`,
        })}
      />
      <Stack.Screen
        name="EditEvent"
        component={EditEventScreen}
        options={{ title: 'イベント編集' }}
      />
      <Stack.Screen
        name="CircleBoard"
        component={CircleBoardScreen}
        options={({ route }) => ({
          title: `${route.params.circleName}の掲示板`,
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.text.primary,
        })}
      />
      <Stack.Screen
        name="EventBoard"
        component={EventBoardScreen}
        options={({ route }) => ({
          title: `${route.params.eventName}の掲示板`,
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.text.primary,
        })}
      />
    </Stack.Navigator>
  );
};

export default DiscoverStackNavigator; 