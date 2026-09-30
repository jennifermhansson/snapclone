/**
 * Keeps the websocket open while someone is signed in. Mounted once, in the
 * (app) layout: that group only exists while `user` is set, so signing out
 * unmounts it and closes the socket — no explicit call from the auth context.
 */
import { useEffect } from 'react';

import { connectSocket, disconnectSocket } from '@/lib/socket';

export function useRealtime(): void {
  useEffect(() => {
    connectSocket();
    return disconnectSocket;
  }, []);
}
