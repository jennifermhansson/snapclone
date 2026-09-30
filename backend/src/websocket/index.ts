import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import type { TokenPayload } from "../auth";
import { Unauthorized } from "../errors";
import { bindUser, connectMessaging, unbindUser } from "../messaging";
import { sendPushForUnroutable } from "../push";
import { setWebsocketServer, userRoom, type SnapSocketServer } from "./server";
import type {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
} from "./types";

async function websocket(httpServer: FastifyInstance) {
    const websocketServer: SnapSocketServer = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(httpServer.server, {
        // UPPGIFT.md, "Se upp: socket.io bakom round-robin", solution 1. Long-polling
        // needs several requests to land on the same instance, which round-robin
        // does not guarantee (400 Session ID unknown). A plain websocket is one
        // connection, so it stays on the instance that accepted it. Clients must
        // also set transports: ['websocket'] — a polling client now gets an error
        // straight away instead of failing at random.
        transports: ["websocket"],
    });

    setWebsocketServer(websocketServer);

    // Events arrive here from the Exchange — published by any instance, this one
    // included — and are delivered to the user's sockets on THIS instance.
    // The event name comes off the wire as a string, so it cannot be checked
    // against ServerToClientEvents here; the typed side is controllers.ts.
    await connectMessaging(
        ({ username, event, payload }) => {
            const room = websocketServer.to(userRoom(username)) as unknown as {
                emit(event: string, payload: unknown): void;
            };
            room.emit(event, payload);
        },
        sendPushForUnroutable,
    );

    console.log("Websocket initialized!");

    // Identity comes from the JWT and nowhere else. If the server trusted a
    // username out of an event payload, any client could claim to be anyone.
    //
    // This runs once, at the handshake — an access token that expires later
    // does not drop an already-open socket.
    websocketServer.use((socket, next) => {
        try {
            const payload = httpServer.jwt.verify<TokenPayload>(
                socket.handshake.auth.token,
            );

            if (payload.type !== "access") {
                throw new Unauthorized("Invalid token type");
            }

            socket.data.username = payload.username;
        } catch {
            // next() is called exactly once on this path. Calling it inside the
            // try as well would let a throw from next() itself run it twice.
            return next(new Unauthorized("You are not authorized"));
        }

        next();
    });

    // När en användare har anslutit.
    websocketServer.on("connection", async (socket) => {
        // The personal room is how services address this person by name without
        // tracking socket ids. Several devices join the same room; socket.io
        // removes each socket from it on disconnect.
        socket.join(userRoom(socket.data.username));

        console.log(`Websocket connected: ${socket.data.username}`);

        // No inbound event handlers: the socket is push-only and every write
        // goes over HTTP.

        socket.on("disconnect", (reason) => {
            console.log(
                `Websocket disconnected: ${socket.data.username} (${reason})`,
            );

            unbindUser(socket.data.username).catch((err) =>
                console.error("Failed to unbind user", err),
            );
        });

        // Tell the Exchange this instance wants this user's events. After the
        // disconnect listener is registered, so a socket that drops while this
        // awaits still gets unbound instead of leaking a count.
        try {
            await bindUser(socket.data.username);
        } catch (err) {
            console.error("Failed to bind user", err);
        }
    });

    httpServer.addHook("preClose", (done) => {
        // close all active connections on this server
        websocketServer.local.disconnectSockets(true);
        done();
    });
}

export default websocket
