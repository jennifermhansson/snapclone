import type { SnapRow } from '../repository/types'
import { publishToUser } from '../messaging'
import type { ApiMessage } from '../http/types'

// Every emit in the app goes through this file. Nothing else touches the socket
// server, so replacing socket.io with @fastify/websocket (UPPGIFT.md item 15)
// means rewriting this file and index.ts — and nothing in services.ts.
//
// Nothing is emitted directly any more: each function publishes to the Exchange,
// and whichever instance holds the recipient's socket delivers it (see
// messaging/index.ts and websocket/index.ts). The event names and payloads are
// the same as before — only the route to the socket changed.
//
// These are notifications, not delivery. The snap, friendship or message is
// already committed to Postgres by the time one is sent; a recipient who is
// offline finds it through GET /snaps, GET /friends/requests or
// GET /messages/:username instead. So publishing is fire-and-forget: never
// awaited, and it never throws into the request path.
//
// Payloads are plain objects — serialized once, on the wire to the Exchange.

export function sendSnapNotification(
    recipientUsername: string,
    snap: SnapRow,
    senderUsername: string
): void {
    publishToUser(recipientUsername, 'snap_received', {
        snap_id: snap.id,
        sender_username: senderUsername,
        type: snap.type,
        created_at: snap.created_at.toISOString(),
        expires_at: snap.expires_at.toISOString(),
    })
}

// Someone added you and you haven't added them back.
export function sendFriendRequestNotification(
    recipientUsername: string,
    fromUsername: string
): void {
    publishToUser(recipientUsername, 'friend_request', {
        from: fromUsername,
        created_at: new Date().toISOString(),
    })
}

// The second of the two directed edges just landed, so both sides go from
// pending to friends at the same moment and both need telling.
export function sendFriendAcceptedNotification(
    accepterUsername: string,
    otherUsername: string
): void {
    const createdAt = new Date().toISOString()

    publishToUser(accepterUsername, 'friend_accepted', {
        username: otherUsername,
        created_at: createdAt,
    })

    publishToUser(otherUsername, 'friend_accepted', {
        username: accepterUsername,
        created_at: createdAt,
    })
}

// Goes to the sender of the snap, not to the person who took the screenshot.
export function sendScreenshotNotification(
    senderUsername: string,
    snapId: string,
    byUsername: string
): void {
    publishToUser(senderUsername, 'screenshot_taken', {
        snap_id: snapId,
        by: byUsername,
        created_at: new Date().toISOString(),
    })
}

// A chat message. If the recipient has no socket on any instance the Exchange
// returns it unroutable, and push.ts sends a push notification instead.
export function sendMessageNotification(
    recipientUsername: string,
    message: ApiMessage
): void {
    publishToUser(recipientUsername, 'message_received', message)
}
