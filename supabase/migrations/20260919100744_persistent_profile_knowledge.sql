-- PR4: persistent, profile-scoped knowledge storage and retrieval foundation.

create extension if not exists vector with schema extensions;

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type ~ '^[a-z][a-z0-9_]{0,62}$'),
  source_ref text not null check (length(source_ref) between 1 and 512),
  title text not null check (length(title) between 1 and 500),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('active', 'stale', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, source_type, source_ref),
  unique (profile_id, id)
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(content) > 0),
  embedding extensions.vector(1536) not null,
  source_type text not null check (source_type ~ '^[a-z][a-z0-9_]{0,62}$'),
  source_ref text not null check (length(source_ref) between 1 and 512),
  section text not null check (length(section) between 1 and 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  embedding_version text not null check (length(embedding_version) between 1 and 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_chunks_source_profile_fk foreign key (profile_id, source_id)
    references public.knowledge_sources(profile_id, id) on delete cascade,
  unique (source_id, chunk_index)
);

create index knowledge_sources_profile_idx on public.knowledge_sources(profile_id);
create index knowledge_chunks_profile_idx on public.knowledge_chunks(profile_id);
create index knowledge_chunks_source_idx on public.knowledge_chunks(source_id);

create or replace function public.set_knowledge_source_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.content_hash is distinct from old.content_hash then
    new.version = old.version + 1;
  else
    new.version = old.version;
  end if;
  return new;
end;
$$;

create trigger knowledge_sources_set_version
before update on public.knowledge_sources
for each row execute function public.set_knowledge_source_version();

revoke all on function public.set_knowledge_source_version() from public, anon, authenticated;

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;

revoke all on table public.knowledge_sources from anon, authenticated;
revoke all on table public.knowledge_chunks from anon, authenticated;
grant select, insert, update, delete on table public.knowledge_sources to authenticated;
grant select, insert, update, delete on table public.knowledge_chunks to authenticated;

create policy "Owners can read knowledge sources"
on public.knowledge_sources for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
));

create policy "Owners can create knowledge sources"
on public.knowledge_sources for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
));

create policy "Owners can update knowledge sources"
on public.knowledge_sources for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
));

create policy "Owners can delete knowledge sources"
on public.knowledge_sources for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
));

create policy "Owners can read knowledge chunks"
on public.knowledge_chunks for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
));

create policy "Owners can create knowledge chunks"
on public.knowledge_chunks for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
));

create policy "Owners can update knowledge chunks"
on public.knowledge_chunks for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
));

create policy "Owners can delete knowledge chunks"
on public.knowledge_chunks for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = profile_id and p.user_id = (select auth.uid())
));

create trigger knowledge_sources_set_updated_at
before update on public.knowledge_sources
for each row execute function public.set_updated_at();

create trigger knowledge_chunks_set_updated_at
before update on public.knowledge_chunks
for each row execute function public.set_updated_at();

create or replace function public.search_profile_knowledge(
  requested_profile_id uuid,
  query_embedding extensions.vector(1536),
  match_count integer default 5
)
returns table (
  chunk_id uuid,
  source_id uuid,
  content text,
  similarity double precision,
  source_type text,
  source_ref text,
  section text,
  metadata jsonb
)
language sql
stable
strict
security invoker
set search_path = ''
as $$
  select
    kc.id,
    kc.source_id,
    kc.content,
    1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding) as similarity,
    kc.source_type,
    kc.source_ref,
    kc.section,
    kc.metadata
  from public.knowledge_chunks kc
  where kc.profile_id = requested_profile_id
  order by kc.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 50)
$$;

revoke all on function public.search_profile_knowledge(uuid, extensions.vector, integer) from public, anon;
grant execute on function public.search_profile_knowledge(uuid, extensions.vector, integer) to authenticated;
