import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { buildGoogleAuthUrl, generateOAuthState } from '$lib/server/google-oauth';

export const GET: RequestHandler = async ({ cookies }) => {
	if (!env.GOOGLE_CLIENT_ID) {
		throw redirect(303, '/login?error=google_not_configured');
	}

	const state = generateOAuthState();
	// Store state in a short-lived HttpOnly cookie to prevent CSRF
	cookies.set('oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: env.NODE_ENV === 'production',
		maxAge: 60 * 10 // 10 minutes
	});

	throw redirect(303, buildGoogleAuthUrl(state));
};
