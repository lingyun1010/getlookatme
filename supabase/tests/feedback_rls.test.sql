begin;
set local search_path = extensions, public;
select plan(10);

select has_table('public', 'beta_feedback', 'feedback table exists');
select is((select relrowsecurity from pg_class where oid = 'public.beta_feedback'::regclass), true, 'feedback RLS enabled');
select policies_are('public', 'beta_feedback', array['Owners can submit Beta feedback']);
select col_is_fk('public', 'beta_feedback', 'user_id', 'feedback belongs to an auth user');
select ok(exists(select 1 from pg_constraint where conname = 'beta_feedback_profile_owner_fk'), 'optional profile attribution enforces ownership');
select ok(has_table_privilege('authenticated', 'public.beta_feedback', 'INSERT'), 'authenticated users can submit feedback');
select ok(not has_table_privilege('authenticated', 'public.beta_feedback', 'SELECT'), 'users cannot read feedback rows');
select ok(not has_table_privilege('anon', 'public.beta_feedback', 'INSERT'), 'anonymous users cannot submit feedback');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'feedback-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'feedback-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select lives_ok(
  $$insert into public.beta_feedback (user_id, profile_id, category, message)
    select user_id, id, 'feedback', 'Useful Beta feedback'
    from public.profiles where user_id = '33333333-3333-4333-8333-333333333333'$$,
  'owner can submit feedback for their profile'
);
select throws_ok(
  $$insert into public.beta_feedback (user_id, category, message)
    values ('44444444-4444-4444-8444-444444444444', 'bug', 'Cross-user feedback')$$,
  '42501',
  'new row violates row-level security policy for table "beta_feedback"',
  'owner cannot attribute feedback to another user'
);

select * from finish();
rollback;
