/**
 * Application constants
 */

export const COLLECTIONS = {
  USERS: 'users',
  POSTS: 'posts',
  COMMENTS: 'comments',
  SETTINGS: 'userSettings',
} as const;

export const DATABASE_PATHS = {
  USERS: 'users',
  MESSAGES: 'messages',
  PRESENCE: 'presence',
  ROOMS: 'rooms',
} as const;

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export const PRESENCE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
} as const;

export const DEFAULT_PAGINATION = {
  LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const ERROR_CODES = {
  AUTH_REQUIRED: 'auth/required',
  AUTH_INVALID: 'auth/invalid',
  NOT_FOUND: 'not-found',
  VALIDATION_ERROR: 'validation-error',
  PERMISSION_DENIED: 'permission-denied',
} as const;

