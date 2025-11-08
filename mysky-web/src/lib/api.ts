import axios from 'axios';
import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  Post,
  Circle,
  Event,
  PaginatedResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),
  register: (data: RegisterRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', data),
  logout: () => {
    localStorage.removeItem('token');
  },
};

// Users API
export const usersApi = {
  getMe: () => api.get<ApiResponse<User>>('/users/me'),
  getUser: (id: number) => api.get<ApiResponse<User>>(`/users/${id}`),
  updateUser: (id: number, data: Partial<User>) =>
    api.put<ApiResponse<User>>(`/users/${id}`, data),
  searchUsers: (query: string) =>
    api.get<ApiResponse<User[]>>(`/users/search?query=${query}`),
  getNearbyUsers: (lat: number, lng: number, radius: number) =>
    api.get<ApiResponse<User[]>>(
      `/users/nearby?latitude=${lat}&longitude=${lng}&radius=${radius}`
    ),
  followUser: (id: number) => api.post<ApiResponse<void>>(`/users/${id}/follow`),
  unfollowUser: (id: number) =>
    api.delete<ApiResponse<void>>(`/users/${id}/follow`),
  getFollowers: (id: number) =>
    api.get<ApiResponse<User[]>>(`/users/${id}/followers`),
  getFollowing: (id: number) =>
    api.get<ApiResponse<User[]>>(`/users/${id}/following`),
};

// Posts API
export const postsApi = {
  getFeed: (page: number = 0, size: number = 20) =>
    api.get<ApiResponse<PaginatedResponse<Post>>>(
      `/posts/feed?page=${page}&size=${size}`
    ),
  getPost: (id: number) => api.get<ApiResponse<Post>>(`/posts/${id}`),
  createPost: (data: { content: string; mediaUrls?: string[] }) =>
    api.post<ApiResponse<Post>>('/posts', data),
  updatePost: (id: number, data: { content: string }) =>
    api.put<ApiResponse<Post>>(`/posts/${id}`, data),
  deletePost: (id: number) => api.delete<ApiResponse<void>>(`/posts/${id}`),
  likePost: (id: number) => api.post<ApiResponse<void>>(`/posts/${id}/like`),
  unlikePost: (id: number) => api.delete<ApiResponse<void>>(`/posts/${id}/like`),
  getPostsByUser: (userId: number, page: number = 0, size: number = 20) =>
    api.get<ApiResponse<PaginatedResponse<Post>>>(
      `/posts/user/${userId}?page=${page}&size=${size}`
    ),
};

// Circles API
export const circlesApi = {
  getAll: () => api.get<ApiResponse<Circle[]>>('/circles'),
  getCircle: (id: number) => api.get<ApiResponse<Circle>>(`/circles/${id}`),
  createCircle: (data: Partial<Circle>) =>
    api.post<ApiResponse<Circle>>('/circles', data),
  updateCircle: (id: number, data: Partial<Circle>) =>
    api.put<ApiResponse<Circle>>(`/circles/${id}`, data),
  deleteCircle: (id: number) => api.delete<ApiResponse<void>>(`/circles/${id}`),
  searchCircles: (query: string) =>
    api.get<ApiResponse<Circle[]>>(`/circles/search?query=${query}`),
  getNearbyCircles: (lat: number, lng: number, radius: number) =>
    api.get<ApiResponse<Circle[]>>(
      `/circles/nearby?latitude=${lat}&longitude=${lng}&radius=${radius}`
    ),
  joinCircle: (id: number) => api.post<ApiResponse<void>>(`/circles/${id}/join`),
  leaveCircle: (id: number) =>
    api.delete<ApiResponse<void>>(`/circles/${id}/leave`),
  getMyCircles: () => api.get<ApiResponse<Circle[]>>('/circles/my-circles'),
};

// Events API
export const eventsApi = {
  getUpcoming: () => api.get<ApiResponse<Event[]>>('/events/upcoming'),
  getEvent: (id: number) => api.get<ApiResponse<Event>>(`/events/${id}`),
  createEvent: (data: Partial<Event>) =>
    api.post<ApiResponse<Event>>('/events', data),
  updateEvent: (id: number, data: Partial<Event>) =>
    api.put<ApiResponse<Event>>(`/events/${id}`, data),
  deleteEvent: (id: number) => api.delete<ApiResponse<void>>(`/events/${id}`),
  getNearbyEvents: (lat: number, lng: number, radius: number) =>
    api.get<ApiResponse<Event[]>>(
      `/events/nearby?latitude=${lat}&longitude=${lng}&radius=${radius}`
    ),
  attendEvent: (id: number) => api.post<ApiResponse<void>>(`/events/${id}/attend`),
  cancelAttendance: (id: number) =>
    api.delete<ApiResponse<void>>(`/events/${id}/attend`),
};

export default api;
