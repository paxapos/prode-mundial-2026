import { client, db } from '$lib/server/db/client';
import { count, and, eq } from 'drizzle-orm';
import { tournaments, tournamentMatches, userTournaments, users } from '$lib/server/db/schema';
import { defaultScoringConfig, serializeScoringConfig } from '$lib/scoring-config';
import { WORLD_CUP_2026_MATCHES } from '$lib/worldcup-2026-fixture';

const TOURNAMENT_ID = 'default-worldcup-2026';
const CURRENT_SCHEMA_VERSION = 1;

interface MatchSeed {
	id: string;
	tournamentId: string;
	stage: 'groups' | 'round32' | 'round16' | 'quarterfinal' | 'semifinal' | 'thirdplace' | 'final';
	groupCode: string | null;
	teamA: string;
	teamB: string;
	kickoffAt: string;
	venue: string | null;
	scoreA: null;
	scoreB: null;
	penaltyWinner: null;
	isClosed: false;
}

function getAllMatches(): MatchSeed[] {
	const T = TOURNAMENT_ID;
	return WORLD_CUP_2026_MATCHES.map((match) => ({
		...match,
		tournamentId: T,
		scoreA: null,
		scoreB: null,
		penaltyWinner: null,
		isClosed: false
	}));
}

function shouldSyncSeededTeamName(existingTeam: string, seededTeam: string, stage: MatchSeed['stage']): boolean {
	if (stage === 'groups') return true;
	if (existingTeam === seededTeam) return true;
	return /Grupo|R32|8vos|QF|SF|Ganador|Perdedor|Pendiente/.test(existingTeam);
}

async function syncSeedMatches(): Promise<void> {
	const allMatches = getAllMatches();
	for (const match of allMatches) {
		const [existing] = await db
			.select({
				id: tournamentMatches.id,
				isClosed: tournamentMatches.isClosed,
				teamA: tournamentMatches.teamA,
				teamB: tournamentMatches.teamB
			})
			.from(tournamentMatches)
			.where(eq(tournamentMatches.id, match.id))
			.limit(1);

		if (!existing) {
			await db.insert(tournamentMatches).values(match);
			continue;
		}

		if (existing.isClosed) continue;
		const setValues: Partial<typeof tournamentMatches.$inferInsert> = {
			tournamentId: match.tournamentId,
			stage: match.stage,
			groupCode: match.groupCode,
			kickoffAt: match.kickoffAt,
			venue: match.venue
		};
		if (shouldSyncSeededTeamName(existing.teamA, match.teamA, match.stage)) setValues.teamA = match.teamA;
		if (shouldSyncSeededTeamName(existing.teamB, match.teamB, match.stage)) setValues.teamB = match.teamB;

		await db
			.update(tournamentMatches)
			.set(setValues)
			.where(eq(tournamentMatches.id, match.id));
	}
}

let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

type ColumnSpec = {
	name: string;
	definition: string;
	backfillSql?: string;
};

function escapeSqlLiteral(value: string): string {
	return value.replaceAll("'", "''");
}

async function getTableColumnNames(tableName: string): Promise<Set<string>> {
	const result = await client.execute(`PRAGMA table_info(${tableName});`);
	const names = new Set<string>();

	for (const row of result.rows as Array<Record<string, unknown>>) {
		const name = typeof row.name === 'string' ? row.name : null;
		if (name) names.add(name);
	}

	return names;
}

async function ensureColumns(tableName: string, specs: ColumnSpec[]): Promise<void> {
	const existing = await getTableColumnNames(tableName);

	for (const spec of specs) {
		if (existing.has(spec.name)) continue;
		await client.execute(`ALTER TABLE ${tableName} ADD COLUMN ${spec.definition};`);
		if (spec.backfillSql) {
			await client.execute(spec.backfillSql);
		}
	}
}

async function migratePasswordHashNullable(): Promise<void> {
	// Check if password_hash is NOT NULL — if so, recreate the table to make it nullable
	const pragma = await client.execute('PRAGMA table_info(users);');
	const pwCol = (pragma.rows as Array<Record<string, unknown>>).find(
		(r) => r.name === 'password_hash'
	);
	if (!pwCol || Number(pwCol.notnull) === 0) return; // already nullable or doesn't exist

	await client.executeMultiple(`
		CREATE TABLE IF NOT EXISTS users_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL,
			nickname TEXT NOT NULL,
			password_hash TEXT,
			google_id TEXT,
			avatar_url TEXT,
			role TEXT NOT NULL DEFAULT 'player',
			created_at TEXT NOT NULL
		);
		INSERT INTO users_new SELECT id, username, nickname, password_hash, google_id, avatar_url, role, created_at FROM users;
		DROP TABLE users;
		ALTER TABLE users_new RENAME TO users;
		CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);
		CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_idx ON users(nickname);
		CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id) WHERE google_id IS NOT NULL;
	`);
}

async function createTables(): Promise<void> {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			nickname TEXT NOT NULL UNIQUE,
			password_hash TEXT,
			google_id TEXT,
			avatar_url TEXT,
			role TEXT NOT NULL DEFAULT 'player',
			created_at TEXT NOT NULL
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			token_hash TEXT NOT NULL UNIQUE,
			user_id INTEGER NOT NULL,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS audit_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			action TEXT NOT NULL,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			payload_json TEXT NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS tournaments (
			id TEXT PRIMARY KEY,
			alias TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			header_image_url TEXT NOT NULL,
			state TEXT NOT NULL DEFAULT 'open_predictions',
			start_at TEXT NOT NULL,
			lock_reason TEXT,
			scoring_config_json TEXT NOT NULL,
			parent_tournament_id TEXT,
			created_at TEXT NOT NULL
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS user_tournaments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			tournament_id TEXT NOT NULL,
			created_at TEXT NOT NULL,
			UNIQUE(user_id, tournament_id),
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS tournament_matches (
			id TEXT PRIMARY KEY,
			tournament_id TEXT NOT NULL,
			stage TEXT NOT NULL,
			group_code TEXT,
			team_a TEXT NOT NULL,
			team_b TEXT NOT NULL,
			kickoff_at TEXT NOT NULL,
			venue TEXT,
			score_a INTEGER,
			score_b INTEGER,
			penalty_winner TEXT,
			is_closed INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS tournament_predictions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			tournament_id TEXT NOT NULL,
			match_id TEXT NOT NULL,
			pred_a INTEGER NOT NULL,
			pred_b INTEGER NOT NULL,
			pred_penalty_winner TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			UNIQUE(user_id, tournament_id, match_id),
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
			FOREIGN KEY(match_id) REFERENCES tournament_matches(id) ON DELETE CASCADE
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			version INTEGER NOT NULL UNIQUE,
			name TEXT NOT NULL,
			applied_at TEXT NOT NULL
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS blog_posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			slug TEXT NOT NULL UNIQUE,
			title TEXT NOT NULL,
			excerpt TEXT NOT NULL,
			body TEXT NOT NULL,
			image_url TEXT,
			author_id INTEGER NOT NULL,
			published INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS team_group_adjustments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tournament_id TEXT NOT NULL,
			group_code TEXT NOT NULL,
			team TEXT NOT NULL,
			tiebreaker_points INTEGER NOT NULL DEFAULT 0,
			reason TEXT,
			created_at TEXT NOT NULL,
			FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
			UNIQUE(tournament_id, group_code, team)
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS prediction_edit_unlocks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			tournament_id TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			reason TEXT,
			created_by INTEGER,
			created_at TEXT NOT NULL,
			updated_by INTEGER,
			updated_at TEXT NOT NULL,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
			FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
			FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL,
			UNIQUE(user_id, tournament_id)
		);
	`);
	await client.execute(`
		CREATE TABLE IF NOT EXISTS prediction_locks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			tournament_id TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			reason TEXT,
			created_by INTEGER,
			created_at TEXT NOT NULL,
			updated_by INTEGER,
			updated_at TEXT NOT NULL,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
			FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
			FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL,
			UNIQUE(user_id, tournament_id)
		);
	`);
}

async function normalizeSchema(): Promise<void> {
	const scoringConfigDefault = serializeScoringConfig(defaultScoringConfig());
	const escapedScoringConfigDefault = escapeSqlLiteral(scoringConfigDefault);

	await ensureColumns('users', [
		{ name: 'nickname', definition: "nickname TEXT NOT NULL DEFAULT ''" },
		{ name: 'role', definition: "role TEXT NOT NULL DEFAULT 'player'" },
		{ name: 'created_at', definition: "created_at TEXT NOT NULL DEFAULT ''" },
		{ name: 'google_id', definition: 'google_id TEXT' },
		{ name: 'avatar_url', definition: 'avatar_url TEXT' }
	]);

	// Migrate password_hash from NOT NULL to nullable (required for Google OAuth users)
	await migratePasswordHashNullable();

	// Ensure google_id unique index exists
	await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id) WHERE google_id IS NOT NULL;');

	await ensureColumns('tournaments', [
		{ name: 'header_image_url', definition: "header_image_url TEXT NOT NULL DEFAULT ''" },
		{ name: 'state', definition: "state TEXT NOT NULL DEFAULT 'open_predictions'" },
		{ name: 'start_at', definition: "start_at TEXT NOT NULL DEFAULT ''" },
		{ name: 'lock_reason', definition: 'lock_reason TEXT' },
		{
			name: 'scoring_config_json',
			definition: "scoring_config_json TEXT NOT NULL DEFAULT '{}'",
			backfillSql: `UPDATE tournaments SET scoring_config_json = '${escapedScoringConfigDefault}' WHERE scoring_config_json IS NULL OR scoring_config_json = '{}' OR scoring_config_json = '';`
		},
		{ name: 'created_at', definition: "created_at TEXT NOT NULL DEFAULT ''" },
		{ name: 'parent_tournament_id', definition: 'parent_tournament_id TEXT' }
	]);

	await ensureColumns('tournament_matches', [
		{ name: 'tournament_id', definition: "tournament_id TEXT NOT NULL DEFAULT 'default-worldcup-2026'" },
		{ name: 'venue', definition: 'venue TEXT' },
		{ name: 'penalty_winner', definition: 'penalty_winner TEXT' },
		{ name: 'is_closed', definition: 'is_closed INTEGER NOT NULL DEFAULT 0' }
	]);

	await ensureColumns('tournament_predictions', [
		{ name: 'tournament_id', definition: "tournament_id TEXT NOT NULL DEFAULT 'default-worldcup-2026'" },
		{ name: 'pred_penalty_winner', definition: 'pred_penalty_winner TEXT' }
	]);

	await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS tournaments_alias_idx ON tournaments(alias);');
	await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);');
	await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_idx ON users(nickname);');
}

async function ensureSchemaVersion(): Promise<void> {
	const result = await client.execute('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;');
	const latest = Number((result.rows?.[0] as Record<string, unknown> | undefined)?.version ?? 0);

	if (latest >= CURRENT_SCHEMA_VERSION) return;

	for (let version = latest + 1; version <= CURRENT_SCHEMA_VERSION; version += 1) {
		await client.execute({
			sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
			args: [version, `bootstrap-v${version}`, new Date().toISOString()]
		});
	}
}

export async function getAppliedSchemaVersion(): Promise<number | null> {
	try {
		const result = await client.execute('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;');
		const value = (result.rows?.[0] as Record<string, unknown> | undefined)?.version;
		const version = typeof value === 'number' ? value : Number(value ?? NaN);
		return Number.isFinite(version) ? version : null;
	} catch {
		return null;
	}
}

export function getCurrentSchemaVersion(): number {
	return CURRENT_SCHEMA_VERSION;
}

async function seedDefaults(): Promise<void> {
	const [{ value: tournamentsCount }] = await db.select({ value: count() }).from(tournaments);
	if (tournamentsCount === 0) {
		await db.insert(tournaments).values({
			id: TOURNAMENT_ID,
			alias: 'mundial-2026',
			name: 'Mundial 2026',
			headerImageUrl: '',
			state: 'open_predictions',
			startAt: WORLD_CUP_2026_MATCHES[0].kickoffAt,
			lockReason: null,
			scoringConfigJson: serializeScoringConfig(defaultScoringConfig()),
			createdAt: new Date().toISOString()
		});
	}

	await syncSeedMatches();

	const existingUsers = await db.select({ id: users.id }).from(users);
	for (const row of existingUsers) {
		const [membership] = await db
			.select()
			.from(userTournaments)
			.where(and(eq(userTournaments.userId, row.id), eq(userTournaments.tournamentId, TOURNAMENT_ID)))
			.limit(1);
		if (!membership) {
			await db.insert(userTournaments).values({
				userId: row.id,
				tournamentId: TOURNAMENT_ID,
				createdAt: new Date().toISOString()
			});
		}
	}
}

export async function ensureDatabaseReady(): Promise<void> {
	if (!initPromise) {
		initPromise = (async () => {
			await createTables();
			await normalizeSchema();
			await ensureSchemaVersion();
			await seedDefaults();
			initError = null;
		})();
	}

	try {
		await initPromise;
	} catch (err) {
		initPromise = null;
		initError = err instanceof Error ? err : new Error('No se pudo inicializar la base de datos.');
		throw initError;
	}
}

export function getDatabaseInitError(): Error | null {
	return initError;
}
