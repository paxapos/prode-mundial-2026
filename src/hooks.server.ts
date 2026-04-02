import type { Handle } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	try {
		event.locals.user = await getSessionUser(event.cookies);
	} catch (err) {
		console.error('[db-init] session bootstrap failed', err);
		event.locals.user = null;
	}
	return resolve(event);
};
