import type { Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, checkPassword, createSessionCookie } from '$lib/server/auth';

export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		if (!platform) throw error(500, 'platform unavailable');
		const env = platform.env;

		const data = await request.formData();
		const password = String(data.get('password') ?? '');

		const ok = await checkPassword(password, env.APP_PASSWORD, env.SESSION_SECRET);
		if (!ok) return fail(401, { error: 'wrong password' });

		const { value, maxAge } = await createSessionCookie(env.SESSION_SECRET);
		cookies.set(SESSION_COOKIE, value, {
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			path: '/',
			maxAge
		});

		throw redirect(303, '/projects');
	}
};
