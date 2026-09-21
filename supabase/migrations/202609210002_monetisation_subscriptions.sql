-- M3.0 plan and subscription state.

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'founding')),
  status text not null default 'free' check (status in ('free', 'active', 'trialing', 'past_due', 'cancelled')),
  provider text not null default 'mock' check (provider in ('mock', 'stripe')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;

create policy "Users can read their subscription"
on public.subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

insert into public.subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;

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
  return new;
end;
$$;

revoke all on function private.create_initial_profile_for_user() from public, anon, authenticated;
