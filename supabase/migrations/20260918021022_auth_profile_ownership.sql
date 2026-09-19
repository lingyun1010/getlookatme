-- M2 auth, profile ownership, onboarding persistence, and storage boundaries.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  document jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists profiles_public_slug_idx on public.profiles(slug) where is_published;

create table if not exists public.onboarding_states (
  profile_id uuid primary key,
  user_id uuid not null,
  draft jsonb,
  cv_path text,
  original_photo_path text,
  avatar_frame_paths text[] not null default '{}',
  avatar_metadata jsonb not null default '{}'::jsonb,
  selected_avatar_mode text not null default 'original' check (selected_avatar_mode in ('original', 'dynamic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_profile_owner_fk foreign key (profile_id, user_id)
    references public.profiles(id, user_id) on delete cascade
);

create index if not exists onboarding_states_user_id_idx on public.onboarding_states(user_id);

alter table public.profiles enable row level security;
alter table public.onboarding_states enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.onboarding_states from anon, authenticated;
grant select on table public.profiles to anon;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.onboarding_states to authenticated;

create policy "Published profiles are publicly readable"
on public.profiles for select to anon
using (is_published = true);

create policy "Owners can read their profiles"
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id or is_published = true);

create policy "Owners can create profiles"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Owners can update profiles"
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Owners can delete profiles"
on public.profiles for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Owners can read onboarding state"
on public.onboarding_states for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Owners can create onboarding state"
on public.onboarding_states for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()))
);

create policy "Owners can update onboarding state"
on public.onboarding_states for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()))
);

create policy "Owners can delete onboarding state"
on public.onboarding_states for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger onboarding_states_set_updated_at before update on public.onboarding_states
for each row execute function public.set_updated_at();

create or replace function private.create_initial_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_profile_id uuid := gen_random_uuid();
begin
  insert into public.profiles (id, user_id, slug)
  values (new_profile_id, new.id, 'profile-' || replace(new_profile_id::text, '-', ''));
  insert into public.onboarding_states (profile_id, user_id)
  values (new_profile_id, new.id);
  return new;
end;
$$;

revoke all on function private.create_initial_profile_for_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.create_initial_profile_for_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-private-assets', 'profile-private-assets', false, 10485760, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp']),
  ('profile-public-assets', 'profile-public-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners can read private profile assets"
on storage.objects for select to authenticated
using (bucket_id = 'profile-private-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners can upload profile assets"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('profile-private-assets', 'profile-public-assets')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (bucket_id = 'profile-private-assets' or (storage.foldername(name))[3] = 'avatar-frames')
  and exists (
    select 1 from public.profiles p
    where p.id::text = (storage.foldername(name))[2]
      and p.user_id = (select auth.uid())
  )
);

create policy "Owners can update profile assets"
on storage.objects for update to authenticated
using (
  bucket_id in ('profile-private-assets', 'profile-public-assets')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (bucket_id = 'profile-private-assets' or (storage.foldername(name))[3] = 'avatar-frames')
)
with check (
  bucket_id in ('profile-private-assets', 'profile-public-assets')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (bucket_id = 'profile-private-assets' or (storage.foldername(name))[3] = 'avatar-frames')
);

create policy "Owners can delete profile assets"
on storage.objects for delete to authenticated
using (
  bucket_id in ('profile-private-assets', 'profile-public-assets')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
