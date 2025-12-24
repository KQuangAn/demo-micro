/**
 * Firebase Stack - Main Entry Point
 * 
 * This file demonstrates how to initialize and use all Firebase services
 */

import { firebaseConfig } from './config/firebase.config';
import { getEnvConfig } from './config/env.config';
import { authService } from './services/auth.service';
import { realtimeDatabaseService } from './services/realtime-db.service';
import { userRepository } from './repositories/user.repository';
import { postRepository } from './repositories/post.repository';
import { logger } from './utils/logger';

/**
 * Initialize Firebase
 */
export function initializeFirebase(): void {
  try {
    const env = getEnvConfig();
    
    firebaseConfig.initialize({
      apiKey: env.FIREBASE_API_KEY,
      authDomain: env.FIREBASE_AUTH_DOMAIN,
      projectId: env.FIREBASE_PROJECT_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
      appId: env.FIREBASE_APP_ID,
      databaseURL: env.FIREBASE_DATABASE_URL,
    });

    logger.info('Firebase initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Firebase', error as Error);
    throw error;
  }
}

/**
 * Example usage functions
 */
export async function exampleAuthFlow() {
  logger.info('=== Authentication Example ===');

  try {
    // Sign up a new user
    const signUpResult = await authService.signUp(
      'user@example.com',
      'password123',
      'John Doe'
    );
    logger.info('User signed up:', signUpResult.user);

    // Sign in
    const signInResult = await authService.signIn('user@example.com', 'password123');
    logger.info('User signed in:', signInResult.user);

    // Get current user
    const currentUser = authService.getCurrentUser();
    logger.info('Current user:', currentUser?.uid);

    // Update profile
    await authService.updateProfile('John Updated', 'https://example.com/photo.jpg');
    logger.info('Profile updated');

    // Get ID token
    const token = await authService.getIdToken();
    logger.info('ID token obtained');

    // Listen to auth state changes
    const unsubscribe = authService.onAuthStateChanged((user) => {
      logger.info('Auth state changed:', user ? user.uid : 'signed out');
    });

    // Clean up listener after 5 seconds (in real app, manage this properly)
    setTimeout(() => unsubscribe(), 5000);
  } catch (error) {
    logger.error('Auth flow error', error as Error);
  }
}

export async function exampleFirestoreFlow() {
  logger.info('=== Firestore Example ===');

  try {
    const userId = authService.getCurrentUser()?.uid || 'test-user-id';

    // Create user
    const user = await userRepository.createUser(userId, {
      email: 'user@example.com',
      displayName: 'John Doe',
      role: 'user',
    });
    logger.info('User created:', user);

    // Find user by ID
    const foundUser = await userRepository.findById(userId);
    logger.info('User found:', foundUser);

    // Update user
    await userRepository.updateUser(userId, {
      displayName: 'John Updated',
    });
    logger.info('User updated');

    // Create post
    const post = await postRepository.createPost({
      userId,
      title: 'My First Post',
      content: 'This is the content of my first post',
      category: 'general',
      tags: ['typescript', 'firebase'],
    });
    logger.info('Post created:', post);

    // Find posts by user
    const userPosts = await postRepository.findByUserId(userId);
    logger.info('User posts:', userPosts);

    // Find posts by category
    const categoryPosts = await postRepository.findByCategory('general');
    logger.info('Category posts:', categoryPosts);

    // Create additional posts with different tags for array-contains-any example
    const post2 = await postRepository.createPost({
      userId,
      title: 'React Tutorial',
      content: 'Learning React hooks',
      category: 'tutorial',
      tags: ['react', 'javascript', 'frontend'],
    });
    logger.info('Post 2 created:', post2);

    const post3 = await postRepository.createPost({
      userId,
      title: 'TypeScript Advanced',
      content: 'Advanced TypeScript patterns',
      category: 'tutorial',
      tags: ['typescript', 'programming'],
    });
    logger.info('Post 3 created:', post3);

    // Find posts by tags using array-contains-any
    // Returns posts that contain ANY of the specified tags
    const postsWithTags = await postRepository.findByTags(['react', 'typescript']);
    logger.info('Posts with tags (react OR typescript):', postsWithTags);
    logger.info(`Found ${postsWithTags.length} posts matching any of the tags`);

    // Increment likes
    await postRepository.incrementLikes(post.id);
    logger.info('Post likes incremented');

    // Paginated query
    const paginatedPosts = await postRepository.findPaginated({
      limit: 10,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });
    logger.info('Paginated posts:', paginatedPosts);
  } catch (error) {
    logger.error('Firestore flow error', error as Error);
  }
}

export async function exampleRealtimeDbFlow() {
  logger.info('=== Realtime Database Example ===');

  try {
    const userId = authService.getCurrentUser()?.uid || 'test-user-id';

    // Create message
    const message = await realtimeDatabaseService.createMessage({
      userId,
      text: 'Hello, Firebase!',
      roomId: 'room-1',
    });
    logger.info('Message created:', message);

    // Update presence
    await realtimeDatabaseService.updatePresence(userId, 'online');
    logger.info('Presence updated');

    // Read presence
    const presence = await realtimeDatabaseService.read<{ status: string }>(
      `presence/${userId}`
    );
    logger.info('Presence read:', presence);

    // Listen to value changes
    const unsubscribe = realtimeDatabaseService.onValueChange(
      `presence/${userId}`,
      (data) => {
        logger.info('Presence changed:', data);
      }
    );

    // Update presence to trigger listener
    setTimeout(async () => {
      await realtimeDatabaseService.updatePresence(userId, 'away');
    }, 2000);

    // Clean up listener
    setTimeout(() => unsubscribe(), 5000);

    // Listen to room messages
    const unsubscribeMessages = realtimeDatabaseService.listenToRoomMessages(
      'room-1',
      (message) => {
        logger.info('New message in room:', message);
      }
    );

    // Clean up message listener
    setTimeout(() => unsubscribeMessages(), 10000);
  } catch (error) {
    logger.error('Realtime DB flow error', error as Error);
  }
}

// Main execution (only if run directly)
if (require.main === module) {
  initializeFirebase();

  // Run examples (uncomment to test)
  // exampleAuthFlow();
  // exampleFirestoreFlow();
  // exampleRealtimeDbFlow();
}

// Export all services and repositories for use in other modules
export {
  firebaseConfig,
  authService,
  realtimeDatabaseService,
  userRepository,
  postRepository,
};

export * from './types';
export * from './utils/errors';
export * from './utils/logger';

