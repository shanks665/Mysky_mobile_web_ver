import * as geolib from 'geolib';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * 2点間の距離をメートル単位で計算する（ハーバーサイン公式使用）
 * @param coords1 - 始点の座標
 * @param coords2 - 終点の座標
 * @returns 2点間の距離（メートル）
 */
export const calculateDistance = (coords1: Coordinates, coords2: Coordinates): string => {
  // 地球の半径（メートル）
  const earthRadius = 6371000;

  // 緯度経度をラジアンに変換
  const lat1Rad = toRadians(coords1.latitude);
  const lat2Rad = toRadians(coords2.latitude);
  const deltaLat = toRadians(coords2.latitude - coords1.latitude);
  const deltaLng = toRadians(coords2.longitude - coords1.longitude);

  // ハーバーサイン公式
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;

  return distance.toFixed(0); // 整数のメートル単位で返す
};

/**
 * 度をラジアンに変換
 * @param degrees - 度
 * @returns ラジアン
 */
const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * 2点間の距離を計算し、数値(メートル)を返す
 */
export function calculateNumericDistance(coords1: Coordinates, coords2: Coordinates): number {
  return geolib.getDistance(coords1, coords2);
}

/**
 * プライバシー保護のため、位置情報の精度を下げる
 */
export function obfuscateLocation(coords: Coordinates, precisionLevel: 'low' | 'medium' | 'high' = 'medium'): Coordinates {
  // 精度レベルに応じて座標を丸める
  // low: 約1km程度の精度
  // medium: 約500m程度の精度
  // high: 約100m程度の精度
  
  const precision = {
    'low': 2,     // 小数点第2位まで（約1km程度）
    'medium': 3,  // 小数点第3位まで（約100m程度）
    'high': 4     // 小数点第4位まで（約10m程度）
  };
  
  const factor = Math.pow(10, precision[precisionLevel] || 2);
  
  return {
    latitude: Math.round(coords.latitude * factor) / factor,
    longitude: Math.round(coords.longitude * factor) / factor
  };
} 