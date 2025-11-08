import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLocation } from '../contexts/LocationContext';
import { calculateDistance } from '../utils/distanceCalculator';
import { theme } from '../styles/theme';
import { User } from '../models/User';

interface UserDistanceProps {
  user: User;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

const UserDistance: React.FC<UserDistanceProps> = ({
  user,
  size = 'medium',
  showIcon = true,
}) => {
  const { currentLocation } = useLocation();
  const [distance, setDistance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateUserDistance();
  }, [currentLocation, user]);

  const calculateUserDistance = () => {
    try {
      // 現在地または相手の位置情報がない場合はエラー
      if (!currentLocation || !user.location || !user.location.latitude || !user.location.longitude) {
        setError('位置情報が取得できません');
        return;
      }

      // 相手のプライバシー設定が「private」の場合は距離を表示しない
      if (user.location.privacyLevel === 'private') {
        setDistance('非公開');
        return;
      }

      // 距離を計算
      const distanceText = calculateDistance(
        currentLocation,
        {
          latitude: user.location.latitude,
          longitude: user.location.longitude,
        }
      );

      setDistance(distanceText);
      setError(null);
    } catch (err) {
      console.error('Calculate distance error:', err);
      setError('距離の計算中にエラーが発生しました');
    }
  };

  // 距離に基づいて色を決定
  const getDistanceColor = (distanceText: string | null): string => {
    if (!distanceText || distanceText === '非公開') {
      return theme.colors.text.secondary;
    }

    const numericDistance = parseFloat(distanceText.replace(/[^0-9.]/g, ''));
    const unit = distanceText.includes('km') ? 'km' : 'm';

    if (unit === 'km' && numericDistance > 10) {
      return theme.colors.distance.far;
    }
    if (unit === 'km' && numericDistance > 2) {
      return theme.colors.distance.medium;
    }
    return theme.colors.distance.close;
  };

  // サイズに応じたスタイルを取得
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.containerSmall,
          text: styles.textSmall,
          icon: 14,
        };
      case 'large':
        return {
          container: styles.containerLarge,
          text: styles.textLarge,
          icon: 20,
        };
      default:
        return {
          container: styles.containerMedium,
          text: styles.textMedium,
          icon: 16,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const distanceColor = getDistanceColor(distance);

  if (error) {
    return (
      <View style={[styles.container, sizeStyles.container]}>
        <Text style={[styles.error, sizeStyles.text]}>{error}</Text>
      </View>
    );
  }

  if (!distance) {
    return (
      <View style={[styles.container, sizeStyles.container]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, sizeStyles.container]}>
      {showIcon && (
        <Ionicons
          name="location-outline"
          size={sizeStyles.icon}
          color={distanceColor}
          style={styles.icon}
        />
      )}
      <Text style={[styles.text, sizeStyles.text, { color: distanceColor }]}>
        {distance}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerSmall: {
    paddingVertical: 2,
  },
  containerMedium: {
    paddingVertical: 4,
  },
  containerLarge: {
    paddingVertical: 6,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontFamily: theme.typography.fontFamily.regular,
  },
  textSmall: {
    fontSize: theme.typography.fontSize.xs,
  },
  textMedium: {
    fontSize: theme.typography.fontSize.sm,
  },
  textLarge: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
  },
  error: {
    color: theme.colors.error,
  },
});

export default UserDistance; 