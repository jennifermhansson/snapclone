/**
 * The websocket. Like the rest of `lib/`, the only place that talks to the backend
 * this way — screens subscribe with `onMessageReceived`, they never see socket.io.
 *
 * `transports: ['websocket']` is not optional. socket.io otherwise starts with
 * HTTP long-polling, which needs several requests to reach the SAME backend
 * instance; nginx balances round-robin, so the next request usually lands on
 * another instance and fails with "400 Session ID unknown". A plain websocket is
 * one connection that stays where it was accepted. The price: no fallback on a
 * network that blocks websockets.
 */
import { io, type Socket } from 'socket.io-client';

import { API_BASE_URL, getAccessToken, refreshSession, type ApiMessage } from './api';

// How many times in a row a refused handshake may trigger refresh-and-retry.
const MAX_AUTH_RETRIES = 2;

let socket: Socket | null = null;
let authRetries = 0;

const messageListeners = new Set<(message: ApiMessage) => void>();
const connectListeners = new Set<() => void>();

export function connectSocket(): void {
  // null = the mock API: there is no server to connect to.
  if (!API_BASE_URL || socket) return;

  socket = io(API_BASE_URL, {
    transports: ['websocket'],
    // A function, so every (re)connect sends the CURRENT token, not the one from
    // the first connect — access tokens only live 15 minutes.
    auth: (send) => send({ token: getAccessToken() }),
  });

  socket.on('connect', () => {
    authRetries = 0;
    connectListeners.forEach((listener) => listener());
  });

  socket.on('message_received', (message: ApiMessage) => {
    messageListeners.forEach((listener) => listener(message));
  });

  socket.on('connect_error', async () => {
    const current = socket;
    // `active` is true while socket.io is retrying by itself (server down,
    // network gone). When it is false the server refused the handshake — the
    // token expired — and socket.io will not retry on its own.
    if (!current || current.active || authRetries >= MAX_AUTH_RETRIES) return;

    authRetries += 1;
    if (await refreshSession()) current.connect();
  });
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  authRetries = 0;
}

/** Returns an unsubscribe function, so it can be used directly as an effect cleanup. */
export function onMessageReceived(listener: (message: ApiMessage) => void): () => void {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

/** Fires on every (re)connect. A screen uses it to fetch what it missed while offline. */
export function onSocketConnect(listener: () => void): () => void {
  connectListeners.add(listener);
  return () => connectListeners.delete(listener);
}
