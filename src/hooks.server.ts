import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, verifySessionCookie } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const secret = event.platform?.env.SESSION_SECRET;
	const cookie = event.cookies.get(SESSION_COOKIE);
	const authed = !!secret && (await verifySessionCookie(secret, cookie));

	event.locals.session = { authenticated: authed };

	const onLogin = event.url.pathname === '/login';
	if (!authed && !onLogin) throw redirect(303, '/login');
	if (authed && onLogin) throw redirect(303, '/projects');

	return resolve(event);
};
