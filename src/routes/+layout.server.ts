import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => ({
	authenticated: locals.session.authenticated,
	pathname: url.pathname
});
