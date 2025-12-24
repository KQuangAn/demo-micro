import { FirestoreRepository } from './firestore.repository';
import { User, CreateUserDto, UpdateUserDto } from '@/types';
import { logger } from '@/utils/logger';

/**
 * User Repository
 * Extends FirestoreRepository with user-specific operations
 */
export class UserRepository extends FirestoreRepository<User> {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      logger.debug('Finding user by email', { email });

      const users = await this.findAll({
        where: [{ field: 'email', operator: '==', value: email }],
        limit: 1,
      });

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error('Find by email failed', error as Error, { email });
      throw error;
    }
  }

  /**
   * Create user with validation
   */
  async createUser(userId: string, data: CreateUserDto): Promise<User> {
    const now = new Date();
    const userData: Omit<User, 'id'> = {
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      role: data.role || 'user',
      createdAt: now,
      updatedAt: now,
    };

    return this.create(userData, userId);
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: UpdateUserDto): Promise<void> {
    const updateData: Partial<User> = {
      ...data,
      updatedAt: new Date(),
    };

    return this.update(userId, updateData);
  }
}

// Export singleton instance
export const userRepository = new UserRepository();

