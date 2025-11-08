import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';
import { Coordinates, obfuscateLocation } from '../utils/distanceCalculator';

// 位置情報の権限を要求
export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    const status = await Geolocation.requestAuthorization('whenInUse');
    return status === 'granted';
  }
  
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: '位置情報の許可',
          message: 'このアプリでは近くのユーザーを表示するために位置情報を利用します。',
          buttonNeutral: '後で確認する',
          buttonNegative: '許可しない',
          buttonPositive: '許可する',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Location permission error:', err);
      return false;
    }
  }
  
  return false;
};

// 現在地を取得
export const getCurrentPosition = (): Promise<GeoPosition> => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 10000 
      }
    );
  });
};

// 位置情報を監視
export const watchPosition = (
  onPositionChange: (position: GeoPosition) => void,
  onError?: (error: any) => void
): number => {
  return Geolocation.watchPosition(
    onPositionChange,
    onError || (error => console.error('Location watch error:', error)),
    {
      enableHighAccuracy: true,
      distanceFilter: 50, // 50メートル移動したら更新
      interval: 5000, // 5秒ごと（Android用）
      fastestInterval: 2000, // 最速更新間隔（Android用）
    }
  );
};

// 位置情報の監視を停止
export const clearWatch = (watchId: number): void => {
  Geolocation.clearWatch(watchId);
};

// 位置情報を取得してプライバシー保護のため精度を下げる
export const getObfuscatedPosition = async (
  precisionLevel: 'low' | 'medium' | 'high' = 'medium'
): Promise<Coordinates> => {
  try {
    const position = await getCurrentPosition();
    const coords: Coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    
    // プライバシー保護のため位置情報の精度を下げる
    return obfuscateLocation(coords, precisionLevel);
  } catch (error) {
    console.error('Failed to get obfuscated position:', error);
    throw error;
  }
}; 