import { Timestamp, GeoPoint } from '@react-native-firebase/firestore';

export interface Circle {
  id: string;
  name: string;
  description: string;
  icon?: string;
  coverPhoto?: string;
  categories: string[];
  members: string[];
  admins: string[];
  pendingMembers?: string[];
  rejectedMembers?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  location?: GeoPoint;
  address?: string;
  prefecture?: string;
  maxMembers?: number;
  isPrivate: boolean;
  rules?: string;
}

export interface CircleCreation {
  name: string;
  icon?: string;
  coverPhoto?: string;
  description: string;
  rules?: string;
  categories: string[];
  members: string[];
  admins: string[];
  createdBy: string;
  createdAt: any;
  activityArea?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  isPrivate: boolean;
}

export interface CircleEvent {
  id: string;
  circleId: string;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  locationName?: string;
  prefecture?: string;
  city?: string;
  coverPhoto?: string;
  attendees: string[];
  pendingAttendees?: string[];
  requiresApproval: boolean;
  isPrivate: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  admins?: string[];
  status?: 'active' | 'canceled' | 'completed';
  canceledBy?: string;
  canceledAt?: Date;
  categories?: string[];
}

export interface CircleEventCreation {
  circleId: string;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  prefecture?: string;
  city?: string;
  coverPhoto?: string;
  categories?: string[];
  isPrivate: boolean;
}