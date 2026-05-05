# Time Tracker — Requirements

Personal time tracker. Single user, password-protected. Stack details in `arquitecture.md`.

## Goals

- Know where time goes across projects.
- Track live (start/stop) **or** log after the fact.
- Edit and annotate entries without friction.
- Stay on Cloudflare free tier indefinitely.

## Non-goals

- Multi-user, teams, sharing, permissions.
- Invoicing, billable rates, clients.
- Integrations (Toggl, calendar, GitHub, Slack).
- Pomodoro, idle detection, screenshots, productivity scoring.
- Native/mobile apps. Web must work on mobile, that's it.
- Reports, charts, CSV export. Not v1.

Want any of these mid-build → write down, keep going.

## Data model (concept)

Three tables. No more. Field types/constraints in `arquitecture.md` §Database schema.

- **`projects`** — name, optional description, archive flag.
- **`tasks`** — belong to a project. Have done flag. Soft-deletable.
- **`time_entries`** — belong to a task. Have start, optional end (null = running), optional note. Soft-deletable.

Time always logged against a task, never a bare project. Want "general project work" → make a task called `general`.

## Active timer rule

At most one `time_entries` row across the DB has `ended_at = NULL`. Starting a new timer auto-stops any running one. Implementation: `arquitecture.md` §One running timer.

## Auth

Single password via `APP_PASSWORD` env var. Login posts password → server compares → sets signed httpOnly session cookie. No user table, no reset flow, no email. Forgot it → redeploy with new env var. Implementation: `arquitecture.md` §Auth.

## Routes (user-facing)

- `/login` — password form.
- `/` — redirects to `/projects`.
- `/projects` — landing page. Running-timer widget at top (if any) + Stop button. Project list, create, archive/unarchive. Logout.
- `/projects/[id]` — project detail. Tasks list (+ per-task and project totals), add task, rename/done/delete-task.
- `/projects/[id]/tasks/[taskId]` — task detail. Start/Stop timer for this task, add manual entry, edit/reassign/delete entry.

All mutations via SvelteKit form actions. No separate API.

## MVP feature checklist

1. Login, logout.
2. Create / rename / archive / unarchive projects.
3. Create / rename / mark-done tasks under a project.
4. Start timer on a task → stops any other running timer.
5. Stop running timer.
6. Add manual entry (pick task, set start + end, optional note).
7. Edit any past entry (times, note, reassign task).
8. Soft-delete any past entry. Soft-delete any task (cascades to its entries).
9. Project page: total time per task, total for project. `H:MM:SS`.
10. Task page: entries with notes, newest first. Durations `H:MM:SS`.

Not on this list → v2.

## UX rules (locked)

- **Time format `H:MM:SS`** everywhere (`0:00:30`, `1:30:00`, `12:34:56`). Never decimals.
- **Week starts Monday.** Only matters post-v1 (weekly summaries).
- **Deletes are soft.** Hidden from all views, recoverable via SQL. No undo UI in v1 — soft-delete is safety net, not user feature.
- **Archived projects' tasks** appear in task picker greyed-out at bottom. Don't hide. Sometimes you log time against a just-archived project.
- **Cascade rule:** deleting a task soft-deletes its entries. Archiving a project does **not** soft-delete its tasks (archive is reversible, data stays queryable). Projects use `archived` flag, not `deleted_at` — archive *is* the project soft-delete.

## Things that will tempt you. Don't.

- "Flexible tagging system". You picked tasks-under-projects. That's the taxonomy.
- Rich-text editor for notes. Plain textarea.
- Realtime cross-tab sync. Refresh works.
- Separate today/week/month views. One list, filter later.
- Custom auth schemes beyond the single password above.

## Done (v1)

Deploy. Log in from phone. Start timer for task on project. Stop later. Glance at project page → see week's time. Then actually use it for two weeks before adding anything.
