import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { GeoPosition } from 'react-native-geolocation-service';
import { Coordinates } from '../utils/distanceCalculator';
import * as LocationService from '../services/locationService';
import { useAuth } from './AuthContext';
import firestore from '@react-native-firebase/firestore';

interface LocationContextData {
  currentLocation: Coordinates | null;
  hasLocationPermission: boolean | null;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  updateUserLocation: () => Promise<void>;
  setPrivacyLevel: (level: 'public' | 'followers' | 'private') => Promise<void>;
}

const LocationContext = createContext<LocationContextData>({} as LocationContextData);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const { user, updateProfile } = useAuth();

  // 初期化時に権限を確認
  useEffect(() => {
    checkLocationPermission();
  }, []);

  // 権限が許可されたら位置情報を取得開始
  useEffect(() => {
    if (hasLocationPermission) {
      startLocationUpdates();
    }
    
    return () => {
      stopLocationUpdates();
    };
  }, [hasLocationPermission]);

  // 位置情報の権限を確認
  const checkLocationPermission = async () => {
    try {
      setLoading(true);
      const hasPermission = await LocationService.requestLocationPermission();
      setHasLocationPermission(hasPermission);
      
      if (!hasPermission) {
        setError('位置情報へのアクセスが許可されていません');
      }
    } catch (err) {
      setError('位置情報の権限確認中にエラーが発生しました');
      console.error('Location permission check error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 位置情報の更新を開始
  const startLocationUpdates = async () => {
    try {
      // 初期位置を取得
      const position = await LocationService.getCurrentPosition();
      handlePositionUpdate(position);
      
      // 位置情報の監視を開始
      const id = LocationService.watchPosition(
        handlePositionUpdate,
        (err) => {
          console.error('Location watch error:', err);
          setError('位置情報の取得中にエラーが発生しました');
        }
      );
      
      setWatchId(id);
    } catch (err) {
      console.error('Start location updates error:', err);
      setError('位置情報の取得中にエラーが発生しました');
    }
  };

  // 位置情報の監視を停止
  const stopLocationUpdates = () => {
    if (watchId !== null) {
      LocationService.clearWatch(watchId);
      setWatchId(null);
    }
  };

  // 位置情報のコールバック処理
  const handlePositionUpdate = (position: GeoPosition) => {
    const coords: Coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    
    setCurrentLocation(coords);
    setError(null);
  };

  // 位置情報の権限をリクエスト
  const requestPermission = async (): Promise<boolean> => {
    try {
      setLoading(true);
      const hasPermission = await LocationService.requestLocationPermission();
      setHasLocationPermission(hasPermission);
      
      if (!hasPermission) {
        setError('位置情報へのアクセスが許可されていません');
      } else {
        setError(null);
        startLocationUpdates();
      }
      
      return hasPermission;
    } catch (err) {
      setError('位置情報の権限リクエスト中にエラーが発生しました');
      console.error('Request location permission error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ユーザーの位置情報を更新
  const updateUserLocation = async () => {
    try {
      if (!user || !user.id) {
        throw new Error('ユーザーがログインしていません');
      }
      
      if (!currentLocation) {
        throw new Error('位置情報を取得できません');
      }
      
      // プライバシーレベルを維持しつつ位置情報だけを更新
      await firestore().collection('users').doc(user.id).update({
        'location.latitude': currentLocation.latitude,
        'location.longitude': currentLocation.longitude,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error('Update user location error:', err);
      throw err;
    }
  };

  // プライバシーレベルを設定
  const setPrivacyLevel = async (level: 'public' | 'followers' | 'private') => {
    try {
      if (!user) {
        throw new Error('ユーザーがログインしていません');
      }
      
      await updateProfile({
        location: {
          ...user.location,
          privacyLevel: level,
        },
      });
    } catch (err) {
      console.error('Set privacy level error:', err);
      throw err;
    }
  };

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        hasLocationPermission,
        loading,
        error,
        requestPermission,
        updateUserLocation,
        setPrivacyLevel,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  
  return context;
}; 