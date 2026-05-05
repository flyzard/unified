# Time Tracker — Requirements

A personal time tracker. Single user, password-protected. SvelteKit on Cloudflare Pages, free tier.

## Goals

- Know where your time goes across projects.
- Track time live (start/stop) **or** log it after the fact.
- Edit and annotate entries without friction.
- Stay deployable on Cloudflare's free tier indefinitely.

## Non-goals (deliberate)

- Multi-user, teams, sharing, permissions.
- Invoicing, billable rates, client management.
- Integrations (Toggl import, calendar sync, GitHub, Slack).
- Pomodoro, idle detection, screenshots, "productivity scoring".
- Native or mobile apps. The web app must be usable on mobile, but that's it.
- Reports, charts, CSV export. *Not in v1.* Easy to add later once data exists.

If you find yourself wanting any of these mid-build, write it down and keep going.

## Data model

Three tables. No more.

**`projects`** — `id`, `name`, `description` (nullable), `archived` (bool), `created_at`.

**`tasks`** — `id`, `project_id` (FK), `name`, `description` (nullable), `done` (bool), `created_at`. A task always belongs to a project.

**`time_entries`** — `id`, `task_id` (FK), `started_at`, `ended_at` (nullable — null means timer is currently running), `note` (nullable), `created_at`. Time is always logged against a task, not a bare project. This keeps the model simple — if you want to log "general project work", make a task called "general".

**Active timer rule:** at most one entry across the whole DB has `ended_at = NULL`. The UI enforces this; starting a new timer auto-stops any running one.

## Auth

Single password, set via an environment variable (`APP_PASSWORD`). Login posts the password; server compares and sets a signed, HTTP-only session cookie. No user table, no password reset flow, no email. If you forget it, redeploy with a new env var.

This is the right level of security for a personal tool. Don't build OAuth.

## Routes (SvelteKit)

Pages:
- `/login` — password form.
- `/` — dashboard. Shows the currently-running timer (if any) and a list of recent entries. Big "start timer" affordance with a task picker.
- `/projects` — list of projects, create new.
- `/projects/[id]` — project detail. Shows its tasks, total time spent on the project, and lets you add tasks.
- `/projects/[id]/tasks/[taskId]` — task detail. Shows entries for this task, lets you add manual entries, edit notes, delete entries.

Server actions handle all mutations (form actions, no separate API). Auth check lives in `hooks.server.ts`.

## MVP feature checklist

1. Login with password, logout.
2. Create / rename / archive / unarchive projects.
3. Create / rename / mark-done tasks under a project.
4. Start timer on a task → stops any other running timer.
5. Stop the running timer.
6. Add a manual entry (pick task, set start + end, optional note).
7. Edit any past entry (times, note, reassign to a different task).
8. Soft-delete any past entry. Soft-delete any task (cascades to its entries).
9. On project page: total time per task, total for the project. Display as `H:MM`.
10. On task page: list of entries with notes, newest first. Display durations as `H:MM`.

That's it. If something isn't on this list, it's v2.

## UX rules (locked)

- **Time format:** always `H:MM` (e.g. `0:05`, `1:30`, `12:34`). Never decimals, never seconds.
- **Week starts Monday.** Only matters when weekly summaries arrive (post-v1).
- **Deletes are soft.** A "deleted" entry is hidden from all views but recoverable via SQL. No undo UI in v1 — the soft-delete is your safety net, not a user feature.
- **Task picker shows archived projects' tasks greyed-out at the bottom.** Don't hide them; you'll occasionally need to log time against a just-archived project.

## Stack

- **SvelteKit** with `@sveltejs/adapter-cloudflare`.
- **Cloudflare Pages** for hosting (free, generous limits).
- **Cloudflare D1** (SQLite) for the database. Free tier covers this easily.
- **Drizzle ORM** for schema + migrations. Lightweight, types are good, Cloudflare-friendly.
- **Tailwind** for styling — fastest path to "looks fine, not ugly".
- No client-side state library. Svelte stores + form actions are enough.

## Things that will tempt you. Don't.

- Building a "flexible tagging system". You picked tasks-under-projects; that's the taxonomy.
- Adding a rich-text editor for notes. Plain textarea.
- Realtime sync across tabs. Refresh works.
- A separate "today view" / "week view" / "month view". One list, filter later.
- Writing your own auth. The single-password approach above is the whole auth system.

## What "done" looks like for v1

You can deploy it, log in from your phone, start a timer for a task on a project, stop it later, and see how much time you spent on that project this week by glancing at the project page. Then you actually use it for two weeks before adding anything.