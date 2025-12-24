/**
 * Complete Example - Demonstrates full Firebase stack usage
 * 
 * This file shows how to use all Firebase services together
 * in a real-world scenario
 */

import { initializeFirebase } from '../index';
import { authService } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';
import { postRepository } from '../repositories/post.repository';
import { realtimeDatabaseService } from '../services/realtime-db.service';
import { logger } from '../utils/logger';

/**
 * Complete application flow example
 */
export async function runCompleteExample() {
  try {
    // 1. Initialize Firebase
    initializeFirebase();
    logger.info('Firebase initialized');

    // 2. Authentication Flow
    logger.info('\n=== AUTHENTICATION FLOW ===');

    // Sign up
    const signUpResult = await authService.signUp(
      'demo@example.com',
      'SecurePassword123!',
      'Demo User'
    );
    logger.info('✅ User signed up:', signUpResult.user.uid);

    // Sign in
    const signInResult = await authService.signIn('demo@example.com', 'SecurePassword123!');
    logger.info('✅ User signed in:', signInResult.user.uid);

    const userId = signInResult.user.uid;

    // 3. Firestore Operations
    logger.info('\n=== FIRESTORE OPERATIONS ===');

    // Create user document
    const user = await userRepository.createUser(userId, {
      email: signInResult.user.email || 'demo@example.com',
      displayName: 'Demo User',
      role: 'user',
    });
    logger.info('✅ User document created:', user.id);

    // Create posts
    const post1 = await postRepository.createPost({
      userId,
      title: 'Getting Started with Firebase',
      content: 'Firebase is a powerful platform for building mobile and web applications...',
      category: 'tutorial',
      tags: ['firebase', 'tutorial', 'getting-started'],
    });
    logger.info('✅ Post 1 created:', post1.id);

    const post2 = await postRepository.createPost({
      userId,
      title: 'TypeScript Best Practices',
      content: 'TypeScript provides type safety and better developer experience...',
      category: 'tutorial',
      tags: ['typescript', 'best-practices'],
    });
    logger.info('✅ Post 2 created:', post2.id);

    // Query posts
    const userPosts = await postRepository.findByUserId(userId);
    logger.info(`✅ Found ${userPosts.length} posts by user`);

    const tutorialPosts = await postRepository.findByCategory('tutorial');
    logger.info(`✅ Found ${tutorialPosts.length} tutorial posts`);

    // Update post
    await postRepository.updatePost(post1.id, {
      title: 'Getting Started with Firebase (Updated)',
    });
    logger.info('✅ Post updated');

    // Increment likes
    await postRepository.incrementLikes(post1.id);
    await postRepository.incrementLikes(post1.id);
    logger.info('✅ Post likes incremented');

    // 4. Realtime Database Operations
    logger.info('\n=== REALTIME DATABASE OPERATIONS ===');

    // Update presence
    await realtimeDatabaseService.updatePresence(userId, 'online');
    logger.info('✅ Presence set to online');

    // Create messages
    const message1 = await realtimeDatabaseService.createMessage({
      userId,
      text: 'Hello, everyone!',
      roomId: 'general',
    });
    logger.info('✅ Message 1 created:', message1.id);

    const message2 = await realtimeDatabaseService.createMessage({
      userId,
      text: 'How is everyone doing?',
      roomId: 'general',
    });
    logger.info('✅ Message 2 created:', message2.id);

    // Read messages
    const messages = await realtimeDatabaseService.read<any>('messages');
    logger.info('✅ Messages read from database');

    // 5. Real-time Listeners
    logger.info('\n=== REAL-TIME LISTENERS ===');

    // Listen to presence changes
    const presenceUnsubscribe = realtimeDatabaseService.onValueChange(
      `presence/${userId}`,
      (presence) => {
        logger.info('📡 Presence changed:', presence);
      }
    );

    // Listen to room messages
    const messagesUnsubscribe = realtimeDatabaseService.listenToRoomMessages(
      'general',
      (message) => {
        logger.info('📡 New message received:', message.text);
      }
    );

    // Simulate some changes
    setTimeout(async () => {
      await realtimeDatabaseService.updatePresence(userId, 'away');
      logger.info('⏱️  Presence changed to away');
    }, 2000);

    setTimeout(async () => {
      await realtimeDatabaseService.createMessage({
        userId,
        text: 'This is a real-time message!',
        roomId: 'general',
      });
      logger.info('⏱️  New message sent');
    }, 3000);

    // Clean up listeners after 10 seconds
    setTimeout(() => {
      presenceUnsubscribe();
      messagesUnsubscribe();
      logger.info('✅ Listeners cleaned up');
    }, 10000);

    // 6. Cleanup (optional - for demo purposes)
    logger.info('\n=== CLEANUP ===');
    // In a real app, you might want to keep the data
    // await postRepository.delete(post1.id);
    // await postRepository.delete(post2.id);
    // await userRepository.delete(userId);
    // await authService.signOut();

    logger.info('\n✅ Complete example finished successfully!');
  } catch (error) {
    logger.error('❌ Error in complete example', error as Error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  runCompleteExample()
    .then(() => {
      logger.info('Example completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Example failed', error);
      process.exit(1);
    });
}

