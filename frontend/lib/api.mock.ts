/**
 * In-memory stand-in for the backend. Same exports, same signatures and the
 * same error messages as api.real.ts, so no screen can tell which it is using.
 *
 * State lives at module scope: it survives navigation and resets on reload.
 * README.md lists which usernames trigger which error.
 */
import {
  ApiError,
  type AddFriendResponse,
  type ApiFriend,
  type ApiFriendRequest,
  type AuthResponse,
  type SendSnapInput,
  type Tokens,
} from './api.types';

/** The mock's access token is just this prefix plus the username, so the
 *  signed-in user survives a restore from SecureStore with no extra state. */
const ACCESS_PREFIX = 'mock-access:';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

let tokens: Tokens | null = null;

const friends = new Map<string, ApiFriend>(
  [
    { username: 'moises', created_at: daysAgo(30), mutual: true },
    { username: 'sara', created_at: daysAgo(12), mutual: true },
    { username: 'kalle', created_at: daysAgo(2), mutual: false },
  ].map((friend) => [friend.username, friend]),
);

const incoming = new Map<string, ApiFriendRequest>(
  [
    { username: 'dave', created_at: daysAgo(1) },
    { username: 'nour', created_at: daysAgo(0.1) },
  ].map((request) => [request.username, request]),
);

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** 300–800 ms, so loading states are actually visible. */
function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));
}

/** The protected-endpoint guard: no token, no answer. Returns who is asking. */
function requireUser(): string {
  if (!tokens) throw new ApiError(401, 'You are not authorized');
  return tokens.access_token.slice(ACCESS_PREFIX.length);
}

function authResponse(username: string): AuthResponse {
  return {
    tokens: { access_token: `${ACCESS_PREFIX}${username}`, refresh_token: `mock-refresh:${username}` },
    user: { username, created_at: new Date().toISOString() },
  };
}

export function setTokens(next: Tokens | null): void {
  tokens = next;
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  await delay();
  if (username === 'boom') throw new ApiError(500, 'Unknown error');
  if (username === 'taken') throw new ApiError(409, 'User already exists');
  return authResponse(username);
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  await delay();
  if (username === 'nobody') throw new ApiError(404, 'User not found');
  if (password === 'wrong') throw new ApiError(401, 'Invalid password!');
  return authResponse(username);
}

export async function getFriends(): Promise<ApiFriend[]> {
  await delay();
  requireUser();
  // Copies, so a screen mutating its list can't reach into the mock's state.
  return [...friends.values()].map((friend) => ({ ...friend }));
}

export async function getFriendRequests(): Promise<ApiFriendRequest[]> {
  await delay();
  requireUser();
  return [...incoming.values()].map((request) => ({ ...request }));
}

export async function addFriend(friendUsername: string): Promise<AddFriendResponse> {
  await delay();
  const me = requireUser();

  if (friendUsername === me) throw new ApiError(400, "You can't add yourself as a friend");
  if (friendUsername === 'nobody') throw new ApiError(404, 'User not found');

  // Re-adding is a no-op on the backend too.
  const existing = friends.get(friendUsername);
  if (existing) return { status: existing.mutual ? 'friends' : 'pending' };

  // There is no accept endpoint: adding someone who already added you IS the
  // accept. 'anna' is the assignment's fixed "already added you" case.
  const mutual = incoming.has(friendUsername) || friendUsername === 'anna';
  incoming.delete(friendUsername);
  friends.set(friendUsername, { username: friendUsername, created_at: new Date().toISOString(), mutual });

  return { status: mutual ? 'friends' : 'pending' };
}

export async function deleteFriend(username: string): Promise<void> {
  await delay();
  requireUser();

  const friend = friends.get(username);
  friends.delete(username);

  // Only your edge goes. A mutual friend still has you added, so they come
  // back as an incoming request — same as the backend.
  if (friend?.mutual) incoming.set(username, { username, created_at: new Date().toISOString() });
}

export async function sendSnap(input: SendSnapInput): Promise<void> {
  await delay();
  requireUser();

  if (!ALLOWED_MIME_TYPES.includes(input.photo.mimetype)) {
    throw new ApiError(400, 'Only JPEG and PNG images are allowed');
  }
  if (input.recipients.length === 0) throw new ApiError(400, 'A snap needs at least one recipient');

  const notFriend = input.recipients.find((username) => !friends.get(username)?.mutual);
  if (notFriend) throw new ApiError(400, `You are not friends with ${notFriend}`);
}
