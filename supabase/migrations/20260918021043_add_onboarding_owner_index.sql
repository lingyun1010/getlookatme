create index if not exists onboarding_states_profile_owner_idx
on public.onboarding_states(profile_id, user_id);
