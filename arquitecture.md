# Architecture & Technical Decisions

Companion to `REQUIREMENTS.md`. This is the "how", not the "what".

## Stack, locked in

| Layer | Choice | Why |
|---|---|---|
| Framework | SvelteKit (latest, Svelte 5) | Server actions, runs on Workers, single deployable unit |
| Adapter | `@sveltejs/adapter-cloudflare` | Required for Pages/Workers deploy |
| Hosting | Cloudflare Pages | Free, generous limits, zero-config CI from Git |
| Database | Cloudflare D1 (SQLite) | Free tier, SQL, edge-replicated, bound to Worker |
| ORM | Drizzle | Lightweight, typed, has D1 driver, migrations work |
| Styling | Tailwind CSS v4 | Fast to write, no design bikeshedding |
| Auth | Custom — signed cookie, single password | One env var, ~30 lines |
| Package manager | pnpm | Fastest installs; npm is fine if you prefer |

## Project layout

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
  routes/
    +layout.svelte
    +layout.server.ts      # Redirect to /login if no session
    login/
      +page.svelte
      +page.server.ts      # Form action: verify password, set cookie
    +page.svelte           # Dashboard
    +page.server.ts        # Load active timer + recent entries
    projects/
      +page.svelte
      +page.server.ts      # List + create action
      [id]/
        +page.svelte
        +page.server.ts    # Project detail, task CRUD
        tasks/
          [taskId]/
            +page.svelte
            +page.server.ts  # Task detail, entry CRUD
drizzle/
  0000_init.sql            # Generated migration
drizzle.config.ts
wrangler.toml              # D1 binding config
.dev.vars                  # Local env vars (gitignored)
```

Don't add folders until you need them. No `src/lib/utils/` graveyard.

## Environment variables

Two, both required:

- `APP_PASSWORD` — the login password. Set in Cloudflare Pages → Settings → Environment variables. For local dev, put it in `.dev.vars`.
- `SESSION_SECRET` — random 32+ byte string for signing the session cookie. Generate with `openssl rand -hex 32`. Same locations.

If you ever want to rotate the password, change `APP_PASSWORD` and redeploy. If you rotate `SESSION_SECRET`, all existing sessions invalidate (which is the point).

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

**Times are stored as ISO 8601 UTC strings.** D1's date support is awkward; strings are simplest and sort correctly. Convert in JS when displaying.

**Soft-delete rule:** every query that reads tasks or entries must filter `WHERE deleted_at IS NULL`. Centralize this in `queries.ts` so individual routes can't forget. The "running timer" query becomes `WHERE ended_at IS NULL AND deleted_at IS NULL`.

**Indexes worth adding** in the migration: `time_entries(task_id, deleted_at)`, `time_entries(ended_at)` (partial index where `ended_at IS NULL` if D1 supports it; otherwise plain), `tasks(project_id, deleted_at)`.

## The "one running timer" invariant

The only piece of real business logic. Implement in `queries.ts`:

```ts
// pseudocode
export async function startTimer(db, taskId: number) {
  await db.transaction(async (tx) => {
    // Stop any currently running timer
    await tx.update(timeEntries)
      .set({ endedAt: new Date().toISOString() })
      .where(isNull(timeEntries.endedAt));
    // Start new one
    await tx.insert(timeEntries).values({
      taskId,
      startedAt: new Date().toISOString()
    });
  });
}
```

D1 supports transactions via `db.batch()` in production (the Drizzle `transaction()` helper compiles to it). Test this — it's the single most important correctness property of the app.

## Auth, in full

```ts
// Login flow:
// 1. POST /login with password field
// 2. Server: timing-safe compare against APP_PASSWORD
// 3. If match: create cookie value = `${expiry}.${hmac(SESSION_SECRET, expiry)}`
// 4. Set cookie: httpOnly, secure, sameSite=lax, path=/, maxAge=30 days
// 5. Redirect to /

// On every request (hooks.server.ts):
// 1. Read cookie, split on '.'
// 2. Verify HMAC, check expiry
// 3. If valid: locals.session = { authenticated: true }
// 4. If route !== /login and not authenticated: redirect to /login
```

Use `crypto.subtle` (Web Crypto, available in Workers) for the HMAC. Don't pull in `jsonwebtoken` or similar — overkill.

## Local development

```bash
pnpm create svelte@latest .          # Skeleton, TypeScript, no other extras
pnpm add -D @sveltejs/adapter-cloudflare drizzle-orm drizzle-kit
pnpm add -D wrangler @cloudflare/workers-types
pnpm add -D tailwindcss @tailwindcss/vite
```

Then:

```bash
# Create local D1 database
npx wrangler d1 create timetracker-db
# Copy the database_id it prints into wrangler.toml

# Generate and apply migrations locally
npx drizzle-kit generate
npx wrangler d1 execute timetracker-db --local --file=./drizzle/0000_init.sql

# Run dev server (uses local D1 via miniflare)
pnpm dev
```

`.dev.vars` (gitignored):
```
APP_PASSWORD=whatever
SESSION_SECRET=<output of openssl rand -hex 32>
```

`wrangler.toml`:
```toml
name = "timetracker"
compatibility_date = "2024-09-01"

[[d1_databases]]
binding = "DB"
database_name = "timetracker-db"
database_id = "<from wrangler d1 create>"
```

## Deployment

1. Push to GitHub.
2. In Cloudflare dashboard: Pages → Connect to Git → pick the repo.
3. Build command: `pnpm build`. Output dir: `.svelte-kit/cloudflare`.
4. In Pages settings, bind the D1 database (same name `DB`).
5. Add `APP_PASSWORD` and `SESSION_SECRET` as environment variables (Production).
6. Run the migration against the production DB once:
   `npx wrangler d1 execute timetracker-db --remote --file=./drizzle/0000_init.sql`
7. Deploy.

Future schema changes: generate a new migration with `drizzle-kit generate`, run it with `--remote`. There's no automated migration runner — that's fine for a one-person app, just don't forget the step.

## Free tier reality check

Cloudflare Pages free tier (as of writing): 100k requests/day, unlimited bandwidth. D1 free tier: 5 GB storage, 5M reads/day, 100k writes/day. A personal time tracker uses roughly none of this. You will not hit limits.

## Build order (suggested)

Don't try to build everything in parallel. This sequence keeps you unblocked:

1. **Scaffold + deploy a "hello world".** Get the SvelteKit → Pages pipeline working before anything else. One afternoon.
2. **Auth.** Login page, hooks, logout. Confirm it works in production.
3. **Schema + projects CRUD.** No tasks, no timers yet. Just create/list/rename/archive projects.
4. **Tasks under projects.** Same shape as projects.
5. **Manual time entries.** No timer yet — just a form to log a past entry on a task.
6. **Live timer.** Start/stop, the transactional invariant, dashboard widget.
7. **Edit/delete entries.** Last because it's the least critical — you can delete via SQL in a pinch.
8. **Polish.** Total-time displays, sensible mobile layout.

After step 6 you have a usable app. Steps 7–8 are where premature feature creep lives — be ruthless.

## Locked decisions

1. **Time display:** HH:MM. Format helper goes in `src/lib/format.ts`. `formatDuration(ms)` returns `"1:30"`, `"0:05"`, `"12:34"`. No seconds.
2. **Week start:** Monday. Use `date-fns` with `{ weekStartsOn: 1 }` if/when weekly views land. Not needed for v1.
3. **Deletes are soft.** Add `deleted_at` (nullable timestamp) to `tasks` and `time_entries`. Every read query filters `WHERE deleted_at IS NULL`. Projects already have `archived` — don't add a second flag, archive *is* the project-level soft-delete. Cascade: deleting a task soft-deletes its entries; archiving a project does **not** soft-delete its tasks (archive is reversible, the data stays queryable).
4. **Archived projects in the task picker:** show their tasks greyed-out and at the bottom of the list, not hidden. You can still log time against them (sometimes you remember a session from last week on a project you just archived).