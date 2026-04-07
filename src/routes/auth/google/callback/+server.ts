import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCodeForTokens, getGoogleUserInfo } from '$lib/server/google-oauth';
import { findOrCreateGoogleUser } from '$lib/server/state';
import { createSession } from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const storedState = cookies.get('oauth_state');

	// Always clear the state cookie
	cookies.delete('oauth_state', { path: '/' });

	if (error) {
		throw redirect(303, `/login?error=${encodeURIComponent(error)}`);
	}

	if (!code || !state || !storedState || state !== storedState) {
		throw redirect(303, '/login?error=oauth_state_mismatch');
	}

	let user;
	let isNew = false;
	try {
		const tokens = await exchangeCodeForTokens(code);
		const googleUser = await getGoogleUserInfo(tokens.access_token);
		const result = await findOrCreateGoogleUser({
			googleId: googleUser.sub,
			email: googleUser.email,
			name: googleUser.name,
			avatarUrl: googleUser.picture
		});
		user = result.user;
		isNew = result.isNew;
	} catch {
		throw redirect(303, '/login?error=google_auth_failed');
	}

	await createSession(cookies, user.id);

	if (isNew) {
		throw redirect(303, '/login/complete-profile');
	}
	throw redirect(303, user.role === 'admin' ? '/admin' : '/prode');
};
