# Snap — frontend

Expo (SDK 54) + expo-router. Runs in **Expo Go** — no dev build needed.

```bash
bun install
bunx expo start
```

Test on a phone, not the web. `react-native-maps` has no web implementation (there
is a fallback screen so the web bundle still builds) and the backend has no CORS.

## Two things that will bite you

**1. Route types are generated, and they're gitignored.**
`typedRoutes` is on, so every `href` is typechecked against `.expo/types/router.d.ts`
— which lives in gitignored `.expo/` and is written by the dev server. After pulling
a branch that adds a route, `bunx tsc --noEmit` will report errors on perfectly valid
paths until you have started the dev server once:

```bash
bunx expo start      # regenerates .expo/types/router.d.ts, then Ctrl-C
bunx tsc --noEmit
```

**2. `localhost` means the phone, not your Mac.**
Copy `.env.example` to `.env` and put your machine's LAN address in it
(`ipconfig getifaddr en0`). Requests that hang forever with no error are almost
always this.

## Architecture

```
lib/          the ONLY place that talks to the backend. No fetch outside here.
contexts/     auth-context.tsx — session state
hooks/        use-api.ts — the single place a 401 becomes a logout
app/          routes (every file here is a screen)
components/   UI, all composed from components/ui/*
constants/    design.ts (tokens) + strings.ts (all Swedish copy)
```

`lib/api.ts` is two lines. It re-exports `api.mock` today; on Wednesday change that
one line to `./api.real` and nothing else in the app changes — both modules export
the same names with the same signatures.

**Rules the assignment binds us to**, worth re-reading before you change `lib/`:
- Never change field names, status codes or URLs.
- Never call `fetch` outside `lib/`.
- Error `message` strings come from the backend and are rendered **verbatim**. Our
  Swedish copy goes on the line above, never interpolated into the server's text.

### Navigation

Three layers, which is what lets the preview render *over* the camera:

```
app/_layout.tsx           auth gate (Stack.Protected)
  (auth)/                 login, register
  (app)/_layout.tsx       Stack — preview, send-snap, add-friend, chat sit here
    (tabs)/_layout.tsx    the swipe pager
      map ← chats ← index (CAMERA, anchor) → friends
```

Because `/preview` is a route above the pager rather than state inside the camera
screen, the camera stays mounted underneath — discarding a photo is `router.back()`
onto a screen that never held a photo.

### Trying the mock's error paths

The mock returns the real backend's messages. To see each one:

| Do this | You get |
| --- | --- |
| register as `taken` | `409 User already exists` |
| register as `boom` | `500 Unknown error` |
| log in as `nobody` | `404 User not found` |
| log in with password `wrong` | `401 Invalid password!` |
| add yourself | `400 You can't add yourself as a friend` |
| add `nobody` | `404 User not found` |
| add `anna` | `status: friends` (vs `pending` for anyone else) |
| accept `dave`'s request | `status: friends` — there is no accept endpoint |
| send a snap to `kalle` | `400 You are not friends with kalle` |
| remove a mutual friend | they come back as an incoming request |

Seed friends: `moises` and `sara` (mutual), `kalle` (pending).
Incoming requests: `dave`, `nour`.

Mock state lives at module scope, so it resets on reload and on Fast Refresh of
`lib/api.mock.ts`. A friend "disappearing" right after you edit that file is Metro,
not a bug.

## Before pushing

```bash
bun run lint
bunx tsc --noEmit
```
