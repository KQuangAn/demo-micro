import {
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue,
  off,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  query,
  orderByChild,
  orderByKey,
  orderByValue,
  limitToFirst,
  limitToLast,
  startAt,
  endAt,
  equalTo,
  Unsubscribe,
  DatabaseReference,
} from 'firebase/database';
import { firebaseConfig } from '@/config/firebase.config';
import { RealtimeDatabaseError, handleFirebaseError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { Message, CreateMessageDto, Presence } from '@/types';

/**
 * Realtime Database Service
 * Handles all Firebase Realtime Database operations
 * Provides real-time listeners and CRUD operations
 */
export class RealtimeDatabaseService {
  private database = firebaseConfig.getDatabase();

  /**
   * Write data to a path
   */
  async write<T>(path: string, data: T): Promise<void> {
    try {
      logger.debug(`Writing to path: ${path}`);

      const dbRef = ref(this.database, path);
      await set(dbRef, data);

      logger.info(`Data written to path: ${path}`);
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Write failed: ${path}`, firebaseError as Error);
      throw new RealtimeDatabaseError(
        `Failed to write data: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Read data from a path
   */
  async read<T>(path: string): Promise<T | null> {
    try {
      logger.debug(`Reading from path: ${path}`);

      const dbRef = ref(this.database, path);
      const snapshot = await get(dbRef);

      if (!snapshot.exists()) {
        logger.debug(`No data at path: ${path}`);
        return null;
      }

      return snapshot.val() as T;
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Read failed: ${path}`, firebaseError as Error);
      throw new RealtimeDatabaseError(
        `Failed to read data: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Update data at a path (merges with existing data)
   */
  async updateData(path: string, data: Partial<any>): Promise<void> {
    try {
      logger.debug(`Updating path: ${path}`);

      const dbRef = ref(this.database, path);
      await update(dbRef, data);

      logger.info(`Data updated at path: ${path}`);
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Update failed: ${path}`, firebaseError as Error);
      throw new RealtimeDatabaseError(
        `Failed to update data: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Delete data at a path
   */
  async delete(path: string): Promise<void> {
    try {
      logger.debug(`Deleting path: ${path}`);

      const dbRef = ref(this.database, path);
      await remove(dbRef);

      logger.info(`Data deleted at path: ${path}`);
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Delete failed: ${path}`, firebaseError as Error);
      throw new RealtimeDatabaseError(
        `Failed to delete data: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Push data to a list (generates unique key)
   */
  async push<T>(path: string, data: T): Promise<string> {
    try {
      logger.debug(`Pushing to path: ${path}`);

      const dbRef = ref(this.database, path);
      const newRef = push(dbRef);
      await set(newRef, data);

      logger.info(`Data pushed to path: ${path}`, { key: newRef.key });

      return newRef.key || '';
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Push failed: ${path}`, firebaseError as Error);
      throw new RealtimeDatabaseError(
        `Failed to push data: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Listen to value changes at a path
   */
  onValueChange<T>(
    path: string,
    callback: (data: T | null) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    try {
      logger.debug(`Setting up value listener: ${path}`);

      const dbRef = ref(this.database, path);

      return onValue(
        dbRef,
        (snapshot) => {
          const data = snapshot.exists() ? (snapshot.val() as T) : null;
          callback(data);
        },
        (error) => {
          const firebaseError = handleFirebaseError(error);
          logger.error(`Value listener error: ${path}`, firebaseError as Error);
          if (errorCallback) {
            errorCallback(firebaseError);
          }
        }
      );
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Failed to set up value listener: ${path}`, firebaseError as Error);
      throw new RealtimeDatabaseError(
        `Failed to set up listener: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Listen to child added events
   */
  onChildAdded<T>(
    path: string,
    callback: (data: T, key: string) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    try {
      logger.debug(`Setting up child added listener: ${path}`);

      const dbRef = ref(this.database, path);

      return onChildAdded(
        dbRef,
        (snapshot) => {
          if (snapshot.exists()) {
            callback(snapshot.val() as T, snapshot.key || '');
          }
        },
        (error) => {
          const firebaseError = handleFirebaseError(error);
          logger.error(`Child added listener error: ${path}`, firebaseError as Error);
          if (errorCallback) {
            errorCallback(firebaseError);
          }
        }
      );
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Failed to set up child added listener: ${path}`, firebaseError as Error);
      throw new RealtimeDatabaseError(
        `Failed to set up listener: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Create a message
   */
  async createMessage(data: CreateMessageDto): Promise<Message> {
    const message: Omit<Message, 'id'> = {
      userId: data.userId,
      text: data.text,
      timestamp: Date.now(),
      roomId: data.roomId,
    };

    const messageId = await this.push('messages', message);

    return {
      ...message,
      id: messageId,
    };
  }

  /**
   * Update user presence
   */
  async updatePresence(userId: string, status: Presence['status']): Promise<void> {
    const presence: Presence = {
      userId,
      status,
      lastSeen: Date.now(),
    };

    await this.write(`presence/${userId}`, presence);
  }

  /**
   * Listen to messages in a room
   */
  listenToRoomMessages(
    roomId: string,
    callback: (message: Message) => void,
    limitCount: number = 50
  ): Unsubscribe {
    const messagesRef = query(
      ref(this.database, `rooms/${roomId}/messages`),
      orderByChild('timestamp'),
      limitToLast(limitCount)
    );

    return onChildAdded(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({
          id: snapshot.key || '',
          ...snapshot.val(),
        });
      }
    });
  }
}

// Export singleton instance
export const realtimeDatabaseService = new RealtimeDatabaseService();

