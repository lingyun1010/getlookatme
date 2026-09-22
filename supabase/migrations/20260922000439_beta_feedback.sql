-- M3.1: lightweight owner-submitted Beta feedback.

create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid,
  category text not null default 'feedback' check (category in ('bug', 'feedback', 'idea')),
  message text not null check (char_length(trim(message)) between 1 and 4000),
  created_at timestamptz not null default now(),
  constraint beta_feedback_profile_owner_fk foreign key (profile_id, user_id)
    references public.profiles(id, user_id) on delete set null (profile_id)
);

create index beta_feedback_user_created_idx on public.beta_feedback(user_id, created_at desc);

alter table public.beta_feedback enable row level security;
revoke all on table public.beta_feedback from anon, authenticated;
grant insert on table public.beta_feedback to authenticated;

create policy "Owners can submit Beta feedback"
on public.beta_feedback for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    profile_id is null
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  )
);
