# Architecture & Technical Decisions

The *how*. The *what* lives in `requirements.md`.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | SvelteKit (Svelte 5) | Server actions, runs on Workers, single deployable |
| Adapter | `@sveltejs/adapter-cloudflare` | Required for Pages/Workers |
| Hosting | Cloudflare Pages | Free, generous limits, zero-config CI from Git |
| Database | Cloudflare D1 (SQLite) | Free tier, edge-replicated, bound to Worker |
| ORM | Drizzle | Lightweight, typed, D1 driver, migrations work |
| Styling | Tailwind CSS v4 | Fast, no design bikeshedding |
| Auth | Custom HMAC cookie | One env var, ~30 LOC |
| Package manager / runtime tooling | Bun | Fast installs, fast scripts |

Bun is build/dev tooling only. Cloudflare Workers run V8, not Bun runtime.

## Project layout

Target shape. Only scaffolded files (`src/app.{d.ts,html}`, `src/routes/+{layout,page}.svelte`, `src/routes/layout.css`, `src/lib/assets/favicon.svg`) currently exist. Rest gets created per build order.

```
src/
  app.d.ts                 # Locals types (session, db)
  app.html
  hooks.server.ts          # Auth check, attach db to locals
  lib/
    server/
      auth.ts              # Cookie sign/verify, password check
      db.ts                # Drizzle client from platform.env.DB
      schema.ts            # Drizzle table definitions
      queries.ts           # Reusable query helpers (active timer, totals)
    components/
      Timer.svelte
      EntryRow.svelte
      ProjectCard.svelte
    format.ts              # formatDuration(ms) → "H:MM:SS"
  routes/
    +layout.svelte
    +layout.server.ts      # Redirect to /login if no session
    login/
      +page.{svelte,server.ts}
    +page.{svelte,server.ts}                            # Dashboard
    projects/
      +page.{svelte,server.ts}                          # List + create
      [id]/
        +page.{svelte,server.ts}                        # Detail, task CRUD
        tasks/[taskId]/
          +page.{svelte,server.ts}                      # Task detail, entry CRUD
drizzle/
  0000_init.sql
drizzle.config.ts
wrangler.jsonc             # D1 binding
.dev.vars                  # Local env vars (gitignored)
```

## Environment variables

Two, both required:

- `APP_PASSWORD` — login password. Pages → Settings → Environment variables. Local: `.dev.vars`.
- `SESSION_SECRET` — 32+ byte random for HMAC. Generate: `openssl rand -hex 32`. Same locations.

Rotate password → change `APP_PASSWORD`, redeploy. Rotate `SESSION_SECRET` → all sessions invalidate.

## Database schema (Drizzle, SQLite dialect)

```ts
// src/lib/server/schema.ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  deletedAt: text('deleted_at'),                // null = not deleted
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const timeEntries = sqliteTable('time_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  startedAt: text('started_at').notNull(),     // ISO8601 UTC
  endedAt: text('ended_at'),                    // null = running
  note: text('note'),
  deletedAt: text('deleted_at'),                // null = not deleted
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});
```

**Times = ISO 8601 UTC strings.** D1 date support is awkward; strings are simplest, sort correctly. Convert in JS for display.

**Soft-delete columns are mandatory.** Every read of `tasks` or `time_entries` filters `WHERE deleted_at IS NULL`. Centralize in `queries.ts` so routes can't forget. Running-timer query: `WHERE ended_at IS NULL AND deleted_at IS NULL`.

**Indexes (initial migration):**
- `time_entries(task_id, deleted_at)`
- `time_entries(ended_at)` — partial `WHERE ended_at IS NULL` if D1 supports it, else plain
- `tasks(project_id, deleted_at)`

## One running timer

Only real business logic. Single transaction in `queries.ts`:

```ts
export async function startTimer(db, taskId: number) {
  await db.transaction(async (tx) => {
    await tx.update(timeEntries)
      .set({ endedAt: new Date().toISOString() })
      .where(isNull(timeEntries.endedAt));
    await tx.insert(timeEntries).values({
      taskId,
      startedAt: new Date().toISOString()
    });
  });
}
```

D1 supports transactions via `db.batch()`; Drizzle's `transaction()` compiles to it. Test this — it's the single most important correctness property.

## Auth

```
Login flow:
1. POST /login with password field.
2. Server: timing-safe compare against APP_PASSWORD.
3. Match → cookie value = `${expiry}.${hmac(SESSION_SECRET, expiry)}`.
4. Set cookie: httpOnly, secure, sameSite=lax, path=/, maxAge=30 days.
5. Redirect to /.

Per request (hooks.server.ts):
1. Read cookie, split on '.'.
2. Verify HMAC, check expiry.
3. Valid → locals.session = { authenticated: true }.
4. Route !== /login and not authenticated → redirect to /login.
```

Use `crypto.subtle` (Web Crypto, available in Workers) for HMAC. Do **not** add `jsonwebtoken` or similar.

## Local development

Scaffold (already done — recorded for reproducibility):

```bash
bunx sv create . --template minimal --types ts --no-dir-check --no-install \
  --add sveltekit-adapter=adapter:cloudflare+cfTarget:pages \
  --add tailwindcss=plugins:none
bun install
```

Drizzle (add when starting build-order step 3 — schema + projects CRUD):

```bash
bun add drizzle-orm
bun add -d drizzle-kit
```

D1 + migrations:

```bash
bunx wrangler d1 create timetracker-db
# Copy database_id into wrangler.toml.

bunx drizzle-kit generate
bunx wrangler d1 execute timetracker-db --local --file=./drizzle/0000_init.sql

bun run dev
```

`.dev.vars` (gitignored):
```
APP_PASSWORD=whatever
SESSION_SECRET=<openssl rand -hex 32>
```

`wrangler.jsonc` (add D1 binding to scaffolded file):
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "timetracker",
  "compatibility_date": "2026-05-05",
  "compatibility_flags": ["nodejs_als"],
  "pages_build_output_dir": ".svelte-kit/cloudflare",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "timetracker-db",
      "database_id": "<from wrangler d1 create>"
    }
  ]
}
```

## Deployment

1. Push to GitHub.
2. Cloudflare dashboard: Pages → Connect to Git → pick repo.
3. Build command: `bun run build`. Output dir: `.svelte-kit/cloudflare`.
4. Pages settings: bind D1 database (binding name `DB`).
5. Add `APP_PASSWORD` and `SESSION_SECRET` (Production).
6. Run migration once against prod DB:
   `bunx wrangler d1 execute timetracker-db --remote --file=./drizzle/0000_init.sql`
7. Deploy.

Future schema changes: `bunx drizzle-kit generate`, run with `--remote`. No automated runner — fine for one-person app, just don't forget the step.

## Build order

Sequence keeps you unblocked:

1. **Scaffold + deploy hello-world.** SvelteKit → Pages pipeline before anything else.
2. **Auth.** Login, hooks, logout. Confirm in production.
3. **Schema + projects CRUD.** No tasks, no timers yet.
4. **Tasks under projects.** Same shape.
5. **Manual time entries.** No timer yet — form to log past entry on a task.
6. **Live timer.** Start/stop, transactional invariant, dashboard widget.
7. **Edit/delete entries.** Last, least critical — SQL works in a pinch.
8. **Polish.** Total-time displays, mobile layout.

After step 6 = usable app. Steps 7–8 = creep zone. Be ruthless.
