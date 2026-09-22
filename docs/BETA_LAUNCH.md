# Get Look At Me — Beta Launch Runbook

This document is the internal launch checklist for the Get Look At Me Beta.

It is intended for the product owner and developers, not end users.

The goal is to verify that the existing product is production-ready without adding new product features.

---

## 1. Beta scope

The current Beta supports the following core journey:

```text
Landing
→ Sign up
→ Upload CV
→ Build AI professional profile
→ Upload photo
→ Generate dynamic Avatar
→ Review profile
→ Publish
→ Open public profile
→ Ask RAG questions
→ View plan and usage
→ Reach upgrade CTA
→ Send feedback
```

The Beta should not add new feature scope before initial user validation.

Out of scope for this launch:

- Stripe / real payments
- JD matching
- job search
- LinkedIn import
- cover-letter generation
- interview preparation
- recruiter messaging
- recruiter analytics dashboard
- custom domains
- new profile templates
- new Avatar styles
- saved/shareable chat history
- referral systems
- email campaigns

---

# 2. Production environment checklist

Before deploying or smoke testing production, confirm all required environment variables are configured in the hosting environment.

## Runtime

Production must use:

```text
APP_ENV=production
MOCK_BILLING_ENABLED=false
```

Mock billing must never be available in production.

---

## Supabase — browser-safe variables

Confirm:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

These may be exposed to the browser.

---

## Supabase — server-only variables

Confirm:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` must never use a `VITE_*` prefix or be exposed to the browser.

---

## OpenAI / RAG / Avatar

Confirm required server-side configuration exists:

```text
OPENAI_API_KEY
```

and any configured model variables required by:

- CV mapping
- Avatar generation
- embeddings
- RAG answers

---

## Avatar worker

Confirm the production worker can:

1. authenticate using the configured worker/cron secret
2. retrieve queued Avatar jobs
3. read private source photos
4. generate frames
5. write generated frames to the public Avatar bucket
6. mark the generation job complete

If using scheduled worker execution, verify:

```text
CRON_SECRET
```

is configured correctly.

---

## API routing

Confirm production exposes the required endpoints:

```text
/api/onboarding/map-resume
/api/avatar-jobs
/api/avatar-worker
/api/profile-ai
/api/profile-publication
/api/chat
/api/analytics
/api/billing
```

Production should not depend on localhost ports or development-only API routes.

---

# 3. Supabase migration checklist

Do not begin production smoke testing until local and remote migration histories are aligned.

First inspect:

```bash
pnpm exec supabase migration list
```

Then perform a dry run:

```bash
pnpm exec supabase db push --dry-run
```

If Supabase reports older local migrations that were inserted before an already-applied remote migration, inspect the list carefully and use:

```bash
pnpm exec supabase db push --include-all --dry-run
```

Only after confirming the intended migrations should you run:

```bash
pnpm exec supabase db push --include-all
```

Then verify again:

```bash
pnpm exec supabase migration list
```

Local and remote histories should match before smoke testing.

For M3.1, confirm the following migrations are applied:

```text
20260922000050_beta_public_profile_column_boundary.sql
20260922000439_beta_feedback.sql
20260922000654_beta_top_funnel_analytics.sql
```

Also confirm all earlier Avatar, monetisation, analytics, ownership and RLS migrations remain applied.

---

# 4. Storage and privacy boundary

Confirm the storage model remains:

## Private

```text
profile-private-assets
```

Contains:

- uploaded CVs
- original user photos
- other owner-only source assets

These assets must not be publicly readable.

Owner previews may use short-lived signed URLs.

---

## Public

```text
profile-public-assets
```

Contains generated Avatar frames required for public profile rendering.

Only intentionally public presentation assets should be stored here.

---

## Public profile rule

A public profile must never expose:

- CV source files
- original private photos
- onboarding state
- private storage paths
- account email
- subscription records
- owner-only metadata

If a published profile does not have an active generated Avatar, the public profile should fall back to initials rather than exposing the original uploaded photo.

---

# 5. Beta production smoke test

Use a new test account.

Avoid reusing an account with old onboarding or mock billing state.

## Step 1 — Landing

Open production root:

```text
/
```

Confirm:

- product positioning is clear
- main CTA says `Create my profile`
- demo link works
- Free / Pro pricing renders from pricing configuration
- Privacy / Terms / Refund links work

---

## Step 2 — Signup

Create a new account.

Confirm:

- authentication succeeds
- initial profile is created
- onboarding state exists
- Free subscription exists
- dashboard loads

---

## Step 3 — CV upload

Upload a valid CV.

Confirm:

- file upload succeeds
- CV is stored privately
- parser runs successfully
- mapped profile draft appears
- user can review/edit profile data

---

## Step 4 — Avatar

Upload a portrait photo.

Confirm:

- original photo remains private
- generation job can be created
- worker processes the job
- generated frames load successfully
- usage increments correctly
- generated Avatar can be selected

---

## Step 5 — Profile review

Review the generated profile.

Confirm:

- professional information is correct
- no private storage paths are visible
- Avatar renders
- RAG-related profile state is ready if enabled

---

## Step 6 — Publish

Publish the profile.

Confirm:

- status changes from Draft to Published
- public slug resolves
- anonymous browser can open the profile

---

## Step 7 — Public profile privacy

Open the profile in an incognito/private browser.

Confirm:

- profile content loads
- generated Avatar loads
- no private original-photo URL is returned
- no CV/source files are accessible
- no owner account information is visible

---

## Step 8 — RAG

Ask a recruiter-style question.

Examples:

```text
What projects has this person worked on?
```

```text
What experience does this person have with AI?
```

Confirm:

- answer is based on profile knowledge
- evidence/source navigation works
- question usage increments
- no cross-user profile information appears

---

## Step 9 — Plan and usage

Return to the owner dashboard.

Confirm:

- plan displays correctly
- Avatar usage is current
- RAG usage is current
- Free limits are shown correctly
- upgrade CTA is visible where appropriate

---

## Step 10 — Upgrade path

Click the upgrade CTA.

For production Beta:

- user may view Pro positioning
- no real payment details should be requested
- development mock billing must not be accessible

Real payments are deferred to M3.2.

---

## Step 11 — Feedback

Submit Beta feedback from the dashboard.

Confirm:

- success message appears
- dashboard remains usable
- feedback row is persisted
- the user cannot read another user's feedback
- anonymous users cannot submit feedback

---

# 6. Analytics verification

The Beta funnel currently tracks:

```text
create_profile_clicked
signup_completed
cv_uploaded
cv_parsed
avatar_generated
profile_published
public_profile_viewed
rag_question_asked
upgrade_clicked
checkout_started
subscription_activated
```

Confirm the relevant events appear during smoke testing.

Analytics events must not contain:

- raw CV text
- chat question text
- uploaded photos
- private profile data

Anonymous landing/profile-view analytics are intentionally lightweight.

Current Beta limitation:

Anonymous analytics endpoints do not yet have dedicated rate limiting or deduplication. This is acceptable for the initial small Beta but should be revisited if traffic volume or analytics noise becomes material.

---

# 7. Test data cleanup

Before inviting real Beta users, review development and test data.

Identify:

- temporary test accounts
- test profiles
- mock Pro subscriptions
- failed Avatar jobs
- generated test assets
- duplicate onboarding test records

Do not bulk-delete data without first confirming that it belongs to test accounts.

Keep at least one known test account if useful for future production smoke testing.

---

# 8. Legal and trust check

Confirm these routes work:

```text
/privacy
/terms
/refunds
```

Verify the current text still matches product behaviour.

Before real payments go live, these pages must be reviewed again.

In particular, M3.2 must update:

- payment terms
- cancellation behaviour
- refund rules
- billing provider details
- support/contact details

---

# 9. Initial Beta user onboarding

For invited users, keep onboarding simple.

Suggested instructions:

1. Create your account.
2. Upload your current CV.
3. Review the generated professional profile.
4. Upload a clear portrait photo.
5. Generate and select your Avatar.
6. Preview your profile.
7. Publish it.
8. Share your profile link.
9. Ask your AI profile a few recruiter-style questions.
10. Send feedback from the dashboard.

The primary objective is to learn:

- where users get confused
- whether they complete publishing
- whether the Avatar adds perceived value
- whether recruiters/users understand the AI Q&A
- whether Free limits create upgrade interest

---

# 10. Beta launch message

Reusable short description:

> Get Look At Me is an early Beta for turning your CV into an interactive AI professional profile. Upload your CV, generate a dynamic Avatar, let recruiters explore your experience through grounded AI Q&A, and share everything through one profile link. The product is functional but still early, and feedback from Beta users will directly shape what we build next.

---

# 11. Development workflow

For Beta-stage work:

- work in ordered, focused tasks
- use one commit per task or bug area
- avoid unrelated refactors
- avoid adding features without user evidence
- keep production/local request paths aligned
- confirm Supabase migrations are applied before debugging runtime schema/RPC failures

The owner runs final validation after implementation:

```bash
pnpm typecheck && pnpm test && pnpm build
```

---

# 12. M3.1 Definition of Done

M3.1 is complete when a new user can successfully complete this production flow:

```text
Landing
→ Signup
→ CV upload
→ AI profile
→ Avatar
→ Review
→ Publish
→ Public profile
→ RAG question
→ Plan / usage
→ Upgrade CTA
→ Feedback
```

and:

- all required migrations are applied
- production environment is correct
- mock billing is disabled
- public/private asset boundaries are preserved
- legal pages are accessible
- funnel analytics are recorded
- production smoke test passes
- no new launch-blocking issue remains