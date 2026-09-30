-- migrate:up

-- Expo push tokens. The token identifies a device, so it is the key: if someone
-- else logs in on the same phone, the row moves to them instead of the old user
-- still getting their notifications. A user can have several devices.
create table push_tokens (
  token      text primary key,
  user_id    bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on push_tokens (user_id);

-- migrate:down

drop table push_tokens;
