import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { and, eq, gt, isNotNull, isNull, lt, sql, desc, asc } from 'drizzle-orm';
import { parseId, requireDb } from '$lib/server/db';
import { projects, tasks, timeEntries } from '$lib/server/schema';
import { getRunningEntry, getTaskInProject, startTimer, stopTimer } from '$lib/server/queries';

export const load: PageServerLoad = async ({ params, platform }) => {
	const id = parseId(params.id);
	if (id === null) throw error(400, 'bad id');

	const db = requireDb(platform);
	const [[project], taskRows, totals, running] = await Promise.all([
		db.select().from(projects).where(eq(projects.id, id)),
		db
			.select()
			.from(tasks)
			.where(and(eq(tasks.projectId, id), isNull(tasks.deletedAt)))
			.orderBy(tasks.done, tasks.sortOrder),
		db
			.select({
				taskId: timeEntries.taskId,
				totalSec: sql<number>`SUM(strftime('%s', ${timeEntries.endedAt}) - strftime('%s', ${timeEntries.startedAt}))`
			})
			.from(timeEntries)
			.innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
			.where(
				and(
					eq(tasks.projectId, id),
					isNull(tasks.deletedAt),
					isNull(timeEntries.deletedAt),
					isNotNull(timeEntries.endedAt)
				)
			)
			.groupBy(timeEntries.taskId),
		getRunningEntry(db)
	]);
	if (!project) throw error(404, 'project not found');

	const totalSecByTask: Record<number, number> = {};
	let projectTotalSec = 0;
	for (const t of totals) {
		const sec = Number(t.totalSec) || 0;
		totalSecByTask[t.taskId] = sec;
		projectTotalSec += sec;
	}

	return { project, tasks: taskRows, totalSecByTask, projectTotalSec, running };
};

export const actions: Actions = {
	rename: async ({ params, request, platform }) => {
		const id = parseId(params.id);
		if (id === null) return fail(400, { error: 'bad project id' });
		const db = requireDb(platform);
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'name required' });
		await db.update(projects).set({ name }).where(eq(projects.id, id));
		return { ok: true };
	},

	createTask: async ({ params, request, platform }) => {
		const id = parseId(params.id);
		if (id === null) return fail(400, { error: 'bad project id' });
		const db = requireDb(platform);
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'task name required' });
		const [{ max }] = await db
			.select({ max: sql<number>`COALESCE(MAX(${tasks.sortOrder}), -1)` })
			.from(tasks)
			.where(and(eq(tasks.projectId, id), isNull(tasks.deletedAt)));
		await db.insert(tasks).values({ projectId: id, name, sortOrder: max + 1 });
		return { ok: true };
	},

	toggleDone: async ({ request, platform }) => {
		const db = requireDb(platform);
		const data = await request.formData();
		const taskId = parseId(data.get('taskId')?.toString());
		const done = data.get('done') === 'true';
		if (taskId === null) return fail(400, { error: 'bad task id' });
		await db
			.update(tasks)
			.set({ done })
			.where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)));
		return { ok: true };
	},

	start: async ({ params, request, platform }) => {
		const projectId = parseId(params.id);
		if (projectId === null) return fail(400, { error: 'bad project id' });
		const db = requireDb(platform);
		const data = await request.formData();
		const taskId = parseId(data.get('taskId')?.toString());
		if (taskId === null) return fail(400, { error: 'bad task id' });
		const task = await getTaskInProject(db, projectId, taskId);
		if (!task) return fail(404, { error: 'task not found' });
		await startTimer(db, taskId);
		return { ok: true };
	},

	stop: async ({ platform }) => {
		const db = requireDb(platform);
		await stopTimer(db);
		return { ok: true };
	},

	moveUp: async ({ params, request, platform }) => {
		const projectId = parseId(params.id);
		if (projectId === null) return fail(400, { error: 'bad project id' });
		const db = requireDb(platform);
		const data = await request.formData();
		const taskId = parseId(data.get('taskId')?.toString());
		if (taskId === null) return fail(400, { error: 'bad task id' });

		const [current] = await db.select().from(tasks).where(eq(tasks.id, taskId));
		if (!current) return fail(404, { error: 'task not found' });

		const [prev] = await db
			.select()
			.from(tasks)
			.where(
				and(
					eq(tasks.projectId, projectId),
					eq(tasks.done, current.done),
					lt(tasks.sortOrder, current.sortOrder),
					isNull(tasks.deletedAt)
				)
			)
			.orderBy(desc(tasks.sortOrder))
			.limit(1);
		if (!prev) return { ok: true };

		await db.batch([
			db.update(tasks).set({ sortOrder: prev.sortOrder }).where(eq(tasks.id, current.id)),
			db.update(tasks).set({ sortOrder: current.sortOrder }).where(eq(tasks.id, prev.id))
		]);
		return { ok: true };
	},

	moveDown: async ({ params, request, platform }) => {
		const projectId = parseId(params.id);
		if (projectId === null) return fail(400, { error: 'bad project id' });
		const db = requireDb(platform);
		const data = await request.formData();
		const taskId = parseId(data.get('taskId')?.toString());
		if (taskId === null) return fail(400, { error: 'bad task id' });

		const [current] = await db.select().from(tasks).where(eq(tasks.id, taskId));
		if (!current) return fail(404, { error: 'task not found' });

		const [next] = await db
			.select()
			.from(tasks)
			.where(
				and(
					eq(tasks.projectId, projectId),
					eq(tasks.done, current.done),
					gt(tasks.sortOrder, current.sortOrder),
					isNull(tasks.deletedAt)
				)
			)
			.orderBy(asc(tasks.sortOrder))
			.limit(1);
		if (!next) return { ok: true };

		await db.batch([
			db.update(tasks).set({ sortOrder: next.sortOrder }).where(eq(tasks.id, current.id)),
			db.update(tasks).set({ sortOrder: current.sortOrder }).where(eq(tasks.id, next.id))
		]);
		return { ok: true };
	}
};
