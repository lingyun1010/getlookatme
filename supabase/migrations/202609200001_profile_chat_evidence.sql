-- PR5: expose canonical source titles and row identity to the server-only profile chat boundary.

drop function public.search_profile_knowledge(uuid, extensions.vector, integer);

create function public.search_profile_knowledge(
  requested_profile_id uuid,
  query_embedding extensions.vector(1536),
  match_count integer default 5
)
returns table (
  profile_id uuid,
  chunk_id uuid,
  source_id uuid,
  content text,
  similarity double precision,
  source_type text,
  source_ref text,
  section text,
  source_title text,
  metadata jsonb
)
language sql
stable
strict
security invoker
set search_path = ''
as $$
  select
    kc.profile_id,
    kc.id,
    kc.source_id,
    kc.content,
    1 - (kc.embedding OPERATOR(extensions.<=>) query_embedding) as similarity,
    kc.source_type,
    kc.source_ref,
    kc.section,
    ks.title,
    kc.metadata
  from public.knowledge_chunks kc
  join public.knowledge_sources ks
    on ks.profile_id = kc.profile_id and ks.id = kc.source_id
  where kc.profile_id = requested_profile_id
  order by kc.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 50)
$$;

revoke all on function public.search_profile_knowledge(uuid, extensions.vector, integer) from public, anon;
grant execute on function public.search_profile_knowledge(uuid, extensions.vector, integer) to authenticated;
