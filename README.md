# LookAtMe

Private SaaS foundation for an AI-native professional identity platform. The current milestone preserves the working portfolio experience from the public reference implementation while establishing a clean Vercel-hosted codebase.

## Current state

- `/` redirects to `/lingyun` on Vercel.
- `/lingyun` renders the temporary Lingyun seed profile.
- The portfolio renderer remains the proven Vite/static implementation.
- Chat remains single-profile and uses the bundled Lingyun RAG index.
- `/auth` provides Supabase email/password sign-up and sign-in with persistent browser sessions.
- `/dashboard/create`, `/edit`, `/dashboard`, and `/preview` require authentication.
- `/dashboard/create` accepts PDF, DOCX, or pasted resume text and persists an owner-scoped `/preview` profile.
- `/dashboard/create` also accepts a portrait image, supports original-photo mode, and can generate a smooth `lookatme-avatar` dynamic avatar via the server-side SDK.
- The onboarding preview now renders the original photo as a square crop and uses pointer-following `LookAtMeAvatar` motion for generated avatars instead of an autoplay slideshow.
- The avatar generation control keeps a stable CTA label (`Generate dynamic avatar` / `Use the original photo`) instead of flipping text based on whether a frame set exists.
- Resume mapping prefers a server-side structured-output LLM and falls back to the deterministic local parser.
- `lookatme-avatar` is consumed as an external GitHub SDK: browser/React imports remain client-side, while `lookatme-avatar/server` stays in the getlookatme Node API and uses the app-owned `OPENAI_API_KEY`.
- Generated images pass through `tmp/lookatme-avatar-generated` and are then copied to durable owner-scoped Supabase Storage; the intermediate local store remains development-only.
- Profile publishing controls, RAG isolation, billing, analytics, and custom domains do not exist yet.

## Development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Create or link a Supabase project, apply `supabase/migrations/202609180001_auth_profile_ownership.sql`, then configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Server processes also require `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Never expose a secret/service-role key through a `VITE_*` variable.

For local chat and LLM-assisted resume mapping, set `OPENAI_API_KEY`, set `VITE_API_BASE_URL=http://localhost:3001`, and run `pnpm dev:api` separately. Set `ONBOARDING_LLM_ENABLED=false` server-side or `VITE_ONBOARDING_LLM_ENABLED=false` client-side to force deterministic onboarding. `VITE_ONBOARDING_LLM_TIMEOUT_MS` defaults to 60000 so normal structured extraction has time to finish before deterministic fallback.

When using a split local UI/API, `ALLOWED_ORIGINS` must contain the exact browser origin. The example configuration includes both `http://localhost:5173` and `http://127.0.0.1:5173` (plus port 5174 fallbacks). Development console messages prefixed with `[onboarding]` show the selected mapper, endpoint/status, response validation, fallback reason, and final review mapper without logging resume text.

Validation:

```bash
npm run typecheck
npm test
npm run build
```

## LookAtMe onboarding integration

The onboarding flow now supports a CV upload plus a portrait photo. The photo can either stay as the original portfolio image or trigger a dynamic avatar generation flow using the external `lookatme-avatar` SDK with the `smooth` preset. The generated `AvatarFrameSet` is copied from the SDK's intermediate local output to owner-scoped Supabase Storage and rendered in the existing hero avatar slot.

The server boundary remains getlookatme-owned. Browser code never calls OpenAI or imports `lookatme-avatar/server`; it posts the selected portrait to the local API route, which uses:

```ts
import {
  PhotoAIFrameProducer,
  OpenAIImageGenerationProvider,
} from "lookatme-avatar/server";
```

The app uses its own `OPENAI_API_KEY` runtime environment and does not depend on a separate LookAtMe demo server or `localhost:5180`.

See `PRODUCT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `STATUS.md`, and `docs/LOOKATME_INTEGRATION.md` for scope and decisions.
