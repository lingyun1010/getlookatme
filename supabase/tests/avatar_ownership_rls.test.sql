begin;
set local search_path = extensions, public;
select plan(10);

select is((select relrowsecurity from pg_class where oid = 'public.avatars'::regclass), true, 'avatars RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.avatar_generation_jobs'::regclass), true, 'avatar jobs RLS enabled');
select policies_are('public', 'avatars', array[
  'Owners can delete inactive avatars', 'Owners can read avatars'
]);
select policies_are('public', 'avatar_generation_jobs', array[
  'Owners can create queued avatar jobs', 'Owners can read avatar jobs'
]);
select has_column('public', 'profiles', 'active_avatar_id', 'profiles selects one active generated avatar');
select col_is_fk('public', 'avatars', 'user_id', 'avatars are tied to auth users');
select col_is_fk('public', 'avatar_generation_jobs', 'user_id', 'jobs are tied to auth users');
select ok(exists(select 1 from pg_constraint where conname = 'profiles_active_avatar_owner_fk'), 'activation has composite ownership FK');
select ok(exists(select 1 from pg_constraint where conname = 'avatars_profile_owner_fk'), 'avatar has profile-owner FK');
select ok(exists(select 1 from pg_constraint where conname = 'avatar_jobs_profile_owner_fk'), 'job has profile-owner FK');

select * from finish();
rollback;
