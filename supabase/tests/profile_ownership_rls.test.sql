begin;
set local search_path = extensions, public;
select plan(9);

select policies_are('public', 'profiles', array[
  'Owners can create profiles', 'Owners can delete profiles', 'Owners can read their profiles',
  'Owners can update profiles', 'Published profiles are publicly readable'
]);
select policies_are('public', 'onboarding_states', array[
  'Owners can create onboarding state', 'Owners can delete onboarding state',
  'Owners can read onboarding state', 'Owners can update onboarding state'
]);
select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'profiles RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.onboarding_states'::regclass), true, 'onboarding RLS enabled');
select has_column('public', 'profiles', 'user_id', 'profiles has user_id');
select has_column('public', 'onboarding_states', 'profile_id', 'onboarding state has profile_id');
select col_is_fk('public', 'profiles', 'user_id', 'profiles.user_id references auth.users');
select col_is_unique('public', 'profiles', 'slug', 'profiles.slug is globally unique');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.onboarding_states'::regclass
      and conname = 'onboarding_profile_owner_fk'
      and contype = 'f'
  ),
  'onboarding state has composite profile-owner foreign key'
);

select * from finish();
rollback;
