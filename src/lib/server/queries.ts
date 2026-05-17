import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from './db';
import { projects, tasks, timeEntries } from './schema';

export async function getRunningEntry(db: DB) {
	const [row] = await db
		.select({
			entry: timeEntries,
			task: tasks,
			project: projects
		})
		.from(timeEntries)
		.innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
		.innerJoin(projects, eq(projects.id, tasks.projectId))
		.where(and(isNull(timeEntries.endedAt), isNull(timeEntries.deletedAt)))
		.limit(1);
	return row ?? null;
}

export async function getTaskInProject(db: DB, projectId: number, taskId: number) {
	const [task] = await db
		.select()
		.from(tasks)
		.where(
			and(
				eq(tasks.id, taskId),
				eq(tasks.projectId, projectId),
				isNull(tasks.deletedAt)
			)
		);
	return task ?? null;
}

export async function startTimer(db: DB, taskId: number) {
	const now = new Date().toISOString();
	await db.batch([
		db
			.update(timeEntries)
			.set({ endedAt: now })
			.where(and(isNull(timeEntries.endedAt), isNull(timeEntries.deletedAt))),
		db.insert(timeEntries).values({ taskId, startedAt: now })
	]);
}

export async function stopTimer(db: DB) {
	const now = new Date().toISOString();
	await db
		.update(timeEntries)
		.set({ endedAt: now })
		.where(and(isNull(timeEntries.endedAt), isNull(timeEntries.deletedAt)));
}

export async function listTasksForPicker(db: DB) {
	return db
		.select({
			id: tasks.id,
			name: tasks.name,
			projectId: projects.id,
			projectName: projects.name,
			projectArchived: projects.archived
		})
		.from(tasks)
		.innerJoin(projects, eq(tasks.projectId, projects.id))
		.where(isNull(tasks.deletedAt))
		.orderBy(projects.archived, projects.name, tasks.sortOrder);
}

// Soft-delete task, stop running timer if it was on this task,
// cascade soft-delete its entries. Atomic via db.batch().
export async function softDeleteTask(db: DB, taskId: number) {
	const now = new Date().toISOString();
	await db.batch([
		db
			.update(timeEntries)
			.set({ endedAt: now })
			.where(
				and(
					eq(timeEntries.taskId, taskId),
					isNull(timeEntries.endedAt),
					isNull(timeEntries.deletedAt)
				)
			),
		db
			.update(timeEntries)
			.set({ deletedAt: now })
			.where(and(eq(timeEntries.taskId, taskId), isNull(timeEntries.deletedAt))),
		db
			.update(tasks)
			.set({ deletedAt: now })
			.where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
	]);
}
