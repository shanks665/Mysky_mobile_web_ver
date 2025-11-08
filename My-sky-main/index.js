/**
 * @format
 */

import {AppRegistry, LogBox} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// React Native 0.78のデバッガー初期化問題を回避
if (__DEV__) {
  // デバッガーを無効化
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('jsinspector-modern')) {
      return;
    }
    originalConsoleError(...args);
  };

  // 不要な警告を非表示
  LogBox.ignoreLogs([
    'Require cycle:',
    'Non-serializable values were found in the navigation state',
    'ViewPropTypes will be removed',
  ]);
}

AppRegistry.registerComponent(appName, () => App);
