-- M3.0 lightweight Beta funnel events.

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  event_type text not null check (event_type in (
    'signup_completed', 'cv_uploaded', 'cv_parsed', 'avatar_generated',
    'profile_published', 'public_profile_viewed', 'rag_question_asked',
    'upgrade_clicked', 'checkout_started', 'subscription_activated'
  )),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint analytics_event_profile_owner_fk foreign key (profile_id, user_id)
    references public.profiles(id, user_id) on delete cascade
);

create index analytics_events_user_created_idx on public.analytics_events(user_id, created_at desc);
create index analytics_events_type_created_idx on public.analytics_events(event_type, created_at desc);

alter table public.analytics_events enable row level security;

revoke all on table public.analytics_events from anon, authenticated;
grant select on table public.analytics_events to authenticated;

create policy "Users can read their analytics events"
on public.analytics_events for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.create_initial_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_profile_id uuid := gen_random_uuid();
begin
  insert into public.profiles (id, user_id, slug)
  values (new_profile_id, new.id, 'profile-' || replace(new_profile_id::text, '-', ''));
  insert into public.onboarding_states (profile_id, user_id)
  values (new_profile_id, new.id);
  insert into public.subscriptions (user_id)
  values (new.id);
  begin
    insert into public.analytics_events (user_id, profile_id, event_type)
    values (new.id, new_profile_id, 'signup_completed');
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function private.create_initial_profile_for_user() from public, anon, authenticated;
