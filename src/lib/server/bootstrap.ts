import { client, db } from '$lib/server/db/client';
import { count, and, eq } from 'drizzle-orm';
import { tournaments, tournamentMatches, userTournaments, users } from '$lib/server/db/schema';
import { GROUPS, getGroupTeams, GROUP_PAIRINGS, ROUND32_MATCHES } from '$lib/teams';

const TOURNAMENT_ID = 'default-worldcup-2026';

interface MatchSeed {
	id: string;
	tournamentId: string;
	stage: 'groups' | 'round32' | 'round16' | 'quarterfinal' | 'semifinal' | 'final';
	groupCode: string | null;
	teamA: string;
	teamB: string;
	kickoffAt: string;
	scoreA: null;
	scoreB: null;
	penaltyWinner: null;
	isClosed: false;
}

function generateGroupMatches(): MatchSeed[] {
	const matches: MatchSeed[] = [];
	const baseDate = new Date('2026-06-11T16:00:00Z');
	const times = [16, 19, 22, 13];
	let dayOffset = 0;
	let slotInDay = 0;

	for (let gi = 0; gi < GROUPS.length; gi++) {
		const group = GROUPS[gi];
		const teams = getGroupTeams(group);
		if (teams.length !== 4) continue;

		for (let pi = 0; pi < GROUP_PAIRINGS.length; pi++) {
			const [a, b] = GROUP_PAIRINGS[pi];
			const matchNum = gi * 6 + pi + 1;

			const kickoff = new Date(baseDate);
			kickoff.setUTCDate(kickoff.getUTCDate() + dayOffset);
			kickoff.setUTCHours(times[slotInDay % times.length], 0, 0, 0);

			matches.push({
				id: `g-${String(matchNum).padStart(3, '0')}`,
				tournamentId: TOURNAMENT_ID,
				stage: 'groups',
				groupCode: group,
				teamA: teams[a].name,
				teamB: teams[b].name,
				kickoffAt: kickoff.toISOString(),
				scoreA: null,
				scoreB: null,
				penaltyWinner: null,
				isClosed: false
			});

			slotInDay++;
			if (slotInDay >= 4) {
				slotInDay = 0;
				dayOffset++;
			}
		}
	}
	return matches;
}

function generateKnockoutMatches(): MatchSeed[] {
	const matches: MatchSeed[] = [];
	const r32Base = new Date('2026-06-28T16:00:00Z');

	for (let i = 0; i < ROUND32_MATCHES.length; i++) {
		const day = Math.floor(i / 4);
		const slot = i % 4;
		const kickoff = new Date(r32Base);
		kickoff.setUTCDate(kickoff.getUTCDate() + day);
		kickoff.setUTCHours([14, 17, 20, 23][slot], 0, 0, 0);

		matches.push({
			id: `r32-${String(i + 1).padStart(2, '0')}`,
			tournamentId: TOURNAMENT_ID,
			stage: 'round32',
			groupCode: null,
			teamA: ROUND32_MATCHES[i].teamA,
			teamB: ROUND32_MATCHES[i].teamB,
			kickoffAt: kickoff.toISOString(),
			scoreA: null,
			scoreB: null,
			penaltyWinner: null,
			isClosed: false
		});
	}

	const r16Base = new Date('2026-07-03T17:00:00Z');
	for (let i = 0; i < 8; i++) {
		const day = Math.floor(i / 2);
		const slot = i % 2;
		const kickoff = new Date(r16Base);
		kickoff.setUTCDate(kickoff.getUTCDate() + day);
		kickoff.setUTCHours(slot === 0 ? 17 : 21, 0, 0, 0);

		matches.push({
			id: `r16-${String(i + 1).padStart(2, '0')}`,
			tournamentId: TOURNAMENT_ID,
			stage: 'round16',
			groupCode: null,
			teamA: `Ganador R32-${i * 2 + 1}`,
			teamB: `Ganador R32-${i * 2 + 2}`,
			kickoffAt: kickoff.toISOString(),
			scoreA: null,
			scoreB: null,
			penaltyWinner: null,
			isClosed: false
		});
	}

	const qfBase = new Date('2026-07-09T17:00:00Z');
	for (let i = 0; i < 4; i++) {
		const day = Math.floor(i / 2);
		const slot = i % 2;
		const kickoff = new Date(qfBase);
		kickoff.setUTCDate(kickoff.getUTCDate() + day);
		kickoff.setUTCHours(slot === 0 ? 17 : 21, 0, 0, 0);

		matches.push({
			id: `qf-${String(i + 1).padStart(2, '0')}`,
			tournamentId: TOURNAMENT_ID,
			stage: 'quarterfinal',
			groupCode: null,
			teamA: `Ganador 8vos-${i * 2 + 1}`,
			teamB: `Ganador 8vos-${i * 2 + 2}`,
			kickoffAt: kickoff.toISOString(),
			scoreA: null,
			scoreB: null,
			penaltyWinner: null,
			isClosed: false
		});
	}

	const sfBase = new Date('2026-07-13T20:00:00Z');
	for (let i = 0; i < 2; i++) {
		const kickoff = new Date(sfBase);
		kickoff.setUTCDate(kickoff.getUTCDate() + i);

		matches.push({
			id: `sf-${String(i + 1).padStart(2, '0')}`,
			tournamentId: TOURNAMENT_ID,
			stage: 'semifinal',
			groupCode: null,
			teamA: `Ganador QF-${i * 2 + 1}`,
			teamB: `Ganador QF-${i * 2 + 2}`,
			kickoffAt: kickoff.toISOString(),
			scoreA: null,
			scoreB: null,
			penaltyWinner: null,
			isClosed: false
		});
	}

	matches.push({
		id: 'final',
		tournamentId: TOURNAMENT_ID,
		stage: 'final',
		groupCode: null,
		teamA: 'Ganador SF-1',
		teamB: 'Ganador SF-2',
		kickoffAt: '2026-07-19T20:00:00.000Z',
		scoreA: null,
		scoreB: null,
		penaltyWinner: null,
		isClosed: false
	});

	return matches;
}

let initPromise: Promise<void> | null = null;

async function createTables(): Promise<void> {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			nickname TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
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
			points_outcome INTEGER NOT NULL,
			points_exact INTEGER NOT NULL,
			points_bracket INTEGER NOT NULL,
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
			startAt: '2026-06-11T16:00:00.000Z',
			lockReason: null,
			pointsOutcome: 1,
			pointsExact: 3,
			pointsBracket: 3,
			createdAt: new Date().toISOString()
		});
	}

	const [{ value: matchesCount }] = await db.select({ value: count() }).from(tournamentMatches);
	if (matchesCount === 0) {
		const allMatches = [...generateGroupMatches(), ...generateKnockoutMatches()];
		for (let i = 0; i < allMatches.length; i += 50) {
			await db.insert(tournamentMatches).values(allMatches.slice(i, i + 50));
		}
	}

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
			await seedDefaults();
		})();
	}
	await initPromise;
}
