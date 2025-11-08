export interface User {
  id: number;
  email: string;
  username: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  dateOfBirth?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  privacyLevel: string;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  userId: number;
  username: string;
  email: string;
}

export interface Circle {
  id: number;
  name: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  privacyLevel: string;
  membersCount: number;
  createdAt: string;
}

export interface Event {
  id: number;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  startTime: string;
  endTime?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  venue?: string;
  status: string;
  attendeesCount: number;
  maxAttendees?: number;
  createdAt: string;
}

export interface Post {
  id: number;
  content: string;
  author: User;
  visibility: string;
  tags?: string[];
  mediaUrls?: string[];
  latitude?: number;
  longitude?: number;
  location?: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  createdAt: string;
}

export interface Comment {
  id: number;
  content: string;
  author: User;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  displayName: string;
  dateOfBirth: string;
}
