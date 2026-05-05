import { error } from '@sveltejs/kit';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type DB = ReturnType<typeof getDb>;

export function getDb(env: Env) {
	return drizzle(env.DB, { schema });
}

export function requireDb(platform: App.Platform | undefined): DB {
	if (!platform) throw error(500, 'platform unavailable');
	return getDb(platform.env);
}

export function parseId(v: string | undefined): number | null {
	if (v === undefined) return null;
	const n = Number(v);
	return Number.isInteger(n) && n > 0 ? n : null;
}
