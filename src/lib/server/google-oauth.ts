import { env } from '$env/dynamic/private';
import { randomBytes } from 'node:crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleUserInfo {
	sub: string;
	email: string;
	name: string;
	picture?: string;
}

export function getCallbackUrl(): string {
	const origin = env.ORIGIN || 'http://localhost:5173';
	return `${origin}/auth/google/callback`;
}

export function buildGoogleAuthUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID ?? '',
		redirect_uri: getCallbackUrl(),
		response_type: 'code',
		scope: 'openid email profile',
		state,
		access_type: 'online'
	});
	return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function generateOAuthState(): string {
	return randomBytes(24).toString('hex');
}

export async function exchangeCodeForTokens(code: string): Promise<{ access_token: string }> {
	const body = new URLSearchParams({
		code,
		client_id: env.GOOGLE_CLIENT_ID ?? '',
		client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
		redirect_uri: getCallbackUrl(),
		grant_type: 'authorization_code'
	});

	const res = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString()
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Google token exchange failed: ${text}`);
	}

	return res.json();
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
	const res = await fetch(GOOGLE_USERINFO_URL, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!res.ok) {
		throw new Error('Failed to fetch Google user info');
	}

	return res.json();
}
