import { createClient } from '@libsql/client';
import process from 'node:process';

const databaseUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const requiredTables = [
	'users',
	'sessions',
	'audit_logs',
	'tournaments',
	'user_tournaments',
	'tournament_matches',
	'tournament_predictions',
	'schema_migrations'
];

const client = createClient({
	url: databaseUrl,
	authToken: authToken || undefined
});

try {
	const tablesResult = await client.execute(
		"SELECT name FROM sqlite_master WHERE type = 'table';"
	);

	const tableNames = new Set(
		tablesResult.rows
			.map((row) => row.name)
			.filter((name) => typeof name === 'string')
	);

	const missing = requiredTables.filter((table) => !tableNames.has(table));
	if (missing.length > 0) {
		throw new Error(`Missing required tables: ${missing.join(', ')}`);
	}

	const migrationResult = await client.execute(
		'SELECT version, name, applied_at FROM schema_migrations ORDER BY version DESC LIMIT 1;'
	);

	const latest = migrationResult.rows[0];
	if (!latest) {
		throw new Error('schema_migrations exists but has no applied versions');
	}

	console.log('[smoke:db] ok', {
		databaseUrl,
		latestVersion: latest.version,
		latestName: latest.name,
		appliedAt: latest.applied_at
	});
} finally {
	await client.close();
}
