# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Greenfield. Only design docs exist. Source of truth:
- `requirements.md` — *what* (behavior, scope, locked UX rules).
- `arquitecture.md` — *how* (stack, schema, impl, commands, build order).

Read those before improvising. Do not relitigate locked decisions.

## Stack one-liner

SvelteKit (Svelte 5) + adapter-cloudflare → Cloudflare Pages + D1 + Drizzle + Tailwind v4. Bun for installs/scripts. Custom HMAC cookie auth.

## Topic → file pointer

| Need | Look in |
|---|---|
| Feature scope, MVP checklist, non-goals | `requirements.md` §MVP / §Non-goals |
| Time format, week start, archived picker, soft-delete UX | `requirements.md` §UX rules |
| Drizzle schema, types, indexes | `arquitecture.md` §Database schema |
| Active-timer transaction code | `arquitecture.md` §One running timer |
| Auth flow, cookie format, HMAC | `arquitecture.md` §Auth |
| Env vars, `.dev.vars`, `wrangler.toml` | `arquitecture.md` §Environment / §Local development |
| Bun commands, migration commands | `arquitecture.md` §Local development / §Deployment |
| Project layout (folders) | `arquitecture.md` §Project layout |
| Build order | `arquitecture.md` §Build order |

## Critical invariants (never break)

- **One running timer globally.** Enforce in single `db.batch()` transaction in `queries.ts::startTimer`. Test it.
- **Times = ISO 8601 UTC strings.** Not D1 dates.
- **Every read of `tasks` / `time_entries` filters `deleted_at IS NULL`.** Centralized in `queries.ts`.
- **Mutations via SvelteKit form actions only.** No REST/JSON API.
- **Auth: `crypto.subtle` HMAC only.** No `jsonwebtoken` or auth library.

## Commands

```bash
bun run dev            # local dev (miniflare + local D1)
bun run build          # → .svelte-kit/cloudflare
bun run check          # svelte-check / TS

bunx drizzle-kit generate
bunx wrangler d1 execute timetracker-db --local  --file=./drizzle/<n>.sql
bunx wrangler d1 execute timetracker-db --remote --file=./drizzle/<n>.sql
```

## Guardrails

- Routes ≤ ~100 LOC. Split only when exceeded.
- No new deps without asking.
- No `src/lib/utils/` or new subfolders until 3rd reuse.
- No abstraction for single call site.
- Schema change → new migration file. Never mutate an applied one.
- Code/comment that doesn't trace to a `requirements.md` checklist item → delete.
- Global `~/.claude/CLAUDE.md` Coding Discipline applies. Don't restate it here.

## Out of scope (v1)

Multi-user, invoicing, integrations, pomodoro, native apps, reports/charts/CSV, weekly views, rich-text notes, realtime cross-tab sync, tagging. Full list: `requirements.md`.
