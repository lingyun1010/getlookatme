begin;
set local search_path = extensions, public;
select plan(21);

select is((select relrowsecurity from pg_class where oid = 'public.knowledge_sources'::regclass), true, 'knowledge_sources RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.knowledge_chunks'::regclass), true, 'knowledge_chunks RLS enabled');
select policies_are('public', 'knowledge_sources', array[
  'Owners can create knowledge sources', 'Owners can delete knowledge sources',
  'Owners can read knowledge sources', 'Owners can update knowledge sources'
]);
select policies_are('public', 'knowledge_chunks', array[
  'Owners can create knowledge chunks', 'Owners can delete knowledge chunks',
  'Owners can read knowledge chunks', 'Owners can update knowledge chunks'
]);
select has_column('public', 'knowledge_sources', 'profile_id', 'sources carry profile identity');
select has_column('public', 'knowledge_chunks', 'profile_id', 'chunks carry profile identity');
select col_is_fk('public', 'knowledge_sources', 'profile_id', 'sources belong to profiles');
select ok(exists(select 1 from pg_constraint where conname = 'knowledge_chunks_source_profile_fk'), 'chunk source FK enforces the same profile');
select has_function('public', 'search_profile_knowledge', array['uuid', 'vector', 'integer'], 'profile-scoped search RPC exists');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'lingyun-knowledge@example.test', '', now(), '{}'::jsonb, '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'aaron-knowledge@example.test', '', now(), '{}'::jsonb, '{}'::jsonb);

insert into public.knowledge_sources (id, profile_id, source_type, source_ref, title, content_hash)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id, 'project', 'lingyun-project', 'Lingyun project', repeat('a', 64)
from public.profiles where user_id = '11111111-1111-4111-8111-111111111111';
insert into public.knowledge_sources (id, profile_id, source_type, source_ref, title, content_hash)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, 'project', 'aaron-project', 'Aaron project', repeat('b', 64)
from public.profiles where user_id = '22222222-2222-4222-8222-222222222222';

insert into public.knowledge_chunks (profile_id, source_id, chunk_index, content, embedding, source_type, source_ref, section, metadata, content_hash, embedding_version)
select profile_id, id, 0, title, array_fill(1::real, array[1536])::vector, source_type, source_ref, 'projects', '{}'::jsonb, content_hash, 'test-v1'
from public.knowledge_sources;

do $setup$
begin
  perform set_config('test.lingyun_profile_id', (select id::text from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'), true);
  perform set_config('test.aaron_profile_id', (select id::text from public.profiles where user_id = '22222222-2222-4222-8222-222222222222'), true);
end;
$setup$;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is((select count(*) from public.knowledge_sources), 1::bigint, 'Lingyun reads only Lingyun sources');
select is((select source_ref from public.knowledge_sources), 'lingyun-project', 'Lingyun cannot read Aaron source content');
select is((select count(*) from public.knowledge_chunks), 1::bigint, 'Lingyun reads only Lingyun chunks');
select is((select source_ref from public.knowledge_chunks), 'lingyun-project', 'Lingyun cannot read Aaron chunk content');
select is(
  (select count(*) from public.search_profile_knowledge(
    current_setting('test.aaron_profile_id')::uuid,
    array_fill(1::real, array[1536])::vector,
    5
  )),
  0::bigint,
  'Lingyun search cannot return Aaron knowledge even with Aaron profile id'
);
select is(
  (select count(*) from public.search_profile_knowledge(current_setting('test.lingyun_profile_id')::uuid, array_fill(1::real, array[1536])::vector, 5)),
  1::bigint,
  'Lingyun search returns Lingyun knowledge only'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is((select count(*) from public.knowledge_sources), 1::bigint, 'Aaron reads only Aaron sources');
select is((select source_ref from public.knowledge_sources), 'aaron-project', 'Aaron cannot read Lingyun source content');
select is((select count(*) from public.knowledge_chunks), 1::bigint, 'Aaron reads only Aaron chunks');
select is((select source_ref from public.knowledge_chunks), 'aaron-project', 'Aaron cannot read Lingyun chunk content');
select is(
  (select count(*) from public.search_profile_knowledge(
    current_setting('test.lingyun_profile_id')::uuid,
    array_fill(1::real, array[1536])::vector,
    5
  )),
  0::bigint,
  'Aaron search cannot return Lingyun knowledge even with Lingyun profile id'
);
select is(
  (select count(*) from public.search_profile_knowledge(current_setting('test.aaron_profile_id')::uuid, array_fill(1::real, array[1536])::vector, 5)),
  1::bigint,
  'Aaron search returns Aaron knowledge only'
);

select * from finish();
rollback;
