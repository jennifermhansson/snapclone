/**
 * Client-side checks, run before anything is sent. Each returns the Swedish
 * message to show under the field, or null when the input is fine.
 *
 * Only "is it filled in": the backend has no username or password rules, and
 * inventing some here would reject accounts it accepts.
 */
import { S } from '@/constants/strings';

export function validateCredentials(username: string, password: string): string | null {
  if (!username.trim() || !password) return S.validation.bothFields;
  return null;
}

export function validateUsername(username: string): string | null {
  if (!username.trim()) return S.validation.usernameRequired;
  return null;
}
