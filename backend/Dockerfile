FROM oven/bun:1

WORKDIR /app

# Dependencies first: this layer is cached until package.json or bun.lock change.
# devDependencies stay installed on purpose — dbmate (the migrate service) lives there.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# The official image ships an unprivileged `bun` user.
USER bun

# Documentation only. Nothing is published to the host: only nginx is reachable.
EXPOSE 3000

CMD ["bun", "run", "--sql-preconnect", "src/index.ts"]
