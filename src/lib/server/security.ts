import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const derived = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
	const [salt, hash] = storedHash.split(':');
	if (!salt || !hash) return false;
	const derived = scryptSync(password, salt, 64);
	const original = Buffer.from(hash, 'hex');
	if (derived.length !== original.length) return false;
	return timingSafeEqual(derived, original);
}

export function generateSessionToken(): string {
	return randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}
