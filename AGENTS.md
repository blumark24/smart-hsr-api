# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Single **Next.js 14** app (`blumark24-os`) — Arabic-first SaaS business management platform. One process serves marketing (`/`), static demo (`/demo`), tenant workspace (`/dashboard`, etc.), and owner admin (`/owner/*`).

### Services

| Service | Required for | Notes |
|---------|--------------|-------|
| **Next.js dev server** | All local dev | `npm run dev` → http://localhost:3000 |
| **Supabase (hosted)** | Auth, tenant workspace, owner panel | No local Supabase/docker-compose. Copy `.env.local.example` → `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Apply SQL in `supabase/migrations/`. |
| **OpenAI / Gemini / Anthropic** | AI features only | Optional; marketing `/` and `/demo` work without them. |

### Standard commands

See `package.json` scripts:

- **Dev:** `npm run dev`
- **Lint:** `npm run lint`
- **Build:** `npm run build`
- **Production:** `npm run start` (after `npm run build`)
- **Tenant isolation check:** `npm run verify:isolation` (requires configured Supabase + running app)

### Environment

- Node **>= 20** (repo uses npm + `package-lock.json`).
- `.env.local` is gitignored; use `.env.local.example` as the template.
- Without Supabase env vars, `/` and `/demo` still render (build uses placeholders in `src/lib/supabaseClient.ts`). Tenant login and dashboard data require a real Supabase project.

### Gotchas

- **Do not run `npm run build` while `npm run dev` is active** — it can corrupt the dev `.next` cache and cause 500s on routes like `/demo`. Stop dev first, or restart `npm run dev` after a build.
- **No docker-compose** — do not expect local Postgres; point at a hosted Supabase project.
- **Detached HEAD** may occur on cloud VMs; create feature branches from `main` when making changes.
- **Owner vs customer auth** use separate Supabase browser clients (`ownerClient.ts` vs `supabaseClient.ts`) with different `storageKey` values.
- Supabase MCP in Cursor requires user authentication in the desktop IDE before it can provision or inspect projects.
