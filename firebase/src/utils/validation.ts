import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Validation utilities using Zod
 * Provides type-safe validation schemas
 */

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  photoURL: z.string().url('Invalid URL').optional(),
  role: z.enum(['user', 'admin']).optional().default('user'),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  photoURL: z.string().url().optional(),
  role: z.enum(['user', 'admin']).optional(),
});

// Post validation schemas
export const createPostSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).optional().default([]),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

// Message validation schema
export const createMessageSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  text: z.string().min(1, 'Message text is required').max(1000),
  roomId: z.string().optional(),
});

/**
 * Validate data against a schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join('.')
      );
    }
    throw error;
  }
}

/**
 * Safe validation that returns result instead of throwing
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

