-- PR5.2: optional, server-authoritative AI knowledge lifecycle.
alter table public.profiles
  add column ai_enabled boolean not null default false,
  add column ai_status text not null default 'off' check (ai_status in ('off', 'indexing', 'ready', 'stale', 'failed')),
  add column ai_last_indexed_at timestamptz,
  add column ai_last_error text;

alter table public.profiles add constraint profiles_ai_state_consistent check (
  (ai_enabled = false and ai_status = 'off') or
  (ai_enabled = true and ai_status in ('indexing', 'ready', 'stale', 'failed'))
);
