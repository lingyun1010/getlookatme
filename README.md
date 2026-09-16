# LookAtMe

Private SaaS foundation for an AI-native professional identity platform. The current milestone preserves the working portfolio experience from the public reference implementation while establishing a clean Vercel-hosted codebase.

## Current state

- `/` redirects to `/lingyun` on Vercel.
- `/lingyun` renders the temporary Lingyun seed profile.
- The portfolio renderer remains the proven Vite/static implementation.
- Chat remains single-profile and uses the bundled Lingyun RAG index.
- No authentication, persistence, uploads, billing, analytics, or custom domains exist yet.

## Development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

For local chat, set `OPENAI_API_KEY`, set `VITE_API_BASE_URL=http://localhost:3001`, and run `pnpm dev:api` separately.

Validation:

```bash
pnpm typecheck
pnpm test
pnpm build
```

See `PRODUCT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, and `STATUS.md` for scope and decisions.
