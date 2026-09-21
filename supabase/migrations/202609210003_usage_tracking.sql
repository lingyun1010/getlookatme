-- M3.0 server-recorded product and AI usage.

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid,
  event_type text not null check (event_type in ('cv_parse', 'avatar_generation', 'rag_query', 'embedding')),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  constraint usage_event_profile_owner_fk foreign key (profile_id, user_id)
    references public.profiles(id, user_id) on delete cascade
);

create index usage_events_user_month_idx on public.usage_events(user_id, created_at desc);
create index usage_events_profile_month_idx on public.usage_events(profile_id, created_at desc) where profile_id is not null;

alter table public.usage_events enable row level security;

revoke all on table public.usage_events from anon, authenticated;
grant select on table public.usage_events to authenticated;

create policy "Users can read their usage"
on public.usage_events for select to authenticated
using ((select auth.uid()) = user_id);
