/**
 * Distance Calculator Utility Tests
 * @format
 */

import { calculateDistance, calculateNumericDistance, obfuscateLocation, Coordinates } from '../../src/utils/distanceCalculator';

describe('Distance Calculator Utilities', () => {
  const tokyo: Coordinates = { latitude: 35.6812, longitude: 139.7671 };
  const osaka: Coordinates = { latitude: 34.6937, longitude: 135.5023 };
  const nearbyLocation: Coordinates = { latitude: 35.6895, longitude: 139.6917 };

  describe('calculateDistance', () => {
    it('calculates distance between two coordinates', () => {
      const distance = calculateDistance(tokyo, osaka);
      expect(distance).toBeDefined();
      expect(typeof distance).toBe('string');
    });

    it('returns zero for same coordinates', () => {
      const distance = calculateDistance(tokyo, tokyo);
      expect(parseFloat(distance)).toBe(0);
    });

    it('calculates short distances correctly', () => {
      const distance = calculateDistance(tokyo, nearbyLocation);
      const numericDistance = parseFloat(distance);
      expect(numericDistance).toBeGreaterThan(0);
      expect(numericDistance).toBeLessThan(10000); // Less than 10km
    });
  });

  describe('calculateNumericDistance', () => {
    it('returns numeric distance in meters', () => {
      const distance = calculateNumericDistance(tokyo, osaka);
      expect(typeof distance).toBe('number');
      expect(distance).toBeGreaterThan(0);
    });

    it('returns zero for identical coordinates', () => {
      const distance = calculateNumericDistance(tokyo, tokyo);
      expect(distance).toBe(0);
    });

    it('calculates consistent distances regardless of order', () => {
      const distance1 = calculateNumericDistance(tokyo, osaka);
      const distance2 = calculateNumericDistance(osaka, tokyo);
      expect(distance1).toBe(distance2);
    });
  });

  describe('obfuscateLocation', () => {
    it('reduces location precision for privacy', () => {
      const obfuscated = obfuscateLocation(tokyo, 'low');
      expect(obfuscated.latitude).not.toBe(tokyo.latitude);
      expect(obfuscated.longitude).not.toBe(tokyo.longitude);
    });

    it('applies different precision levels correctly', () => {
      const lowPrecision = obfuscateLocation(tokyo, 'low');
      const mediumPrecision = obfuscateLocation(tokyo, 'medium');
      const highPrecision = obfuscateLocation(tokyo, 'high');

      // Higher precision should be closer to original
      const distLow = Math.abs(lowPrecision.latitude - tokyo.latitude);
      const distMedium = Math.abs(mediumPrecision.latitude - tokyo.latitude);
      const distHigh = Math.abs(highPrecision.latitude - tokyo.latitude);

      expect(distLow).toBeGreaterThanOrEqual(distMedium);
      expect(distMedium).toBeGreaterThanOrEqual(distHigh);
    });

    it('returns coordinates within valid ranges', () => {
      const obfuscated = obfuscateLocation(tokyo);
      expect(obfuscated.latitude).toBeGreaterThanOrEqual(-90);
      expect(obfuscated.latitude).toBeLessThanOrEqual(90);
      expect(obfuscated.longitude).toBeGreaterThanOrEqual(-180);
      expect(obfuscated.longitude).toBeLessThanOrEqual(180);
    });

    it('uses medium precision by default', () => {
      const obfuscated1 = obfuscateLocation(tokyo);
      const obfuscated2 = obfuscateLocation(tokyo, 'medium');
      expect(obfuscated1.latitude).toBe(obfuscated2.latitude);
      expect(obfuscated1.longitude).toBe(obfuscated2.longitude);
    });
  });
});
