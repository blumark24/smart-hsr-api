# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Blumark24 OS is a Next.js 14 (App Router) multi-tenant Arabic-language (RTL) business management platform. Single `package.json`, no monorepo.

### Running the app

```bash
npm run dev    # starts dev server on http://localhost:3000
npm run build  # production build
npm run lint   # ESLint (next/core-web-vitals)
```

### Required environment variables

Copy `.env.local.example` to `.env.local` and fill in real values. The app compiles and serves pages with placeholder values, but authentication and data flows require real Supabase credentials:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (for admin API routes)
- `ANTHROPIC_API_KEY` — optional; AI assistant degrades gracefully without it

### Key architecture notes

- **Auth middleware** redirects unauthenticated users to `/auth?redirect=<path>` for protected routes (`/dashboard`, `/employees`, `/tasks`, etc.).
- **Owner portal** lives at `/owner/*` with its own login at `/owner/login` — a separate auth flow.
- **API routes** are under `/api/admin/*`, `/api/ai/*`, `/api/auth/*`, `/api/automation/*`, `/api/owner/*`, `/api/tenant/*`.
- **No automated test suite** exists — linting (`npm run lint`) and build (`npm run build`) are the primary verification steps.
- **No Docker or database containers** are needed locally; all data comes from hosted Supabase.

### Development guidelines (SAFE MODE)

- Do NOT modify existing authentication logic, Supabase client setup, RLS policies, or database schema.
- Do NOT delete, rename, or replace existing routes, components, or pages.
- Use additive-only development: extend with new modules, don't redesign existing ones.
- New features should use existing design tokens (see `tailwind.config.ts` for brand colors, fonts, animations).
- Database migrations must be proposed as `.sql` files in `supabase/migrations/` — never applied automatically.
- Owner admin features live under the `/owner/*` route namespace.

### Gotchas

- The lint warning about custom fonts in `layout.tsx` is expected and harmless (Next.js App Router pattern).
- Build generates 30 static pages; if a new page import fails, it'll surface at build time.
- The dev server takes ~5-7 seconds for first page load due to on-demand compilation.
