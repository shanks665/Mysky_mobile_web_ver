import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { theme } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';

interface UserActionMenuProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  isBlocked: boolean;
  onBlockStatusChanged?: () => void;
}

export const UserActionMenu: React.FC<UserActionMenuProps> = ({
  visible,
  onClose,
  userId,
  userName,
  isBlocked,
  onBlockStatusChanged,
}) => {
  const { blockUser, unblockUser } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handleBlockUser = async () => {
    try {
      setProcessing(true);
      await blockUser(userId);
      Alert.alert(
        'ブロック完了',
        `${userName}をブロックしました。このユーザーとはお互いにやり取りできなくなります。`
      );
      if (onBlockStatusChanged) {
        onBlockStatusChanged();
      }
      onClose();
    } catch (error) {
      console.error('ブロックエラー:', error);
      Alert.alert('エラー', 'ユーザーのブロックに失敗しました。再度お試しください。');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnblockUser = async () => {
    try {
      setProcessing(true);
      await unblockUser(userId);
      Alert.alert('ブロック解除', `${userName}のブロックを解除しました。`);
      if (onBlockStatusChanged) {
        onBlockStatusChanged();
      }
      onClose();
    } catch (error) {
      console.error('ブロック解除エラー:', error);
      Alert.alert('エラー', 'ブロック解除に失敗しました。再度お試しください。');
    } finally {
      setProcessing(false);
    }
  };

  const confirmBlockUser = () => {
    Alert.alert(
      'ユーザーをブロック',
      `${userName}をブロックしますか？ブロックすると、このユーザーとのメッセージのやり取りや投稿の閲覧ができなくなります。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ブロック', onPress: handleBlockUser, style: 'destructive' },
      ]
    );
  };

  const confirmUnblockUser = () => {
    Alert.alert(
      'ブロックを解除',
      `${userName}のブロックを解除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '解除', onPress: handleUnblockUser },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{userName}</Text>
            <TouchableOpacity onPress={onClose} disabled={processing}>
              <Icon name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.actionList}>
            {isBlocked ? (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={confirmUnblockUser}
                disabled={processing}
              >
                <Icon name="person-add-outline" size={24} color={theme.colors.primary} />
                <Text style={styles.actionText}>ブロックを解除</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={confirmBlockUser}
                disabled={processing}
              >
                <Icon name="person-remove-outline" size={24} color={theme.colors.error} />
                <Text style={[styles.actionText, { color: theme.colors.error }]}>
                  ユーザーをブロック
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  actionList: {
    paddingTop: 10,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    marginLeft: 15,
  },
});




