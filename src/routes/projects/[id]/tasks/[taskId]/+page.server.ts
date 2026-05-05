import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { parseId, requireDb } from '$lib/server/db';
import { projects, tasks, timeEntries } from '$lib/server/schema';
import {
	getRunningEntry,
	getTaskInProject,
	listTasksForPicker,
	softDeleteTask,
	startTimer,
	stopTimer
} from '$lib/server/queries';

const ENTRIES_LIMIT = 100;

function validateRange(
	startStr: string,
	endStr: string
): { ok: true; s: Date; e: Date } | { ok: false; error: string } {
	if (!startStr || !endStr) return { ok: false, error: 'start + end required' };
	const s = new Date(startStr);
	const e = new Date(endStr);
	if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
		return { ok: false, error: 'bad date' };
	}
	if (s >= e) return { ok: false, error: 'start must be before end' };
	return { ok: true, s, e };
}

export const load: PageServerLoad = async ({ params, platform }) => {
	const projectIdNum = parseId(params.id);
	const taskIdNum = parseId(params.taskId);
	if (projectIdNum === null || taskIdNum === null) throw error(400, 'bad id');

	const db = requireDb(platform);
	const [task, [project], entries, running, pickerTasks] = await Promise.all([
		getTaskInProject(db, projectIdNum, taskIdNum),
		db.select().from(projects).where(eq(projects.id, projectIdNum)),
		db
			.select()
			.from(timeEntries)
			.where(and(eq(timeEntries.taskId, taskIdNum), isNull(timeEntries.deletedAt)))
			.orderBy(desc(timeEntries.startedAt))
			.limit(ENTRIES_LIMIT),
		getRunningEntry(db),
		listTasksForPicker(db)
	]);
	if (!task) throw error(404, 'task not found');
	if (!project) throw error(404, 'project not found');

	return { project, task, entries, running, pickerTasks };
};

export const actions: Actions = {
	updateTask: async ({ params, request, platform }) => {
		const projectIdNum = parseId(params.id);
		const taskIdNum = parseId(params.taskId);
		if (projectIdNum === null || taskIdNum === null) return fail(400, { error: 'bad id' });

		const db = requireDb(platform);
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const description = String(data.get('description') ?? '').trim() || null;
		if (!name) return fail(400, { error: 'name required' });

		await db
			.update(tasks)
			.set({ name, description })
			.where(
				and(
					eq(tasks.id, taskIdNum),
					eq(tasks.projectId, projectIdNum),
					isNull(tasks.deletedAt)
				)
			);
		return { ok: true };
	},

	addEntry: async ({ params, request, platform }) => {
		const projectIdNum = parseId(params.id);
		const taskIdNum = parseId(params.taskId);
		if (projectIdNum === null || taskIdNum === null) return fail(400, { error: 'bad id' });

		const db = requireDb(platform);
		const task = await getTaskInProject(db, projectIdNum, taskIdNum);
		if (!task) return fail(404, { error: 'task not found' });

		const data = await request.formData();
		const note = String(data.get('note') ?? '').trim() || null;
		const r = validateRange(
			String(data.get('startedAt') ?? '').trim(),
			String(data.get('endedAt') ?? '').trim()
		);
		if (!r.ok) return fail(400, { error: r.error });

		await db.insert(timeEntries).values({
			taskId: taskIdNum,
			startedAt: r.s.toISOString(),
			endedAt: r.e.toISOString(),
			note
		});
		return { ok: true };
	},

	start: async ({ params, platform }) => {
		const projectIdNum = parseId(params.id);
		const taskIdNum = parseId(params.taskId);
		if (projectIdNum === null || taskIdNum === null) return fail(400, { error: 'bad id' });

		const db = requireDb(platform);
		const task = await getTaskInProject(db, projectIdNum, taskIdNum);
		if (!task) return fail(404, { error: 'task not found' });

		await startTimer(db, taskIdNum);
		return { ok: true };
	},

	stop: async ({ platform }) => {
		await stopTimer(requireDb(platform));
		return { ok: true };
	},

	updateEntry: async ({ request, platform }) => {
		const db = requireDb(platform);
		const data = await request.formData();
		const id = parseId(data.get('id')?.toString());
		const newTaskId = parseId(data.get('taskId')?.toString());
		const note = String(data.get('note') ?? '').trim() || null;

		if (id === null || newTaskId === null) return fail(400, { error: 'bad id' });

		const r = validateRange(
			String(data.get('startedAt') ?? '').trim(),
			String(data.get('endedAt') ?? '').trim()
		);
		if (!r.ok) return fail(400, { error: r.error });

		const [target] = await db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, newTaskId), isNull(tasks.deletedAt)));
		if (!target) return fail(404, { error: 'target task not found' });

		await db
			.update(timeEntries)
			.set({
				taskId: newTaskId,
				startedAt: r.s.toISOString(),
				endedAt: r.e.toISOString(),
				note
			})
			.where(and(eq(timeEntries.id, id), isNull(timeEntries.deletedAt)));
		return { ok: true };
	},

	deleteTask: async ({ params, platform }) => {
		const projectIdNum = parseId(params.id);
		const taskIdNum = parseId(params.taskId);
		if (projectIdNum === null || taskIdNum === null) return fail(400, { error: 'bad id' });

		const db = requireDb(platform);
		const task = await getTaskInProject(db, projectIdNum, taskIdNum);
		if (!task) return fail(404, { error: 'task not found' });

		await softDeleteTask(db, taskIdNum);
		throw redirect(303, `/projects/${projectIdNum}`);
	},

	deleteEntry: async ({ request, platform }) => {
		const db = requireDb(platform);
		const data = await request.formData();
		const id = parseId(data.get('id')?.toString());
		if (id === null) return fail(400, { error: 'bad id' });
		const now = new Date().toISOString();
		await db
			.update(timeEntries)
			.set({ deletedAt: now })
			.where(and(eq(timeEntries.id, id), isNull(timeEntries.deletedAt)));
		return { ok: true };
	}
};
