/**
 * Circle Model Tests
 * @format
 */

import { Circle, CircleCreation } from '../../src/models/Circle';
import { Timestamp, GeoPoint } from '@react-native-firebase/firestore';

// Mock Timestamp
const mockTimestamp = {
  toDate: () => new Date(),
  seconds: Date.now() / 1000,
  nanoseconds: 0,
} as Timestamp;

describe('Circle Model', () => {
  describe('Circle Interface', () => {
    it('validates complete circle object structure', () => {
      const circle: Circle = {
        id: 'circle123',
        name: 'Tokyo Tech Meetup',
        description: 'A community for tech enthusiasts in Tokyo',
        icon: 'https://example.com/icon.jpg',
        coverPhoto: 'https://example.com/cover.jpg',
        categories: ['technology', 'networking'],
        members: ['user1', 'user2', 'user3'],
        admins: ['user1'],
        pendingMembers: ['user4'],
        rejectedMembers: ['user5'],
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        createdBy: 'user1',
        location: new GeoPoint(35.6812, 139.7671),
        address: 'Tokyo, Japan',
        prefecture: 'tokyo',
        maxMembers: 100,
        isPrivate: false,
        rules: 'Be respectful and kind',
      };

      expect(circle.id).toBe('circle123');
      expect(circle.name).toBe('Tokyo Tech Meetup');
      expect(circle.members).toHaveLength(3);
      expect(circle.admins).toContain('user1');
      expect(circle.isPrivate).toBe(false);
    });

    it('validates minimal circle object', () => {
      const circle: Circle = {
        id: 'circle123',
        name: 'Simple Circle',
        description: 'A simple circle',
        categories: ['general'],
        members: ['user1'],
        admins: ['user1'],
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        createdBy: 'user1',
        isPrivate: true,
      };

      expect(circle.id).toBe('circle123');
      expect(circle.isPrivate).toBe(true);
      expect(circle.members).toHaveLength(1);
    });

    it('validates privacy settings', () => {
      const publicCircle: Circle = {
        id: 'circle1',
        name: 'Public Circle',
        description: 'Open to all',
        categories: ['public'],
        members: ['user1'],
        admins: ['user1'],
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        createdBy: 'user1',
        isPrivate: false,
      };

      const privateCircle: Circle = {
        id: 'circle2',
        name: 'Private Circle',
        description: 'Invite only',
        categories: ['private'],
        members: ['user1'],
        admins: ['user1'],
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        createdBy: 'user1',
        isPrivate: true,
      };

      expect(publicCircle.isPrivate).toBe(false);
      expect(privateCircle.isPrivate).toBe(true);
    });

    it('validates member management arrays', () => {
      const circle: Circle = {
        id: 'circle123',
        name: 'Test Circle',
        description: 'Testing member management',
        categories: ['test'],
        members: ['user1', 'user2'],
        admins: ['user1'],
        pendingMembers: ['user3', 'user4'],
        rejectedMembers: ['user5'],
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        createdBy: 'user1',
        isPrivate: true,
      };

      expect(circle.members).toHaveLength(2);
      expect(circle.admins).toHaveLength(1);
      expect(circle.pendingMembers).toHaveLength(2);
      expect(circle.rejectedMembers).toHaveLength(1);
      expect(circle.members).toContain('user1');
      expect(circle.admins).toContain('user1');
    });

    it('validates categories array', () => {
      const circle: Circle = {
        id: 'circle123',
        name: 'Multi-category Circle',
        description: 'Circle with multiple categories',
        categories: ['technology', 'business', 'networking', 'education'],
        members: ['user1'],
        admins: ['user1'],
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        createdBy: 'user1',
        isPrivate: false,
      };

      expect(circle.categories).toHaveLength(4);
      expect(circle.categories).toContain('technology');
      expect(circle.categories).toContain('networking');
    });
  });

  describe('CircleCreation Interface', () => {
    it('validates circle creation structure', () => {
      const circleCreation: CircleCreation = {
        name: 'New Circle',
        icon: 'https://example.com/icon.jpg',
        coverPhoto: 'https://example.com/cover.jpg',
        description: 'A new circle for testing',
        rules: 'Be nice',
        categories: ['test'],
        members: ['user1'],
        admins: ['user1'],
        createdBy: 'user1',
        createdAt: mockTimestamp,
        activityArea: 'Tokyo',
        location: {
          latitude: 35.6812,
          longitude: 139.7671,
          address: 'Tokyo, Japan',
        },
        isPrivate: false,
      };

      expect(circleCreation.name).toBe('New Circle');
      expect(circleCreation.createdBy).toBe('user1');
      expect(circleCreation.isPrivate).toBe(false);
      expect(circleCreation.location?.latitude).toBe(35.6812);
    });

    it('validates minimal circle creation', () => {
      const circleCreation: CircleCreation = {
        name: 'Minimal Circle',
        description: 'Minimal info',
        categories: ['general'],
        members: ['user1'],
        admins: ['user1'],
        createdBy: 'user1',
        createdAt: mockTimestamp,
        isPrivate: true,
      };

      expect(circleCreation.name).toBe('Minimal Circle');
      expect(circleCreation.isPrivate).toBe(true);
    });

    it('validates location data in creation', () => {
      const circleCreation: CircleCreation = {
        name: 'Location Circle',
        description: 'Circle with location',
        categories: ['local'],
        members: ['user1'],
        admins: ['user1'],
        createdBy: 'user1',
        createdAt: mockTimestamp,
        location: {
          latitude: 34.6937,
          longitude: 135.5023,
          address: 'Osaka, Japan',
        },
        isPrivate: false,
      };

      expect(circleCreation.location).toBeDefined();
      expect(circleCreation.location?.latitude).toBe(34.6937);
      expect(circleCreation.location?.longitude).toBe(135.5023);
      expect(circleCreation.location?.address).toBe('Osaka, Japan');
    });
  });
});
