/**
 * The persisted session: both tokens plus the user, as ONE SecureStore entry.
 * One key rather than several so a session can never be half-written — a crash
 * between two writes would otherwise restore tokens without a user.
 *
 * SecureStore has no web implementation; the app targets phones only.
 */
import * as SecureStore from 'expo-secure-store';

import type { ApiUser, Tokens } from './api.types';

export type StoredSession = { tokens: Tokens; user: ApiUser };

const KEY = 'snap.session';

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

/** Null when nothing is stored, or when what is stored can't be read — either
 *  way the app starts signed out rather than crashing on boot. */
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

/** Never throws — `signOut` promises the same. */
export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // The in-memory session is already gone; nothing more to do.
  }
}
