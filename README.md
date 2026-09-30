# Snap

```bash
cp .env.example .env     # fyll i de tre hemligheterna: openssl rand -hex 32
docker compose up --build
```

Bara Nginx är nåbar utifrån (port `PUBLIC_PORT`, standard 80). Backend, Postgres och RabbitMQ ligger på ett internt Docker-nätverk utan publicerade portar.

- **Antal backend-instanser:** `BACKEND_REPLICAS` i `.env` (standard 2). Ändra och kör `docker compose up -d` igen.
- **Frontend:** se `frontend/README.md`. Sätt `EXPO_PUBLIC_API_URL` till din dators LAN-adress (Nginx), utan `:3000`.
- **S3 ingår inte.** Utan S3-variablerna startar appen, men det går inte att skicka fotosnaps.
- **API-förslag för chatt och push:** `docs/chatt-och-push.md`.
