// TODO: 実際の実装前に '@react-native-community/geolocation' をインストールする必要があります
// import Geolocation from '@react-native-community/geolocation';

// 一時的な型定義
interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

interface GeolocationPosition {
  coords: GeolocationCoordinates;
  timestamp: number;
}

interface GeolocationError {
  code: number;
  message: string;
}

/**
 * 2つの座標間の距離を計算し、人間が読みやすい形式で返します
 * @param lat1 始点の緯度
 * @param lon1 始点の経度
 * @param lat2 終点の緯度
 * @param lon2 終点の経度
 * @returns 人間が読みやすい距離文字列 (例: "1.2km", "500m")
 */
export const calculateDistance = (lat1?: number, lon1?: number, lat2?: number, lon2?: number): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    return 0; // 必要なデータがない場合は0を返す
  }

  // 緯度経度をラジアンに変換
  const p = 0.017453292519943295; // Math.PI / 180
  const a = 0.5 - Math.cos((lat2 - lat1) * p)/2 + 
          Math.cos(lat1 * p) * Math.cos(lat2 * p) * 
          (1 - Math.cos((lon2 - lon1) * p))/2;

  // 地球の半径は約6371kmなので、2 * R * asin(sqrt(a))で距離を求める
  const distance = 12742 * Math.asin(Math.sqrt(a)); // 2 * 6371
  
  // 距離を小数点以下2桁で返す
  return Number(distance.toFixed(2));
};

/**
 * 指定された住所から緯度経度を取得します（将来的にはGeocodingAPIを使用）
 * @param address 住所
 * @returns Promise<{latitude: number, longitude: number}>
 */
export const getCoordinatesFromAddress = async (
  address: string
): Promise<{ latitude: number; longitude: number }> => {
  // 実際の実装ではGoogle MapsのGeocodingAPIなどを使用します
  // ここではダミーデータを返します
  return new Promise((resolve) => {
    setTimeout(() => {
      // 東京の座標をデフォルトとして返す
      resolve({
        latitude: 35.6812362,
        longitude: 139.7649361,
      });
    }, 1000);
  });
};

/**
 * 現在位置を取得します
 * モックデータを返します（実際の実装では Geolocation API を使用）
 * @returns Promise<{latitude: number, longitude: number}>
 */
export const getCurrentLocation = (): Promise<{
  latitude: number;
  longitude: number;
}> => {
  // 実際の実装ではGeolocation APIを使用します
  // Geolocation.getCurrentPosition(...)
  
  // ここではダミーデータを返します
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        latitude: 35.6812362,
        longitude: 139.7649361,
      });
    }, 1000);
  });
}; 