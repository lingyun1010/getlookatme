-- Track Stripe cancel-at-period-end without dropping Pro entitlements early.

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

comment on column public.subscriptions.cancel_at_period_end is
  'When true, Stripe will end the subscription at current_period_end; plan stays elevated until then.';
