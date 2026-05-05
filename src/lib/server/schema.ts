import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	description: text('description'),
	archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const tasks = sqliteTable(
	'tasks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		projectId: integer('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		done: integer('done', { mode: 'boolean' }).notNull().default(false),
		deletedAt: text('deleted_at'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(t) => [index('tasks_project_deleted').on(t.projectId, t.deletedAt)]
);

export const timeEntries = sqliteTable(
	'time_entries',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		taskId: integer('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		startedAt: text('started_at').notNull(),
		endedAt: text('ended_at'),
		note: text('note'),
		deletedAt: text('deleted_at'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(t) => [
		index('time_entries_task_deleted').on(t.taskId, t.deletedAt),
		index('time_entries_running')
			.on(t.endedAt)
			.where(sql`ended_at IS NULL`)
	]
);

export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
