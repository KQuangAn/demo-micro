/**
 * Custom error classes for Firebase operations
 */

export class FirebaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'FirebaseError';
    Object.setPrototypeOf(this, FirebaseError.prototype);
  }
}

export class AuthenticationError extends FirebaseError {
  constructor(message: string, code: string = 'auth/error', originalError?: Error) {
    super(message, code, originalError);
    this.name = 'AuthenticationError';
  }
}

export class FirestoreError extends FirebaseError {
  constructor(message: string, code: string = 'firestore/error', originalError?: Error) {
    super(message, code, originalError);
    this.name = 'FirestoreError';
  }
}

export class RealtimeDatabaseError extends FirebaseError {
  constructor(message: string, code: string = 'database/error', originalError?: Error) {
    super(message, code, originalError);
    this.name = 'RealtimeDatabaseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error handler utility
 */
export function handleFirebaseError(error: unknown): FirebaseError {
  if (error instanceof FirebaseError) {
    return error;
  }

  if (error instanceof Error) {
    // Map Firebase error codes
    const errorCode = (error as any).code || 'unknown';
    const errorMessage = error.message || 'An unknown error occurred';

    if (errorCode.startsWith('auth/')) {
      return new AuthenticationError(errorMessage, errorCode, error);
    }
    if (errorCode.startsWith('firestore/')) {
      return new FirestoreError(errorMessage, errorCode, error);
    }
    if (errorCode.startsWith('database/')) {
      return new RealtimeDatabaseError(errorMessage, errorCode, error);
    }

    return new FirebaseError(errorMessage, errorCode, error);
  }

  return new FirebaseError('An unknown error occurred', 'unknown');
}

