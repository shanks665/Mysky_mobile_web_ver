export interface Event {
  id: string;
  title: string;
  description: string;
  photos: string[];
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  startDateTime: Date;
  endDateTime: Date;
  createdBy: string; // ユーザーID
  circle?: string; // サークルID（任意）
  participants: {
    userId: string;
    status: 'attending' | 'maybe' | 'declined';
  }[];
  maxParticipants?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventCreation {
  title: string;
  description: string;
  photos: string[];
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  startDateTime: Date;
  endDateTime: Date;
  circle?: string; // サークルID（任意）
  maxParticipants?: number;
}

export type ParticipationStatus = 'attending' | 'maybe' | 'declined'; 