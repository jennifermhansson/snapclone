import amqp, { type Channel, type ChannelModel } from 'amqplib'

// The Exchange from architecture.png. Every backend instance publishes here and
// every instance consumes from its own queue, so an event reaches a user no
// matter which instance that user's websocket is connected to.
//
//   publisher ──▶ topic exchange ──routing key──▶ queue of the instance(s)
//                                                 that have this user connected
//
// Each instance has ONE queue (exclusive + auto-delete: it dies with the
// instance's connection, so a crashed instance never leaves stale bindings
// behind). When a user connects, the instance binds that user's routing key to
// its queue; when the user's last socket on the instance closes, it unbinds.
//
// That binding table is also how we know who is offline: a message published
// with `mandatory` that matches no binding is handed back by the broker. Nobody
// is connected anywhere, so the caller can send a push notification instead.

const EXCHANGE = 'snap.events'

// What travels on the wire. `username` is in the body because the routing key
// is encoded (see routingKey) and so is not meant to be read back.
export type UserEvent = {
    username: string
    event: string
    payload: unknown
}

type DeliverHandler = (message: UserEvent) => void
type UnroutableHandler = (message: UserEvent) => void

let channel: Channel | null = null
let connection: ChannelModel | null = null
let queueName: string | null = null

// A user can be connected with several devices to the same instance. The
// routing key must stay bound until the last of them is gone.
const socketCounts = new Map<string, number>()

// Topic routing keys are dot-separated words, and `*` / `#` are wildcards. A
// username can contain any of those (registration does not restrict it), so it
// is base64url-encoded — that alphabet is only A-Z a-z 0-9 - _ — which keeps
// "anna.svensson" one word and a username of "#" from matching everyone.
function routingKey(username: string): string {
    return `message.user.${Buffer.from(username).toString('base64url')}`
}

export async function connectMessaging(
    onDeliver: DeliverHandler,
    onUnroutable: UnroutableHandler,
): Promise<void> {
    const url = process.env.RABBITMQ_URL
    if (!url) throw new Error('Set RABBITMQ_URL!')

    connection = await amqp.connect(url)

    // Fail fast. An instance that lost the broker is deaf: it would keep
    // accepting sockets that never receive anything. Exiting lets Docker's
    // restart policy bring up a fresh instance with fresh bindings.
    connection.on('error', (err) => {
        console.error('RabbitMQ connection error', err)
    })
    connection.on('close', () => {
        console.error('RabbitMQ connection closed, exiting')
        process.exit(1)
    })

    channel = await connection.createChannel()

    await channel.assertExchange(EXCHANGE, 'topic', { durable: true })

    // No name: the broker generates one, unique per instance.
    const queue = await channel.assertQueue('', { exclusive: true, autoDelete: true })
    queueName = queue.queue

    await channel.consume(
        queueName,
        (message) => {
            if (!message) return
            onDeliver(JSON.parse(message.content.toString()) as UserEvent)
        },
        { noAck: true },
    )

    // Sent back by the broker when a `mandatory` publish matched no queue.
    channel.on('return', (message) => {
        onUnroutable(JSON.parse(message.content.toString()) as UserEvent)
    })

    console.log(`Messaging connected, queue ${queueName}`)
}

// Call when a socket for this user connects to this instance.
export async function bindUser(username: string): Promise<void> {
    if (!channel || !queueName) return

    const count = socketCounts.get(username) ?? 0
    socketCounts.set(username, count + 1)

    // Only the first socket binds. Commands on one channel run in the order they
    // are issued, so a quick unbind + bind cannot be reordered.
    if (count === 0) {
        await channel.bindQueue(queueName, EXCHANGE, routingKey(username))
    }
}

// Call when a socket for this user disconnects from this instance.
export async function unbindUser(username: string): Promise<void> {
    if (!channel || !queueName) return

    const count = socketCounts.get(username) ?? 0
    if (count <= 1) {
        socketCounts.delete(username)
        await channel.unbindQueue(queueName, EXCHANGE, routingKey(username))
    } else {
        socketCounts.set(username, count - 1)
    }
}

// Fire-and-forget, like the socket emits it replaces: the data is already in
// Postgres, so a lost notification is found again over HTTP.
export function publishToUser(username: string, event: string, payload: unknown): void {
    if (!channel) return

    const body: UserEvent = { username, event, payload }

    channel.publish(EXCHANGE, routingKey(username), Buffer.from(JSON.stringify(body)), {
        contentType: 'application/json',
        mandatory: true,
    })
}
