begin;
set local search_path = extensions, public;
select plan(16);

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
select has_function('public', 'cancel_avatar_generation_job', array['uuid'], 'queued cancellation RPC exists');
select has_function('public', 'create_metered_avatar_job', array['uuid', 'uuid', 'text', 'text', 'text', 'integer'], 'metered Avatar job RPC exists');
select ok(not has_function_privilege('anon', 'public.create_metered_avatar_job(uuid,uuid,text,text,text,integer)', 'EXECUTE'), 'anonymous users cannot create metered Avatar jobs');
select ok(not has_function_privilege('authenticated', 'public.create_metered_avatar_job(uuid,uuid,text,text,text,integer)', 'EXECUTE'), 'authenticated users cannot supply their own Avatar limit');
select ok(has_function_privilege('service_role', 'public.create_metered_avatar_job(uuid,uuid,text,text,text,integer)', 'EXECUTE'), 'only the trusted service path can create metered Avatar jobs');
select has_index('public', 'avatar_generation_jobs', 'avatar_jobs_one_active_per_profile_idx', 'one active job index exists');

select * from finish();
rollback;
