/**
 * User Service Tests
 * @format
 */

import firestore from '@react-native-firebase/firestore';
import { getUserById, fetchUsersInRadius, searchUsers } from '../../src/services/userService';
import { User } from '../../src/models/User';

// Mock Firestore
jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: () => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({
          exists: true,
          id: 'user123',
          data: () => ({
            nickname: 'Test User',
            email: 'test@example.com',
            location: {
              latitude: 35.6812,
              longitude: 139.7671,
              privacyLevel: 'public',
            },
            profilePhoto: 'https://example.com/photo.jpg',
            createdAt: { toDate: () => new Date('2024-01-01') },
            lastActive: { toDate: () => new Date('2024-01-15') },
            following: [],
            followers: [],
            circles: [],
            blockedUsers: [],
            accountPrivacy: 'public',
          }),
        })),
        set: jest.fn(),
        update: jest.fn(),
      })),
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      get: jest.fn(() => Promise.resolve({
        empty: false,
        docs: [
          {
            id: 'user1',
            data: () => ({
              nickname: 'User 1',
              email: 'user1@example.com',
              location: {
                latitude: 35.6812,
                longitude: 139.7671,
                privacyLevel: 'public',
              },
              createdAt: { toDate: () => new Date() },
              lastActive: { toDate: () => new Date() },
            }),
          },
        ],
        forEach: function(callback: any) {
          this.docs.forEach(callback);
        },
      })),
    })),
  }),
}));

describe('User Service', () => {
  describe('getUserById', () => {
    it('fetches user by ID successfully', async () => {
      const user = await getUserById('user123');
      expect(user).toBeDefined();
      expect(user?.id).toBe('user123');
      expect(user?.nickname).toBe('Test User');
    });

    it('handles non-existent user', async () => {
      const mockGet = jest.fn(() => Promise.resolve({
        exists: false,
      }));
      
      jest.spyOn(firestore(), 'collection').mockReturnValue({
        doc: jest.fn(() => ({
          get: mockGet,
        })) as any,
      } as any);

      const user = await getUserById('nonexistent');
      expect(user).toBeNull();
    });
  });

  describe('fetchUsersInRadius', () => {
    it('fetches users within specified radius', async () => {
      const center = { latitude: 35.6812, longitude: 139.7671 };
      const users = await fetchUsersInRadius(center, 5000);
      expect(Array.isArray(users)).toBe(true);
    });

    it('excludes specified user IDs', async () => {
      const center = { latitude: 35.6812, longitude: 139.7671 };
      const excludeIds = ['user1', 'user2'];
      const users = await fetchUsersInRadius(center, 5000, 50, excludeIds);
      
      users.forEach(user => {
        expect(excludeIds).not.toContain(user.userId);
      });
    });

    it('sorts users by distance', async () => {
      const center = { latitude: 35.6812, longitude: 139.7671 };
      const users = await fetchUsersInRadius(center, 10000);
      
      for (let i = 1; i < users.length; i++) {
        expect(users[i].numericDistance).toBeGreaterThanOrEqual(
          users[i - 1].numericDistance
        );
      }
    });
  });

  describe('searchUsers', () => {
    it('searches users by query', async () => {
      const results = await searchUsers('test');
      expect(Array.isArray(results)).toBe(true);
    });

    it('limits results to specified number', async () => {
      const limit = 5;
      const results = await searchUsers('user', limit);
      expect(results.length).toBeLessThanOrEqual(limit);
    });
  });
});
