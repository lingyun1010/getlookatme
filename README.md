# LookAtMe

Private SaaS foundation for an AI-native professional identity platform. The current milestone preserves the working portfolio experience from the public reference implementation while establishing a clean Vercel-hosted codebase.

## Current state

- `/` redirects to `/lingyun` on Vercel.
- `/lingyun` renders the temporary Lingyun seed profile.
- The portfolio renderer remains the proven Vite/static implementation.
- Chat remains single-profile and uses the bundled Lingyun RAG index.
- `/create` accepts PDF, DOCX, or pasted resume text and creates a session-only `/preview` profile.
- Resume mapping prefers a server-side structured-output LLM and falls back to the deterministic local parser.
- No authentication, persistence, permanent publishing, billing, analytics, or custom domains exist yet.

## Development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

For local chat and LLM-assisted resume mapping, set `OPENAI_API_KEY`, set `VITE_API_BASE_URL=http://localhost:3001`, and run `pnpm dev:api` separately. Set `ONBOARDING_LLM_ENABLED=false` server-side or `VITE_ONBOARDING_LLM_ENABLED=false` client-side to force deterministic onboarding. `VITE_ONBOARDING_LLM_TIMEOUT_MS` defaults to 60000 so normal structured extraction has time to finish before deterministic fallback.

When using a split local UI/API, `ALLOWED_ORIGINS` must contain the exact browser origin. The example configuration includes both `http://localhost:5173` and `http://127.0.0.1:5173` (plus port 5174 fallbacks). Development console messages prefixed with `[onboarding]` show the selected mapper, endpoint/status, response validation, fallback reason, and final review mapper without logging resume text.

Validation:

```bash
pnpm typecheck
pnpm test
pnpm build
```

See `PRODUCT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, and `STATUS.md` for scope and decisions.
