import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { parseId, requireDb } from '$lib/server/db';
import { projects } from '$lib/server/schema';
import { getRunningEntry, stopTimer } from '$lib/server/queries';

export const load: PageServerLoad = async ({ platform }) => {
	const db = requireDb(platform);
	const [rows, running] = await Promise.all([
		db.select().from(projects).orderBy(projects.archived, projects.name),
		getRunningEntry(db)
	]);
	return { projects: rows, running };
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		const db = requireDb(platform);
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'name required' });
		await db.insert(projects).values({ name });
		return { ok: true };
	},

	archive: async ({ request, platform }) => {
		const db = requireDb(platform);
		const data = await request.formData();
		const id = parseId(data.get('id')?.toString());
		const archived = data.get('archived') === 'true';
		if (id === null) return fail(400, { error: 'bad id' });
		await db.update(projects).set({ archived }).where(eq(projects.id, id));
		return { ok: true };
	},

	stop: async ({ platform }) => {
		await stopTimer(requireDb(platform));
		return { ok: true };
	}
};
