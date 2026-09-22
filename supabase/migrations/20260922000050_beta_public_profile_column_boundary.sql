-- M3.1: published profiles remain anonymous-readable without exposing owner-only columns.

revoke select on table public.profiles from anon;
grant select (id, slug, document, is_published, ai_enabled, ai_status)
on table public.profiles to anon;
