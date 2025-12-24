import { FirestoreRepository } from './firestore.repository';
import { Post, CreatePostDto, UpdatePostDto } from '@/types';
import { logger } from '@/utils/logger';

/**
 * Post Repository
 * Extends FirestoreRepository with post-specific operations
 */
export class PostRepository extends FirestoreRepository<Post> {
  constructor() {
    super('posts');
  }

  /**
   * Find posts by user
   */
  async findByUserId(userId: string, limitCount?: number): Promise<Post[]> {
    try {
      logger.debug('Finding posts by user ID', { userId });

      return this.findAll({
        where: [{ field: 'userId', operator: '==', value: userId }],
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit: limitCount,
      });
    } catch (error) {
      logger.error('Find by user ID failed', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Find posts by category
   */
  async findByCategory(category: string, limitCount?: number): Promise<Post[]> {
    try {
      logger.debug('Finding posts by category', { category });

      return this.findAll({
        where: [{ field: 'category', operator: '==', value: category }],
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit: limitCount,
      });
    } catch (error) {
      logger.error('Find by category failed', error as Error, { category });
      throw error;
    }
  }

  /**
   * Find posts by tags using array-contains-any
   * Returns posts that contain ANY of the specified tags
   * 
   * @param tags - Array of tags to search for
   * @param limitCount - Optional limit on number of results
   * @example
   * // Find posts with tags 'typescript' OR 'javascript' OR 'react'
   * const posts = await postRepository.findByTags(['typescript', 'javascript', 'react']);
   */
  async findByTags(tags: string[], limitCount?: number): Promise<Post[]> {
    try {
      if (!tags || tags.length === 0) {
        throw new Error('Tags array cannot be empty');
      }

      logger.debug('Finding posts by tags (array-contains-any)', { tags });

      return this.findAll({
        where: [
          {
            field: 'tags',
            operator: 'array-contains-any',
            value: tags,
          },
        ],
        orderBy: 'createdAt',
        orderDirection: 'desc',
        limit: limitCount,
      });
    } catch (error) {
      logger.error('Find by tags failed', error as Error, { tags });
      throw error;
    }
  }

  /**
   * Create post with defaults
   */
  async createPost(data: CreatePostDto): Promise<Post> {
    const now = new Date();
    const postData: Omit<Post, 'id'> = {
      userId: data.userId,
      title: data.title,
      content: data.content,
      category: data.category,
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
      likes: 0,
      views: 0,
    };

    // Generate ID automatically
    return this.create(postData);
  }

  /**
   * Update post
   */
  async updatePost(postId: string, data: UpdatePostDto): Promise<void> {
    const updateData: Partial<Post> = {
      ...data,
      updatedAt: new Date(),
    };

    return this.update(postId, updateData);
  }

  /**
   * Increment likes
   */
  async incrementLikes(postId: string): Promise<void> {
    const post = await this.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    return this.update(postId, { likes: post.likes + 1 });
  }

  /**
   * Increment views
   */
  async incrementViews(postId: string): Promise<void> {
    const post = await this.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    return this.update(postId, { views: post.views + 1 });
  }
}

// Export singleton instance
export const postRepository = new PostRepository();

