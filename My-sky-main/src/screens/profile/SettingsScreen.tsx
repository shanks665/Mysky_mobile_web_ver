import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';

type SettingsNavigationProp = StackNavigationProp<ProfileStackParamList, 'Settings'>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsNavigationProp>();
  const { signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'ログアウト確認',
      'ログアウトしてもよろしいですか？',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // 認証画面に戻る（AuthNavigatorで処理）
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('エラー', 'ログアウトに失敗しました');
            }
          },
        },
      ],
    );
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    onPress: () => void,
    danger: boolean = false
  ) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingItemLeft}>
        <Icon
          name={icon}
          size={24}
          color={danger ? theme.colors.error : theme.colors.text.primary}
        />
        <Text
          style={[
            styles.settingItemText,
            danger && { color: theme.colors.error },
          ]}
        >
          {title}
        </Text>
      </View>
      <Icon name="chevron-forward" size={20} color={theme.colors.text.secondary} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アカウント設定</Text>
        {renderSettingItem(
          'person-outline',
          'プロフィール編集',
          () => navigation.navigate('EditProfile')
        )}
        {renderSettingItem(
          'notifications-outline',
          '通知設定',
          () => Alert.alert('情報', '準備中です')
        )}
        {renderSettingItem(
          'lock-closed-outline',
          'プライバシー設定',
          () => Alert.alert('情報', '準備中です')
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>サポート</Text>
        {renderSettingItem(
          'help-circle-outline',
          'ヘルプ',
          () => Alert.alert('情報', '準備中です')
        )}
        {renderSettingItem(
          'information-circle-outline',
          'アプリについて',
          () => Alert.alert('情報', '準備中です')
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アカウント</Text>
        {renderSettingItem(
          'log-out-outline',
          'ログアウト',
          handleLogout,
          true
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
    marginVertical: 12,
    marginHorizontal: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.card,
    marginBottom: 1,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemText: {
    fontSize: 16,
    marginLeft: 16,
    color: theme.colors.text.primary,
  },
});

export default SettingsScreen; 