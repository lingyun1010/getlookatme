-- PR #3: persistent avatar assets, explicit activation, and durable generation jobs.

create table if not exists public.avatar_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  source_photo_path text not null,
  style text not null check (style in ('felt@1', 'cartoon@1', 'cinematic-3d@1', 'anime@1')),
  preset text not null check (preset in ('fast', 'balanced', 'smooth')),
  status text not null default 'queued' check (status in ('queued', 'generating', 'ready', 'failed')),
  avatar_id uuid,
  error text,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint avatar_jobs_profile_owner_fk foreign key (profile_id, user_id)
    references public.profiles(id, user_id) on delete cascade
);

create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  generation_job_id uuid not null unique references public.avatar_generation_jobs(id) on delete restrict,
  source_photo_path text not null,
  style text not null,
  preset text not null check (preset in ('fast', 'balanced', 'smooth')),
  preview_path text,
  center_frame_path text not null,
  frame_paths text[] not null default '{}',
  frame_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id, profile_id),
  constraint avatars_profile_owner_fk foreign key (profile_id, user_id)
    references public.profiles(id, user_id) on delete cascade
);

alter table public.avatar_generation_jobs
  add constraint avatar_jobs_avatar_fk foreign key (avatar_id, user_id, profile_id)
  references public.avatars(id, user_id, profile_id) on delete set null (avatar_id);

alter table public.profiles add column if not exists active_avatar_id uuid;
alter table public.profiles add constraint profiles_active_avatar_owner_fk
  foreign key (active_avatar_id, user_id, id)
  references public.avatars(id, user_id, profile_id) on delete set null (active_avatar_id);

create index if not exists avatars_profile_created_idx on public.avatars(profile_id, created_at desc);
create index if not exists avatar_jobs_profile_created_idx on public.avatar_generation_jobs(profile_id, created_at desc);
create index if not exists avatar_jobs_claim_idx on public.avatar_generation_jobs(status, created_at);

alter table public.avatars enable row level security;
alter table public.avatar_generation_jobs enable row level security;
revoke all on table public.avatars from anon, authenticated;
revoke all on table public.avatar_generation_jobs from anon, authenticated;
grant select, delete on table public.avatars to authenticated;
grant select, insert on table public.avatar_generation_jobs to authenticated;

create policy "Owners can read avatars" on public.avatars for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Owners can delete inactive avatars" on public.avatars for delete to authenticated
using ((select auth.uid()) = user_id and not exists (
  select 1 from public.profiles p where p.id = profile_id and p.active_avatar_id = id
));

create policy "Owners can read avatar jobs" on public.avatar_generation_jobs for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Owners can create queued avatar jobs" on public.avatar_generation_jobs for insert to authenticated
with check (
  (select auth.uid()) = user_id and status = 'queued' and avatar_id is null and attempts = 0
  and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()))
);
create or replace function public.claim_avatar_generation_job(stale_after interval default interval '15 minutes')
returns public.avatar_generation_jobs
language plpgsql security definer set search_path = '' as $$
declare claimed public.avatar_generation_jobs;
begin
  select * into claimed from public.avatar_generation_jobs
  where status = 'queued' or (status = 'generating' and started_at < now() - stale_after)
  order by created_at
  for update skip locked limit 1;
  if claimed.id is null then return null; end if;
  update public.avatar_generation_jobs
  set status = 'generating', started_at = now(), completed_at = null, error = null, attempts = attempts + 1
  where id = claimed.id returning * into claimed;
  return claimed;
end;
$$;

revoke all on function public.claim_avatar_generation_job(interval) from public, anon, authenticated;
grant execute on function public.claim_avatar_generation_job(interval) to service_role;

create or replace function public.retry_avatar_generation_job(job_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.avatar_generation_jobs set status = 'queued', error = null, started_at = null, completed_at = null
  where id = job_id and user_id = (select auth.uid()) and status = 'failed';
  return found;
end;
$$;
revoke all on function public.retry_avatar_generation_job(uuid) from public, anon;
grant execute on function public.retry_avatar_generation_job(uuid) to authenticated;

-- Public rendering needs generated frame paths for an explicitly active avatar only.
create or replace function public.get_public_active_avatar(requested_slug text)
returns table (center_frame_path text, frame_paths text[], frame_metadata jsonb)
language sql stable security definer set search_path = '' as $$
  select a.center_frame_path, a.frame_paths, a.frame_metadata
  from public.profiles p join public.avatars a on a.id = p.active_avatar_id
  where p.slug = requested_slug and p.is_published = true and a.profile_id = p.id and a.user_id = p.user_id;
$$;
revoke all on function public.get_public_active_avatar(text) from public;
grant execute on function public.get_public_active_avatar(text) to anon, authenticated;
