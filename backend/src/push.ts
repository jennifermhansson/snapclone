import * as repository from './repository'
import type { UserEvent } from './messaging'
import type { ApiMessage } from './http/types'

// Push notifications through Expo's push service. The backend never talks to
// Apple or Google directly: it hands Expo the device's token and Expo delivers.
// https://docs.expo.dev/push-notifications/sending-notifications/
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

type ExpoTicket = { status: 'ok' } | { status: 'error'; message: string; details?: { error?: string } }

// Called by the Exchange when an event matched no binding — that is, the user
// has no websocket on any instance, so they are offline. Only chat messages
// justify waking someone's phone; a missed snap or friend request is still in
// their inbox when they open the app.
export function sendPushForUnroutable({ username, event, payload }: UserEvent): void {
    if (event !== 'message_received') return

    const message = payload as ApiMessage

    // Fire-and-forget, like every notification here. A failed push must never
    // fail the request that sent the message.
    sendPush(username, message.sender_username, message.body).catch((err) => {
        console.error('Push failed', err)
    })
}

async function sendPush(username: string, title: string, body: string): Promise<void> {
    const tokens = await repository.getPushTokens(username)
    if (tokens.length === 0) return

    const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: 'default' }))),
    })

    if (!res.ok) throw new Error(`Expo push responded ${res.status}`)

    // One ticket per message, in the same order as the tokens we sent.
    const { data } = (await res.json()) as { data: ExpoTicket[] }

    for (const [index, ticket] of data.entries()) {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            // The app was uninstalled. Keeping the token only wastes requests.
            await repository.deletePushToken(tokens[index]!)
        }
    }
}
