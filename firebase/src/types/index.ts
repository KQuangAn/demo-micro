/**
 * Common types and interfaces for Firebase services
 */

// User types
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  displayName: string;
  photoURL?: string;
  role?: 'user' | 'admin';
}

export interface UpdateUserDto {
  displayName?: string;
  photoURL?: string;
  role?: 'user' | 'admin';
}

// Post types
export interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  likes: number;
  views: number;
}

export interface CreatePostDto {
  userId: string;
  title: string;
  content: string;
  category: string;
  tags?: string[];
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
}

// Comment types
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentDto {
  postId: string;
  userId: string;
  text: string;
}

// Message types (Realtime Database)
export interface Message {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
  roomId?: string;
}

export interface CreateMessageDto {
  userId: string;
  text: string;
  roomId?: string;
}

// Presence types
export interface Presence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
}

// Query options
export interface QueryOptions {
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  startAfter?: any;
  where?: Array<{
    field: string;
    operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any';
    value: any;
  }>;
}

// Repository result types
export interface RepositoryResult<T> {
  data: T | null;
  error: Error | null;
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  lastDoc?: any;
}

// Auth types
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export interface SignInResult {
  user: AuthUser;
  token: string;
}

