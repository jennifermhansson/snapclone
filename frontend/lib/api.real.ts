/**
 * The real client. Same exports and signatures as api.mock.ts.
 *
 * Every non-2xx becomes `ApiError(status, body.message)`, or
 * `ApiError(status, 'Något gick fel')` when the body isn't the backend's JSON
 * error — the auth guard's own 401 is plain text, for one.
 *
 * A 401 on a protected call trades the refresh token for a fresh pair and
 * replays the request once. Only if that fails too does the 401 reach the
 * screen, where `useApi` turns it into a logout.
 */
import { S } from '@/constants/strings';

import {
  ApiError,
  type AddFriendResponse,
  type ApiFriend,
  type ApiFriendRequest,
  type ApiMessage,
  type AuthResponse,
  type SendSnapInput,
  type Tokens,
} from './api.types';

// `localhost` is the phone, not your Mac — see .env.example.
// It points at nginx, the only way into the backend — never at a single instance.
// The mock exports this as null, which is how lib/socket.ts knows there is no server.
export const API_BASE_URL: string | null = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost';

let tokens: Tokens | null = null;

/** Parallel calls that 401 together (getFriends + getFriendRequests) share one refresh. */
let refreshing: Promise<boolean> | null = null;

export function setTokens(next: Tokens | null): void {
  tokens = next;
}

/** For the websocket handshake, which authenticates with the access token. */
export function getAccessToken(): string | null {
  return tokens?.access_token ?? null;
}

/** For the websocket: its handshake is not an HTTP call we can replay, so when it
 *  is refused the socket asks for a fresh token pair here and reconnects. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= refreshTokens().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: object | FormData;
  /** false for login/register/refresh: no token sent, and a 401 is a real answer. */
  auth?: boolean;
};

function send(path: string, { method = 'GET', body, auth = true }: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (auth && tokens) headers.Authorization = `Bearer ${tokens.access_token}`;

  let payload: string | FormData | undefined;
  if (body instanceof FormData) {
    // No Content-Type: fetch sets it itself, multipart boundary included.
    payload = body;
  } else if (body !== undefined) {
    // Only with a body — Fastify rejects a JSON Content-Type with an empty one.
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  return fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });
}

async function refreshTokens(): Promise<boolean> {
  const current = tokens;
  if (!current) return false;

  try {
    const res = await send('/refresh', {
      method: 'POST',
      body: { refresh_token: current.refresh_token },
      auth: false,
    });
    if (!res.ok) return false;

    const body = (await res.json()) as { tokens: Tokens };
    // Signed out while this was in flight — don't bring the session back.
    if (tokens !== current) return false;

    // Memory only. The stored refresh token stays valid, so after a restart
    // the first 401 simply refreshes again.
    tokens = body.tokens;
    return true;
  } catch {
    return false;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    if (typeof body?.message === 'string') return new ApiError(res.status, body.message);
  } catch {
    // Not JSON — fall through.
  }
  return new ApiError(res.status, S.common.somethingWentWrong);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);

  if (res.status === 401 && options.auth !== false) {
    // .finally is always async, so it can't clear `refreshing` before it's assigned.
    if (await refreshSession()) res = await send(path, options);
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function register(username: string, password: string): Promise<AuthResponse> {
  return request('/register', { method: 'POST', body: { username, password }, auth: false });
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return request('/login', { method: 'POST', body: { username, password }, auth: false });
}

export async function getFriends(): Promise<ApiFriend[]> {
  const body = await request<{ friends: ApiFriend[] }>('/friends');
  return body.friends;
}

export async function getFriendRequests(): Promise<ApiFriendRequest[]> {
  const body = await request<{ requests: ApiFriendRequest[] }>('/friends/requests');
  return body.requests;
}

export function addFriend(friendUsername: string): Promise<AddFriendResponse> {
  return request('/friends', { method: 'POST', body: { friend_username: friendUsername } });
}

export async function deleteFriend(username: string): Promise<void> {
  await request(`/friends/${encodeURIComponent(username)}`, { method: 'DELETE' });
}

export async function sendSnap({ recipients, photo, text }: SendSnapInput): Promise<void> {
  const form = new FormData();
  // React Native's FormData takes a { uri, name, type } descriptor and streams
  // the file from disk; `type` becomes the part's mimetype on the backend.
  form.append('file', {
    uri: photo.uri,
    name: photo.mimetype === 'image/png' ? 'snap.png' : 'snap.jpg',
    type: photo.mimetype,
  } as unknown as Blob);
  // Multipart has no arrays; the backend accepts one field holding a JSON array.
  form.append('recipients', JSON.stringify(recipients));
  if (text) form.append('text', text);

  await request('/snaps', { method: 'POST', body: form });
}

/** Newest first. `before` is the id of the oldest message you already have. */
export async function getMessages(username: string, before?: string): Promise<ApiMessage[]> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  const body = await request<{ messages: ApiMessage[] }>(`/messages/${encodeURIComponent(username)}${query}`);
  return body.messages;
}

export function sendMessage(recipientUsername: string, body: string): Promise<ApiMessage> {
  return request('/messages', { method: 'POST', body: { recipient_username: recipientUsername, body } });
}

export async function savePushToken(token: string): Promise<void> {
  await request('/push-token', { method: 'POST', body: { token } });
}
