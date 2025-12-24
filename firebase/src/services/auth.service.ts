import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User as FirebaseUser,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { firebaseConfig } from '@/config/firebase.config';
import { AuthenticationError, handleFirebaseError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { AuthUser, SignInResult } from '@/types';

/**
 * Authentication Service
 * Handles all Firebase Authentication operations
 * Follows service layer pattern with proper error handling
 */
export class AuthService {
  private auth = firebaseConfig.getAuth();

  /**
   * Get current authenticated user
   */
  getCurrentUser(): FirebaseUser | null {
    return this.auth.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.auth.currentUser !== null;
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, displayName?: string): Promise<SignInResult> {
    try {
      logger.info('Signing up user', { email });

      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      // Update display name if provided
      if (displayName) {
        await updateProfile(user, { displayName });
      }

      // Send email verification
      await sendEmailVerification(user);

      const token = await user.getIdToken();

      logger.info('User signed up successfully', { uid: user.uid });

      return {
        user: this.mapFirebaseUser(user),
        token,
      };
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error('Sign up failed', firebaseError as Error, { email });
      throw new AuthenticationError(
        `Sign up failed: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      logger.info('Signing in user', { email });

      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      const token = await user.getIdToken();

      logger.info('User signed in successfully', { uid: user.uid });

      return {
        user: this.mapFirebaseUser(user),
        token,
      };
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error('Sign in failed', firebaseError as Error, { email });
      throw new AuthenticationError(
        `Sign in failed: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      logger.info('Signing out user');
      await signOut(this.auth);
      logger.info('User signed out successfully');
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error('Sign out failed', firebaseError as Error);
      throw new AuthenticationError(
        `Sign out failed: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    try {
      logger.info('Sending password reset email', { email });
      await sendPasswordResetEmail(this.auth, email);
      logger.info('Password reset email sent successfully');
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error('Password reset failed', firebaseError as Error, { email });
      throw new AuthenticationError(
        `Password reset failed: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string, currentPassword?: string): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (!user || !user.email) {
        throw new AuthenticationError('No authenticated user found', 'auth/user-not-found');
      }

      // Re-authenticate if current password provided
      if (currentPassword) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      await updatePassword(user, newPassword);
      logger.info('Password updated successfully', { uid: user.uid });
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error('Password update failed', firebaseError as Error);
      throw new AuthenticationError(
        `Password update failed: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(displayName?: string, photoURL?: string): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new AuthenticationError('No authenticated user found', 'auth/user-not-found');
      }

      await updateProfile(user, { displayName, photoURL });
      logger.info('Profile updated successfully', { uid: user.uid });
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error('Profile update failed', firebaseError as Error);
      throw new AuthenticationError(
        `Profile update failed: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Get ID token (refreshes if expired)
   */
  async getIdToken(forceRefresh: boolean = false): Promise<string> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new AuthenticationError('No authenticated user found', 'auth/user-not-found');
      }

      return await user.getIdToken(forceRefresh);
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error('Get ID token failed', firebaseError as Error);
      throw new AuthenticationError(
        `Get ID token failed: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    return this.auth.onAuthStateChanged((firebaseUser) => {
      callback(firebaseUser ? this.mapFirebaseUser(firebaseUser) : null);
    });
  }

  /**
   * Map Firebase User to AuthUser
   */
  private mapFirebaseUser(user: FirebaseUser): AuthUser {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
    };
  }
}

// Export singleton instance
export const authService = new AuthService();

