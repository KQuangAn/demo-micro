'use server';
import { getAuth } from '@repo/auth';

export async function getCurrentUser() {
  const session = await getAuth();
  return session;
}
