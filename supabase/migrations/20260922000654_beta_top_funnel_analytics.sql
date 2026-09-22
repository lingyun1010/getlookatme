-- M3.1: one anonymous-safe landing intent event.

alter table public.analytics_events
  alter column user_id drop not null,
  alter column profile_id drop not null;

alter table public.analytics_events
  drop constraint if exists analytics_events_event_type_check;

alter table public.analytics_events
  add constraint analytics_events_event_type_check check (event_type in (
    'create_profile_clicked', 'signup_completed', 'cv_uploaded', 'cv_parsed',
    'avatar_generated', 'profile_published', 'public_profile_viewed',
    'rag_question_asked', 'upgrade_clicked', 'checkout_started',
    'subscription_activated'
  )),
  add constraint analytics_events_attribution_consistent check (
    (user_id is null and profile_id is null)
    or (user_id is not null and profile_id is not null)
  );
