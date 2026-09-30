-- migrate:up

-- One row per chat message. A conversation is the pair of users, in either
-- direction, so there is no separate conversations table.
create table messages (
  id           bigserial primary key,
  sender_id    bigint not null references users(id) on delete cascade,
  recipient_id bigint not null references users(id) on delete cascade,
  body         text not null check (length(body) between 1 and 2000),
  created_at   timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

-- History is read as "both directions between these two users, newest first".
-- Indexing the ordered pair makes A->B and B->A the same index range, and id as
-- the last column serves both the ORDER BY and the `before` cursor.
create index messages_conversation_idx
  on messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), id desc);

-- migrate:down

drop table messages;
