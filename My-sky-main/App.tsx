/**
 * Meetify App
 * 
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar, Alert, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Firebase関連のインポート
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// ナビゲーション
import { RootNavigator } from './src/navigation';

// コンテキスト
import { AuthProvider } from './src/contexts/AuthContext';

// サービス
import { initBackgroundNotifications } from './src/services/backgroundService';

// スタイル
import { theme } from './src/styles/theme';

// デバッグ関連の警告を無視
LogBox.ignoreLogs([
  'Require cycle:',
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes will be removed',
]);

// React Native 0.78のデバッガー初期化問題を回避
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args[0] && args[0].includes && args[0].includes('jsinspector-modern')) {
      return;
    }
    originalConsoleError(...args);
  };
}

function App(): React.JSX.Element {
  // Firebase初期化
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        // Firebase初期化の確認
        if (firebase.apps.length === 0) {
          // Firebase設定オブジェクト - google-services.jsonから自動的に読み込まれる
          const firebaseConfig = {
            // google-services.jsonの内容に基づく設定
            apiKey: 'AIzaSyCrryvDQphW4JlUBHRx4pTEeHHQ6GdwMGE',
            appId: '1:67775326182:android:bbe900425e7dd5ec205827',
            projectId: 'kskw-68eee',
            storageBucket: 'kskw-68eee.firebasestorage.app',
            messagingSenderId: '67775326182',
            databaseURL: 'https://kskw-68eee-default-rtdb.firebaseio.com',
          };
          
          await firebase.initializeApp(firebaseConfig);
          console.log('Firebase initialized successfully');
        } else {
          console.log('Firebase already initialized');
        }

        // バックグラウンド通知の初期化を独立したtry-catchで囲む
        try {
          await initBackgroundNotifications();
          console.log('Background notifications initialized');
        } catch (bgError) {
          // バックグラウンド通知の初期化に失敗しても、アプリの他の機能は使用可能にする
          console.error('Background notification initialization error:', bgError);
          console.log('App will continue without background notifications');
          // 開発時のみAlertを表示
          if (__DEV__) {
            Alert.alert(
              'Warning',
              'Background notifications could not be initialized. Some features may be limited.'
            );
          }
        }
      } catch (error) {
        console.error('Firebase initialization error:', error);
        Alert.alert('Error', 'Failed to initialize app services. Please check your connection and try again.');
      }
    };

    initializeFirebase();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
      />
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
