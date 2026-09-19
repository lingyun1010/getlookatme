-- PR #3 queue controls: cancellation and one active generation per profile.

alter table public.avatar_generation_jobs
  drop constraint if exists avatar_generation_jobs_status_check;
alter table public.avatar_generation_jobs
  add constraint avatar_generation_jobs_status_check
  check (status in ('queued', 'generating', 'ready', 'failed', 'cancelled'));

create unique index if not exists avatar_jobs_one_active_per_profile_idx
  on public.avatar_generation_jobs(profile_id)
  where status in ('queued', 'generating');

create or replace function public.cancel_avatar_generation_job(job_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.avatar_generation_jobs
  set status = 'cancelled', error = null, completed_at = now()
  where id = job_id
    and user_id = (select auth.uid())
    and status = 'queued';
  return found;
end;
$$;
revoke all on function public.cancel_avatar_generation_job(uuid) from public, anon;
grant execute on function public.cancel_avatar_generation_job(uuid) to authenticated;
