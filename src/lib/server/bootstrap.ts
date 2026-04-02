import { client, db } from '$lib/server/db/client';
import { count, and, eq } from 'drizzle-orm';
import { tournaments, tournamentMatches, userTournaments, users } from '$lib/server/db/schema';

const TOURNAMENT_ID = 'default-worldcup-2026';

interface MatchSeed {
	id: string;
	tournamentId: string;
	stage: 'groups' | 'round32' | 'round16' | 'quarterfinal' | 'semifinal' | 'final';
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

/**
 * All times are stored as UTC ISO strings.
 * The official schedule uses US Eastern (UTC-4 in June/July).
 * Helper to convert ET → UTC.
 */
function et(dateStr: string, hourET: number, minuteET: number = 0): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	const utc = new Date(Date.UTC(y, m - 1, d, hourET + 4, minuteET));
	return utc.toISOString();
}

function getAllMatches(): MatchSeed[] {
	const T = TOURNAMENT_ID;
	const m = (
		id: string,
		stage: MatchSeed['stage'],
		groupCode: string | null,
		teamA: string,
		teamB: string,
		kickoffAt: string,
		venue: string
	): MatchSeed => ({
		id, tournamentId: T, stage, groupCode, teamA, teamB, kickoffAt, venue,
		scoreA: null, scoreB: null, penaltyWinner: null, isClosed: false
	});

	return [
		// ============================================================
		// FASE DE GRUPOS - 72 partidos
		// ============================================================

		// --- Jornada 1 (11-16 Jun) ---
		// 11 Jun
		m('g-001', 'groups', 'A', 'México', 'Sudáfrica', et('2026-06-11', 12), 'Estadio Azteca'),
		// 12 Jun
		m('g-002', 'groups', 'A', 'Corea del Sur', 'Rep. Checa', et('2026-06-12', 12), 'Estadio BBVA'),
		m('g-003', 'groups', 'B', 'Canadá', 'Bosnia y Herzegovina', et('2026-06-12', 15), 'BC Place'),
		m('g-004', 'groups', 'B', 'Catar', 'Suiza', et('2026-06-12', 18), 'BMO Field'),
		// 13 Jun
		m('g-005', 'groups', 'C', 'Brasil', 'Marruecos', et('2026-06-13', 12), 'Hard Rock Stadium'),
		m('g-006', 'groups', 'C', 'Haití', 'Escocia', et('2026-06-13', 15), 'NRG Stadium'),
		m('g-007', 'groups', 'D', 'Estados Unidos', 'Paraguay', et('2026-06-13', 18), 'SoFi Stadium'),
		m('g-008', 'groups', 'D', 'Australia', 'Turquía', et('2026-06-13', 21), 'AT&T Stadium'),
		// 14 Jun
		m('g-009', 'groups', 'E', 'Alemania', 'Curazao', et('2026-06-14', 12), 'Lincoln Financial Field'),
		m('g-010', 'groups', 'E', 'Costa de Marfil', 'Ecuador', et('2026-06-14', 15), 'Mercedes-Benz Stadium'),
		m('g-011', 'groups', 'F', 'Países Bajos', 'Japón', et('2026-06-14', 18), 'MetLife Stadium'),
		m('g-012', 'groups', 'F', 'Suecia', 'Túnez', et('2026-06-14', 21), 'Gillette Stadium'),
		// 15 Jun
		m('g-013', 'groups', 'G', 'Bélgica', 'Egipto', et('2026-06-15', 12), 'Lumen Field'),
		m('g-014', 'groups', 'G', 'Irán', 'Nueva Zelanda', et('2026-06-15', 15), 'Bay Area Stadium'),
		m('g-015', 'groups', 'H', 'España', 'Cabo Verde', et('2026-06-15', 18), 'Hard Rock Stadium'),
		m('g-016', 'groups', 'H', 'Arabia Saudita', 'Uruguay', et('2026-06-15', 21), 'NRG Stadium'),
		// 16 Jun
		m('g-017', 'groups', 'I', 'Francia', 'Senegal', et('2026-06-16', 12), 'MetLife Stadium'),
		m('g-018', 'groups', 'I', 'Irak', 'Noruega', et('2026-06-16', 15), 'Lincoln Financial Field'),
		m('g-019', 'groups', 'J', 'Argentina', 'Argelia', et('2026-06-16', 18), 'Hard Rock Stadium'),
		m('g-020', 'groups', 'J', 'Austria', 'Jordania', et('2026-06-16', 21), 'Mercedes-Benz Stadium'),
		// 17 Jun
		m('g-021', 'groups', 'K', 'Portugal', 'RD Congo', et('2026-06-17', 12), 'AT&T Stadium'),
		m('g-022', 'groups', 'K', 'Uzbekistán', 'Colombia', et('2026-06-17', 15), 'SoFi Stadium'),
		m('g-023', 'groups', 'L', 'Inglaterra', 'Croacia', et('2026-06-17', 18), 'Arrowhead Stadium'),
		m('g-024', 'groups', 'L', 'Ghana', 'Panamá', et('2026-06-17', 21), 'Gillette Stadium'),

		// --- Jornada 2 (18-23 Jun) ---
		// 18 Jun
		m('g-025', 'groups', 'A', 'México', 'Corea del Sur', et('2026-06-18', 15), 'Estadio Akron'),
		m('g-026', 'groups', 'A', 'Sudáfrica', 'Rep. Checa', et('2026-06-18', 18), 'Estadio Azteca'),
		// 19 Jun
		m('g-027', 'groups', 'B', 'Canadá', 'Catar', et('2026-06-19', 12), 'BC Place'),
		m('g-028', 'groups', 'B', 'Suiza', 'Bosnia y Herzegovina', et('2026-06-19', 15), 'BMO Field'),
		m('g-029', 'groups', 'C', 'Brasil', 'Haití', et('2026-06-19', 18), 'Hard Rock Stadium'),
		m('g-030', 'groups', 'C', 'Marruecos', 'Escocia', et('2026-06-19', 21), 'NRG Stadium'),
		// 20 Jun
		m('g-031', 'groups', 'D', 'Estados Unidos', 'Australia', et('2026-06-20', 15), 'SoFi Stadium'),
		m('g-032', 'groups', 'D', 'Turquía', 'Paraguay', et('2026-06-20', 18), 'AT&T Stadium'),
		m('g-033', 'groups', 'E', 'Alemania', 'Costa de Marfil', et('2026-06-20', 12), 'Lincoln Financial Field'),
		m('g-034', 'groups', 'E', 'Ecuador', 'Curazao', et('2026-06-20', 21), 'Mercedes-Benz Stadium'),
		// 21 Jun
		m('g-035', 'groups', 'F', 'Países Bajos', 'Suecia', et('2026-06-21', 12), 'MetLife Stadium'),
		m('g-036', 'groups', 'F', 'Túnez', 'Japón', et('2026-06-21', 15), 'Gillette Stadium'),
		m('g-037', 'groups', 'G', 'Bélgica', 'Irán', et('2026-06-21', 18), 'Lumen Field'),
		m('g-038', 'groups', 'G', 'Nueva Zelanda', 'Egipto', et('2026-06-21', 21), 'Bay Area Stadium'),
		// 22 Jun
		m('g-039', 'groups', 'H', 'España', 'Arabia Saudita', et('2026-06-22', 12), 'Hard Rock Stadium'),
		m('g-040', 'groups', 'H', 'Uruguay', 'Cabo Verde', et('2026-06-22', 15), 'NRG Stadium'),
		m('g-041', 'groups', 'I', 'Francia', 'Irak', et('2026-06-22', 18), 'MetLife Stadium'),
		m('g-042', 'groups', 'I', 'Noruega', 'Senegal', et('2026-06-22', 21), 'Lincoln Financial Field'),
		// 23 Jun
		m('g-043', 'groups', 'J', 'Argentina', 'Austria', et('2026-06-23', 18), 'Hard Rock Stadium'),
		m('g-044', 'groups', 'J', 'Jordania', 'Argelia', et('2026-06-23', 21), 'Mercedes-Benz Stadium'),
		m('g-045', 'groups', 'K', 'Portugal', 'Uzbekistán', et('2026-06-23', 12), 'AT&T Stadium'),
		m('g-046', 'groups', 'K', 'Colombia', 'RD Congo', et('2026-06-23', 15), 'SoFi Stadium'),
		// 24 Jun
		m('g-047', 'groups', 'L', 'Inglaterra', 'Ghana', et('2026-06-24', 15), 'Arrowhead Stadium'),
		m('g-048', 'groups', 'L', 'Panamá', 'Croacia', et('2026-06-24', 18), 'Gillette Stadium'),

		// --- Jornada 3 (25-28 Jun) ---
		// 25 Jun
		m('g-049', 'groups', 'A', 'Rep. Checa', 'México', et('2026-06-25', 18), 'Estadio Azteca'),
		m('g-050', 'groups', 'A', 'Sudáfrica', 'Corea del Sur', et('2026-06-25', 18), 'Estadio BBVA'),
		m('g-051', 'groups', 'B', 'Bosnia y Herzegovina', 'Catar', et('2026-06-25', 12), 'BMO Field'),
		m('g-052', 'groups', 'B', 'Suiza', 'Canadá', et('2026-06-25', 12), 'BC Place'),
		// 26 Jun
		m('g-053', 'groups', 'C', 'Escocia', 'Brasil', et('2026-06-26', 18), 'Hard Rock Stadium'),
		m('g-054', 'groups', 'C', 'Marruecos', 'Haití', et('2026-06-26', 18), 'NRG Stadium'),
		m('g-055', 'groups', 'D', 'Paraguay', 'Australia', et('2026-06-26', 12), 'SoFi Stadium'),
		m('g-056', 'groups', 'D', 'Turquía', 'Estados Unidos', et('2026-06-26', 12), 'AT&T Stadium'),
		// 26 Jun (cont)
		m('g-057', 'groups', 'E', 'Curazao', 'Costa de Marfil', et('2026-06-26', 21), 'Mercedes-Benz Stadium'),
		m('g-058', 'groups', 'E', 'Ecuador', 'Alemania', et('2026-06-26', 21), 'Lincoln Financial Field'),
		// 27 Jun
		m('g-059', 'groups', 'F', 'Túnez', 'Países Bajos', et('2026-06-27', 12), 'MetLife Stadium'),
		m('g-060', 'groups', 'F', 'Japón', 'Suecia', et('2026-06-27', 12), 'Gillette Stadium'),
		m('g-061', 'groups', 'G', 'Nueva Zelanda', 'Bélgica', et('2026-06-27', 18), 'Lumen Field'),
		m('g-062', 'groups', 'G', 'Egipto', 'Irán', et('2026-06-27', 18), 'Bay Area Stadium'),
		// 27 Jun (cont)
		m('g-063', 'groups', 'H', 'Uruguay', 'España', et('2026-06-27', 21), 'Hard Rock Stadium'),
		m('g-064', 'groups', 'H', 'Cabo Verde', 'Arabia Saudita', et('2026-06-27', 21), 'NRG Stadium'),
		// 28 Jun
		m('g-065', 'groups', 'I', 'Noruega', 'Francia', et('2026-06-28', 18), 'MetLife Stadium'),
		m('g-066', 'groups', 'I', 'Senegal', 'Irak', et('2026-06-28', 18), 'Lincoln Financial Field'),
		m('g-067', 'groups', 'J', 'Jordania', 'Argentina', et('2026-06-28', 12), 'Hard Rock Stadium'),
		m('g-068', 'groups', 'J', 'Argelia', 'Austria', et('2026-06-28', 12), 'Mercedes-Benz Stadium'),
		// 28 Jun (cont)
		m('g-069', 'groups', 'K', 'Colombia', 'Portugal', et('2026-06-28', 21), 'AT&T Stadium'),
		m('g-070', 'groups', 'K', 'RD Congo', 'Uzbekistán', et('2026-06-28', 21), 'SoFi Stadium'),
		// 29 Jun
		m('g-071', 'groups', 'L', 'Panamá', 'Inglaterra', et('2026-06-29', 18), 'Arrowhead Stadium'),
		m('g-072', 'groups', 'L', 'Croacia', 'Ghana', et('2026-06-29', 18), 'Gillette Stadium'),

		// ============================================================
		// RONDA DE 32 - 16 partidos (1-4 Jul)
		// ============================================================
		m('r32-01', 'round32', null, '1° Grupo A', '3° Grupo C/D/E', et('2026-07-01', 12), 'Estadio Azteca'),
		m('r32-02', 'round32', null, '1° Grupo B', '3° Grupo A/D/E', et('2026-07-01', 15), 'BC Place'),
		m('r32-03', 'round32', null, '1° Grupo C', '3° Grupo A/B/F', et('2026-07-01', 18), 'Hard Rock Stadium'),
		m('r32-04', 'round32', null, '1° Grupo D', '3° Grupo B/E/F', et('2026-07-01', 21), 'AT&T Stadium'),

		m('r32-05', 'round32', null, '1° Grupo E', '3° Grupo A/C/D', et('2026-07-02', 12), 'Mercedes-Benz Stadium'),
		m('r32-06', 'round32', null, '1° Grupo F', '3° Grupo B/C/D', et('2026-07-02', 15), 'MetLife Stadium'),
		m('r32-07', 'round32', null, '2° Grupo A', '2° Grupo B', et('2026-07-02', 18), 'Estadio BBVA'),
		m('r32-08', 'round32', null, '2° Grupo C', '2° Grupo D', et('2026-07-02', 21), 'SoFi Stadium'),

		m('r32-09', 'round32', null, '1° Grupo G', '3° Grupo I/J/K', et('2026-07-03', 12), 'Lumen Field'),
		m('r32-10', 'round32', null, '1° Grupo H', '3° Grupo G/J/K', et('2026-07-03', 15), 'NRG Stadium'),
		m('r32-11', 'round32', null, '1° Grupo I', '3° Grupo G/H/L', et('2026-07-03', 18), 'Lincoln Financial Field'),
		m('r32-12', 'round32', null, '1° Grupo J', '3° Grupo H/I/L', et('2026-07-03', 21), 'Hard Rock Stadium'),

		m('r32-13', 'round32', null, '1° Grupo K', '3° Grupo G/I/J', et('2026-07-04', 12), 'AT&T Stadium'),
		m('r32-14', 'round32', null, '1° Grupo L', '3° Grupo H/K/L', et('2026-07-04', 15), 'Arrowhead Stadium'),
		m('r32-15', 'round32', null, '2° Grupo E', '2° Grupo F', et('2026-07-04', 18), 'Bay Area Stadium'),
		m('r32-16', 'round32', null, '2° Grupo G', '2° Grupo H', et('2026-07-04', 21), 'Gillette Stadium'),

		// ============================================================
		// OCTAVOS DE FINAL - 8 partidos (5-8 Jul)
		// ============================================================
		m('r16-01', 'round16', null, 'G. R32-01', 'G. R32-02', et('2026-07-05', 15), 'MetLife Stadium'),
		m('r16-02', 'round16', null, 'G. R32-03', 'G. R32-04', et('2026-07-05', 18), 'SoFi Stadium'),
		m('r16-03', 'round16', null, 'G. R32-05', 'G. R32-06', et('2026-07-06', 15), 'Hard Rock Stadium'),
		m('r16-04', 'round16', null, 'G. R32-07', 'G. R32-08', et('2026-07-06', 18), 'AT&T Stadium'),
		m('r16-05', 'round16', null, 'G. R32-09', 'G. R32-10', et('2026-07-07', 15), 'Mercedes-Benz Stadium'),
		m('r16-06', 'round16', null, 'G. R32-11', 'G. R32-12', et('2026-07-07', 18), 'NRG Stadium'),
		m('r16-07', 'round16', null, 'G. R32-13', 'G. R32-14', et('2026-07-08', 15), 'Lincoln Financial Field'),
		m('r16-08', 'round16', null, 'G. R32-15', 'G. R32-16', et('2026-07-08', 18), 'Lumen Field'),

		// ============================================================
		// CUARTOS DE FINAL - 4 partidos (9-10 Jul)
		// ============================================================
		m('qf-01', 'quarterfinal', null, 'G. 8vos-1', 'G. 8vos-2', et('2026-07-09', 15), 'SoFi Stadium'),
		m('qf-02', 'quarterfinal', null, 'G. 8vos-3', 'G. 8vos-4', et('2026-07-09', 18), 'Hard Rock Stadium'),
		m('qf-03', 'quarterfinal', null, 'G. 8vos-5', 'G. 8vos-6', et('2026-07-10', 15), 'AT&T Stadium'),
		m('qf-04', 'quarterfinal', null, 'G. 8vos-7', 'G. 8vos-8', et('2026-07-10', 18), 'MetLife Stadium'),

		// ============================================================
		// SEMIFINALES - 2 partidos (13-14 Jul)
		// ============================================================
		m('sf-01', 'semifinal', null, 'G. QF-1', 'G. QF-2', et('2026-07-13', 20), 'MetLife Stadium'),
		m('sf-02', 'semifinal', null, 'G. QF-3', 'G. QF-4', et('2026-07-14', 20), 'AT&T Stadium'),

		// ============================================================
		// TERCER PUESTO (18 Jul) y FINAL (19 Jul)
		// ============================================================
		m('3rd', 'final', null, 'Perdedor SF-1', 'Perdedor SF-2', et('2026-07-18', 16), 'Hard Rock Stadium'),
		m('final', 'final', null, 'Ganador SF-1', 'Ganador SF-2', et('2026-07-19', 16), 'MetLife Stadium')
	];
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
		const allMatches = getAllMatches();
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
