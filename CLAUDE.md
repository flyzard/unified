# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Greenfield. The repo currently contains only design docs (`requirements.md`, `arquitecture.md`) — no source code, no `package.json`, no migrations yet. All architectural decisions below are *locked* by those docs; do not relitigate them when scaffolding.

## What this is

Personal, single-user time tracker. SvelteKit on Cloudflare Pages + D1, free tier. Three tables: `projects`, `tasks`, `time_entries`. Single-password auth via signed cookie.

## Stack (locked)

- SvelteKit (Svelte 5) + `@sveltejs/adapter-cloudflare`
- Cloudflare Pages (hosting), Cloudflare D1 (SQLite)
- Drizzle ORM + drizzle-kit migrations
- Tailwind CSS v4
- pnpm
- Custom auth: HMAC-signed cookie via `crypto.subtle`. **Do not pull in `jsonwebtoken` or any auth library.**

## Common commands

Once scaffolded (`pnpm create svelte@latest .`):

```bash
pnpm dev                                   # local dev server (uses miniflare + local D1)
pnpm build                                 # production build → .svelte-kit/cloudflare
pnpm check                                 # svelte-check / TS

# D1 / migrations
npx wrangler d1 create timetracker-db      # one-time, copy id into wrangler.toml
npx drizzle-kit generate                   # generate migration from schema.ts
npx wrangler d1 execute timetracker-db --local  --file=./drizzle/0000_init.sql
npx wrangler d1 execute timetracker-db --remote --file=./drizzle/0000_init.sql  # prod, manual
```

No automated migration runner. Apply remote migrations by hand after each `drizzle-kit generate`.

Required env vars (set in `.dev.vars` locally, in Pages → Environment for prod):
- `APP_PASSWORD` — login password
- `SESSION_SECRET` — `openssl rand -hex 32`

## Architecture essentials

### Data model invariants

- **At most one running timer globally.** `time_entries.ended_at IS NULL` for one row max, across the whole DB. Enforce inside a single transaction (`db.batch()` in D1) in `src/lib/server/queries.ts::startTimer` — close any open entry, then insert the new one. This is the single most important correctness property; test it.
- **Times are ISO 8601 UTC strings**, not D1 dates. Sort lexicographically, parse in JS for display.
- **Soft-delete is mandatory** for `tasks` and `time_entries` (`deleted_at` nullable). Every read query must filter `WHERE deleted_at IS NULL`. Centralize in `queries.ts` so routes can't forget. Running-timer query: `WHERE ended_at IS NULL AND deleted_at IS NULL`.
- **Projects use `archived`, not `deleted_at`.** Archive *is* the project soft-delete, and it is reversible. Archiving a project does **not** soft-delete its tasks. Deleting a task **does** cascade-soft-delete its entries.
- **Archived projects' tasks** appear greyed-out at the bottom of the task picker, not hidden.

### Auth flow

1. `POST /login` → timing-safe compare against `APP_PASSWORD`.
2. Cookie value = `${expiry}.${hmac(SESSION_SECRET, expiry)}`. httpOnly, secure, sameSite=lax, 30 day maxAge.
3. `hooks.server.ts` verifies HMAC + expiry on every request, attaches `locals.session` and `locals.db` (Drizzle client from `platform.env.DB`). Redirects to `/login` for any non-`/login` route when unauthenticated.

### Mutations

Server actions only. **No separate REST/JSON API.** Form actions in `+page.server.ts` files.

### Time format

`H:MM` everywhere (`0:05`, `1:30`, `12:34`). No seconds, no decimals. Helper lives in `src/lib/format.ts::formatDuration(ms)`.

### Indexes (in initial migration)

- `time_entries(task_id, deleted_at)`
- `time_entries(ended_at)` (partial `WHERE ended_at IS NULL` if D1 supports it)
- `tasks(project_id, deleted_at)`

## Project layout (target)

```
src/
  hooks.server.ts          # auth + db on locals
  lib/
    server/{auth,db,schema,queries}.ts
    components/{Timer,EntryRow,ProjectCard}.svelte
    format.ts
  routes/
    +layout.server.ts      # redirect to /login if no session
    +page.{svelte,server.ts}             # dashboard
    login/+page.{svelte,server.ts}
    projects/+page.{svelte,server.ts}
    projects/[id]/+page.{svelte,server.ts}
    projects/[id]/tasks/[taskId]/+page.{svelte,server.ts}
drizzle/0000_init.sql
drizzle.config.ts
wrangler.toml
.dev.vars                  # gitignored
```

Don't add folders speculatively. No `src/lib/utils/` graveyard.

## Build order

Follow `arquitecture.md` §"Build order" strictly: hello-world deploy → auth → projects CRUD → tasks → manual entries → live timer → edit/delete → polish. Steps 7–8 are where scope creep lives.

## Out of scope (v1)

Multi-user, invoicing, integrations, pomodoro, native apps, reports/charts/CSV, weekly views, rich-text notes, realtime cross-tab sync, tagging system. See `requirements.md` §"Things that will tempt you. Don't."

## Source of truth

`requirements.md` = the *what*. `arquitecture.md` = the *how*. When a question isn't answered here, read those before improvising.
