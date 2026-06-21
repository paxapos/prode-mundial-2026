import { createClient } from '@libsql/client';
import { execSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';

// Parseo simple de .env.cloudrun (sin dependencia dotenv)
function loadEnvFile(path) {
	const out = {};
	if (!existsSync(path)) return out;
	for (const raw of readFileSync(path, 'utf8').split('\n')) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq === -1) continue;
		out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
	}
	return out;
}

const env = loadEnvFile('.env.cloudrun');
const PROD_URL = env.TURSO_DATABASE_URL;
const PROD_TOKEN = env.TURSO_AUTH_TOKEN;
if (!PROD_URL || !PROD_URL.startsWith('libsql://')) {
	throw new Error('TURSO_DATABASE_URL de prod no configurada en .env.cloudrun (esperaba libsql://...)');
}

const SNAP = 'snapshot.db';
if (existsSync(SNAP)) rmSync(SNAP);

// 1) Crear el esquema local con drizzle push apuntando al snapshot
console.log('· Creando esquema en snapshot.db con drizzle push...');
execSync('pnpm drizzle-kit push --force', {
	stdio: 'inherit',
	env: { ...process.env, TURSO_DATABASE_URL: `file:${SNAP}`, TURSO_AUTH_TOKEN: '' }
});

// 2) Copiar datos (SOLO SELECT contra prod — cero escrituras)
const prod = createClient({ url: PROD_URL, authToken: PROD_TOKEN });
const local = createClient({ url: `file:${SNAP}` });

const TABLES = ['tournaments', 'users', 'user_tournaments', 'tournament_matches', 'tournament_predictions'];
for (const table of TABLES) {
	const { rows, columns } = await prod.execute(`SELECT * FROM ${table}`);
	if (rows.length === 0) {
		console.log(`· ${table}: 0 filas`);
		continue;
	}
	const cols = columns.join(', ');
	const placeholders = columns.map(() => '?').join(', ');
	for (const row of rows) {
		const values = columns.map((c) => row[c]);
		await local.execute({ sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, args: values });
	}
	console.log(`· ${table}: ${rows.length} filas copiadas`);
}
console.log(`OK snapshot -> ${SNAP} (read-only desde prod, sin escrituras)`);
