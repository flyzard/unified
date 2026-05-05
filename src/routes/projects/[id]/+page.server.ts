import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { parseId, requireDb } from '$lib/server/db';
import { projects, tasks, timeEntries } from '$lib/server/schema';

export const load: PageServerLoad = async ({ params, platform }) => {
	const id = parseId(params.id);
	if (id === null) throw error(400, 'bad id');

	const db = requireDb(platform);
	const [[project], taskRows, totals] = await Promise.all([
		db.select().from(projects).where(eq(projects.id, id)),
		db
			.select()
			.from(tasks)
			.where(and(eq(tasks.projectId, id), isNull(tasks.deletedAt)))
			.orderBy(tasks.done, tasks.name),
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
			.groupBy(timeEntries.taskId)
	]);
	if (!project) throw error(404, 'project not found');

	const totalSecByTask: Record<number, number> = {};
	let projectTotalSec = 0;
	for (const t of totals) {
		const sec = Number(t.totalSec) || 0;
		totalSecByTask[t.taskId] = sec;
		projectTotalSec += sec;
	}

	return { project, tasks: taskRows, totalSecByTask, projectTotalSec };
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
		await db.insert(tasks).values({ projectId: id, name });
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
	}
};
