import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Cloud Functions Examples
 * Demonstrates various Firebase Cloud Functions patterns
 */

// HTTP Function - Simple API endpoint
export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info('Hello logs!', { structuredData: true });
  response.json({ message: 'Hello from Firebase Cloud Functions!' });
});

// HTTP Function with CORS
export const apiExample = functions.https.onRequest(async (request, response) => {
  // Enable CORS
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  try {
    const { name } = request.body;
    response.json({ message: `Hello ${name || 'World'}!` });
  } catch (error) {
    functions.logger.error('Error in apiExample', error);
    response.status(500).json({ error: 'Internal server error' });
  }
});

// Callable Function (better for client apps)
export const getUserData = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const userId = context.auth.uid;
  const { targetUserId } = data;

  try {
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(targetUserId || userId)
      .get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    return { user: userDoc.data() };
  } catch (error) {
    functions.logger.error('Error in getUserData', error);
    throw new functions.https.HttpsError('internal', 'Error fetching user data');
  }
});

// Firestore Trigger - onCreate
export const onUserCreate = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snapshot, context) => {
    const userData = snapshot.data();
    const userId = context.params.userId;

    functions.logger.info(`New user created: ${userId}`, userData);

    // Example: Send welcome email, create default settings, etc.
    try {
      // You can add additional logic here
      // e.g., send welcome email, create default collections, etc.
      await admin.firestore().collection('userSettings').doc(userId).set({
        notifications: true,
        theme: 'light',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Default settings created for user: ${userId}`);
    } catch (error) {
      functions.logger.error(`Error creating default settings for user ${userId}`, error);
    }
  });

// Firestore Trigger - onUpdate
export const onUserUpdate = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userId = context.params.userId;

    functions.logger.info(`User updated: ${userId}`, { before: beforeData, after: afterData });

    // Example: Track changes, update related documents, etc.
    if (beforeData.displayName !== afterData.displayName) {
      functions.logger.info(`User ${userId} changed display name`);
      // Update all posts by this user with new display name
      // This is just an example - in production, consider using batch writes
    }
  });

// Firestore Trigger - onDelete
export const onUserDelete = functions.firestore
  .document('users/{userId}')
  .onDelete(async (snapshot, context) => {
    const userId = context.params.userId;
    const userData = snapshot.data();

    functions.logger.info(`User deleted: ${userId}`, userData);

    // Example: Clean up related data
    try {
      // Delete user's posts (or mark as deleted)
      const postsSnapshot = await admin
        .firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .get();

      const batch = admin.firestore().batch();
      postsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      functions.logger.info(`Deleted ${postsSnapshot.docs.length} posts for user ${userId}`);
    } catch (error) {
      functions.logger.error(`Error cleaning up user data for ${userId}`, error);
    }
  });

// Realtime Database Trigger - onCreate
export const onMessageCreate = functions.database
  .ref('/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const messageData = snapshot.val();
    const messageId = context.params.messageId;

    functions.logger.info(`New message created: ${messageId}`, messageData);

    // Example: Send push notification, update counters, etc.
    try {
      // Update message count for the room
      if (messageData.roomId) {
        const roomRef = admin.database().ref(`rooms/${messageData.roomId}/messageCount`);
        await roomRef.transaction((current) => {
          return (current || 0) + 1;
        });
      }
    } catch (error) {
      functions.logger.error(`Error processing message ${messageId}`, error);
    }
  });

// Scheduled Function (Cron)
export const scheduledFunction = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    functions.logger.info('Scheduled function executed', context);

    // Example: Clean up old data, send reports, etc.
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

      const oldPostsSnapshot = await admin
        .firestore()
        .collection('posts')
        .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
        .where('views', '<', 10)
        .get();

      functions.logger.info(`Found ${oldPostsSnapshot.docs.length} old posts to archive`);
      // Archive or delete old posts
    } catch (error) {
      functions.logger.error('Error in scheduled function', error);
    }
  });

// Authentication Trigger - onUserCreate
export const onAuthUserCreate = functions.auth.user().onCreate(async (user) => {
  functions.logger.info(`New auth user created: ${user.uid}`, {
    email: user.email,
    displayName: user.displayName,
  });

  // Create user document in Firestore
  try {
    await admin.firestore().collection('users').doc(user.uid).set({
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      photoURL: user.photoURL,
      role: 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`User document created in Firestore: ${user.uid}`);
  } catch (error) {
    functions.logger.error(`Error creating user document for ${user.uid}`, error);
  }
});

// Authentication Trigger - onUserDelete
export const onAuthUserDelete = functions.auth.user().onDelete(async (user) => {
  functions.logger.info(`Auth user deleted: ${user.uid}`);

  // Clean up user data
  try {
    await admin.firestore().collection('users').doc(user.uid).delete();
    functions.logger.info(`User document deleted from Firestore: ${user.uid}`);
  } catch (error) {
    functions.logger.error(`Error deleting user document for ${user.uid}`, error);
  }
});

// HTTP Function with Authentication
export const protectedEndpoint = functions.https.onRequest(async (request, response) => {
  // Get ID token from Authorization header
  const idToken = request.headers.authorization?.split('Bearer ')[1];

  if (!idToken) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Fetch user data
    const userDoc = await admin.firestore().collection('users').doc(userId).get();

    if (!userDoc.exists) {
      response.status(404).json({ error: 'User not found' });
      return;
    }

    response.json({ user: userDoc.data() });
  } catch (error) {
    functions.logger.error('Error in protectedEndpoint', error);
    response.status(401).json({ error: 'Invalid token' });
  }
});

