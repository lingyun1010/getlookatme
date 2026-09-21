-- M3.0.1 atomically enforce and record accepted Avatar generation usage.

create or replace function public.create_metered_avatar_job(
  requested_user_id uuid,
  requested_profile_id uuid,
  requested_source_photo_path text,
  requested_style text,
  requested_preset text,
  monthly_limit integer
)
returns setof public.avatar_generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_job public.avatar_generation_jobs;
  used integer;
begin
  if monthly_limit < 1 then
    raise exception 'AVATAR_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  perform 1 from public.subscriptions where user_id = requested_user_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = requested_profile_id and user_id = requested_user_id
  ) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select coalesce(sum(quantity), 0)::integer into used
  from public.usage_events
  where user_id = requested_user_id
    and event_type = 'avatar_generation'
    and created_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC');

  if used >= monthly_limit then
    raise exception 'AVATAR_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  insert into public.avatar_generation_jobs (
    user_id, profile_id, source_photo_path, style, preset, status
  ) values (
    requested_user_id, requested_profile_id, requested_source_photo_path,
    requested_style, requested_preset, 'queued'
  ) returning * into created_job;

  insert into public.usage_events (user_id, profile_id, event_type, quantity)
  values (requested_user_id, requested_profile_id, 'avatar_generation', 1);

  return next created_job;
end;
$$;

revoke all on function public.create_metered_avatar_job(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.create_metered_avatar_job(uuid, uuid, text, text, text, integer) to service_role;
