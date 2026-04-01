import { randomUUID } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { and, eq, gt } from 'drizzle-orm';
import { ensureDatabaseReady } from '$lib/server/bootstrap';
import { db } from '$lib/server/db/client';
import { sessions } from '$lib/server/db/schema';
import { generateSessionToken, hashSessionToken } from '$lib/server/security';
import { getUserById } from '$lib/server/state';

const SESSION_COOKIE = 'prode_session';

function sessionMaxAge(): number {
	const days = Number(env.SESSION_DURATION_DAYS || '30');
	return Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 : 30 * 24 * 60 * 60;
}

function cookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: env.NODE_ENV === 'production',
		maxAge: sessionMaxAge()
	};
}

export async function createSession(cookies: Cookies, userId: string): Promise<void> {
	await ensureDatabaseReady();
	const rawToken = generateSessionToken();
	const now = Date.now();
	const expiresAt = new Date(now + sessionMaxAge() * 1000).toISOString();

	await db.insert(sessions).values({
		id: randomUUID(),
		tokenHash: hashSessionToken(rawToken),
		userId: Number(userId),
		expiresAt,
		createdAt: new Date(now).toISOString()
	});

	cookies.set(SESSION_COOKIE, rawToken, cookieOptions());
}

export async function clearSessionCookie(cookies: Cookies): Promise<void> {
	await ensureDatabaseReady();
	const rawToken = cookies.get(SESSION_COOKIE);
	if (rawToken) {
		await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(rawToken)));
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function getSessionUser(cookies: Cookies) {
	await ensureDatabaseReady();
	const rawToken = cookies.get(SESSION_COOKIE);
	if (!rawToken) return null;

	const [session] = await db
		.select()
		.from(sessions)
		.where(and(eq(sessions.tokenHash, hashSessionToken(rawToken)), gt(sessions.expiresAt, new Date().toISOString())))
		.limit(1);

	if (!session) {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		return null;
	}

	return getUserById(String(session.userId));
}
