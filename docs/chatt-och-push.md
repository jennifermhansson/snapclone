# Förslag: chatt och push (att posta i gruppchatten)

Nya endpoints, event och tabeller. Inga befintliga endpoints eller events ändras.

## Endpoints (alla kräver `Authorization: Bearer <access_token>`)

| Metod | Path | Body / query | Svar |
|---|---|---|---|
| POST | `/messages` | `{ "recipient_username": string, "body": string }` | `201` + `ApiMessage` |
| GET | `/messages/:username` | `?before=<id>&limit=<1-100>` (båda valfria, limit är 50 som standard) | `200` `{ "messages": ApiMessage[] }`, nyaste först |
| POST | `/push-token` | `{ "token": "ExponentPushToken[...]" }` | `204` |

```ts
type ApiMessage = {
  id: string;
  sender_username: string;
  recipient_username: string;
  body: string;        // 1–2000 tecken, trimmas
  created_at: string;  // ISO
}
```

Fel (samma format som övriga, `{ success, code, message }`):
- `400 You are not friends with <username>` om ni inte är vänner åt båda hållen (`mutual: true`). Gäller både att skicka och att läsa historik.
- `400 A message cannot be empty`, `400 A message can be at most 2000 characters`, `400 Invalid push token`.

## Websocket-event

| Event | Payload |
|---|---|
| `message_received` | `ApiMessage` (skickas till mottagaren) |

Klienten måste ansluta med `transports: ['websocket']` och `auth: { token }`. Servern accepterar inget annat.

## Tabeller

- `messages (id, sender_id, recipient_id, body, created_at)`: index på paret (minsta id, största id, id), så båda riktningarna läses i ett svep.
- `push_tokens (token primary key, user_id, created_at)`: token är nyckel, så en telefon som byter användare flyttar raden.

## Hur det hänger ihop

1. `POST /messages` kontrollerar vänskap, sparar i Postgres och publicerar på Exchange med routing key `message.user.<username>` (användarnamnet base64url-kodat, så punkter och `*`/`#` i ett namn inte kan bryta topic-routing).
2. Varje backend-instans har en egen kö och binder routing key för de användare som är anslutna till just den instansen. Instansen som äger anslutningen levererar till användarens socket.
3. Publiceras med `mandatory`. Om ingen instans har bundit nyckeln skickar RabbitMQ tillbaka meddelandet. Då är användaren offline och backend skickar en push via Expo.
4. De fyra befintliga eventen (`snap_received`, `friend_request`, `friend_accepted`, `screenshot_taken`) går samma väg, med oförändrade namn och payloads.
