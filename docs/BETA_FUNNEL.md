# Beta funnel analytics

The Beta funnel is intentionally small. Analytics failures are caught or recorded through safe helpers and never block the product action. Event metadata is empty by default and must not contain CV text, chat messages, photos, or other profile content.

| Event | Runtime emission | Attribution |
| --- | --- | --- |
| `create_profile_clicked` | Landing `Create my profile` links | Anonymous with no identifier, or current user/profile when already signed in |
| `signup_completed` | Supabase Auth user-creation trigger after the initial profile is created | New user and profile |
| `cv_uploaded` | Onboarding after the CV file is stored in the private bucket | Authenticated user and owned profile, resolved by the analytics handler |
| `cv_parsed` | Onboarding after mapping produces a reviewable draft | Authenticated user and owned profile, resolved by the analytics handler |
| `avatar_generated` | Avatar worker after generated frames and the Avatar row are ready | Job owner and profile from server-side job state |
| `profile_published` | Shared publication handler after publish succeeds | Authenticated user and server-resolved owned profile |
| `public_profile_viewed` | Public profile page after a published document resolves | Published profile owner/profile resolved server-side from the slug; no viewer identity is stored |
| `rag_question_asked` | RAG service after the request passes profile access/limit checks and usage is recorded | Target published profile owner/profile; question text is not analytics metadata |
| `upgrade_clicked` | Dashboard Free-plan and Pro-plan upgrade links | Authenticated user and owned profile, resolved by the analytics handler |
| `checkout_started` | Shared billing handler after a mock checkout session is created | Authenticated user and owned profile |
| `subscription_activated` | Shared billing handler after mock activation succeeds | Authenticated user and owned profile |

`src/analytics/request.ts` is the shared browser-event handler used by both the Vercel route and the local API server. Anonymous `create_profile_clicked` rows have both `user_id` and `profile_id` set to `NULL`; no fingerprint, IP address, URL, or free text is added. `public_profile_viewed` attributes the event to the viewed profile for owner analytics but does not identify the visitor.
