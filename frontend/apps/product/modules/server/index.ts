'use server';

import { getAuth } from '@repo/auth';
import { revalidatePath } from 'next/cache';

export async function getCurrentUser() {
  const session = await getAuth();
  return session;
}

export async function invalidatePath(path: string, type?: 'layout' | 'page') {
  return revalidatePath(path, type);
}
