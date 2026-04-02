import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import type {
	GroupStandingRow,
	LeaderboardEntry,
	Match,
	MatchPointDetail,
	Prediction,
	ScoringConfig,
	ScoringRules,
	SideWinner,
	Tournament,
	TournamentSettings,
	User,
	UserRole
} from '$lib/types';
import { defaultScoringConfig, parseScoringConfig, serializeScoringConfig, getStageConfig } from '$lib/scoring-config';
import { ensureDatabaseReady } from '$lib/server/bootstrap';
import { db } from '$lib/server/db/client';
import {
	auditLogs,
	tournaments,
	tournamentMatches,
	tournamentPredictions,
	userTournaments,
	users
} from '$lib/server/db/schema';
import { hashPassword, verifyPassword } from '$lib/server/security';

function assertNickname(nickname: string): string {
	const trimmed = nickname.trim();
	if (trimmed.length < 3 || trimmed.length > 20) throw new Error('El nickname debe tener entre 3 y 20 caracteres.');
	if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) throw new Error('El nickname solo permite letras, numeros y guion bajo.');
	return trimmed;
}

function assertEmail(email: string): string {
	const trimmed = email.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new Error('Mail invalido.');
	return trimmed;
}

function assertPassword(password: string): string {
	if (password.length < 6 || password.length > 72) throw new Error('La clave debe tener entre 6 y 72 caracteres.');
	return password;
}

function slugifyAlias(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}

function generateTournamentHeaderImage(name: string): string {
	const title = encodeURIComponent(name);
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='500' viewBox='0 0 1600 500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#0f766e'/><stop offset='100%' stop-color='#1d4ed8'/></linearGradient></defs><rect width='1600' height='500' fill='url(#g)'/><circle cx='1380' cy='140' r='220' fill='#f59e0b' fill-opacity='0.25'/><circle cx='260' cy='420' r='250' fill='#22c55e' fill-opacity='0.22'/><text x='70' y='292' fill='white' font-size='68' font-family='system-ui' font-weight='800'>${title}</text></svg>`;
	return `data:image/svg+xml;charset=utf-8,${svg}`;
}

function toUser(row: typeof users.$inferSelect): User {
	return {
		id: String(row.id),
		email: row.username,
		nickname: row.nickname,
		role: row.role as UserRole,
		avatarUrl: row.avatarUrl ?? null,
		createdAt: row.createdAt
	};
}

function toTournament(row: typeof tournaments.$inferSelect): Tournament {
	return {
		id: row.id,
		alias: row.alias,
		name: row.name,
		headerImageUrl: row.headerImageUrl,
		state: row.state,
		startAt: row.startAt,
		lockReason: row.lockReason,
		scoringConfig: parseScoringConfig(row.scoringConfigJson),
		createdAt: row.createdAt
	};
}

function toMatch(row: typeof tournamentMatches.$inferSelect): Match {
	return {
		id: row.id,
		tournamentId: row.tournamentId,
		stage: row.stage as Match['stage'],
		groupCode: row.groupCode,
		teamA: row.teamA,
		teamB: row.teamB,
		kickoffAt: row.kickoffAt,
		venue: row.venue ?? null,
		scoreA: row.scoreA,
		scoreB: row.scoreB,
		penaltyWinner: (row.penaltyWinner as SideWinner) ?? null,
		isClosed: row.isClosed
	};
}

function toPrediction(row: typeof tournamentPredictions.$inferSelect): Prediction {
	return {
		id: String(row.id),
		userId: String(row.userId),
		tournamentId: row.tournamentId,
		matchId: row.matchId,
		predA: row.predA,
		predB: row.predB,
		predPenaltyWinner: (row.predPenaltyWinner as SideWinner) ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

function getOutcome(a: number, b: number, stage: Match['stage'], penaltyWinner: SideWinner): 'A' | 'B' | 'draw' {
	if (a > b) return 'A';
	if (b > a) return 'B';
	if (stage !== 'groups' && penaltyWinner) return penaltyWinner;
	return 'draw';
}

async function createAuditLog(input: { userId?: number | null; action: string; entityType: string; entityId: string; payload: unknown }) {
	await db.insert(auditLogs).values({
		userId: input.userId ?? null,
		action: input.action,
		entityType: input.entityType,
		entityId: input.entityId,
		payloadJson: JSON.stringify(input.payload),
		createdAt: new Date().toISOString()
	});
}

async function createUserInternal(input: { email: string; password: string; nickname?: string; role: UserRole }): Promise<User> {
	await ensureDatabaseReady();
	const email = assertEmail(input.email);
	const password = assertPassword(input.password);
	const nickname = input.nickname ? assertNickname(input.nickname) : email.split('@')[0] ?? email;

	const [exists] = await db.select().from(users).where(eq(users.username, email)).limit(1);
	if (exists) throw new Error('Ese mail ya existe.');
	const [nicknameExists] = await db.select().from(users).where(eq(users.nickname, nickname)).limit(1);
	if (nicknameExists) throw new Error('Ese nickname ya existe.');

	const [created] = await db
		.insert(users)
		.values({ username: email, nickname, passwordHash: hashPassword(password), role: input.role, createdAt: new Date().toISOString() })
		.returning();

	const activeTournament = await getActiveTournament();
	if (activeTournament) {
		await db.insert(userTournaments).values({
			userId: created.id,
			tournamentId: activeTournament.id,
			createdAt: new Date().toISOString()
		});
	}

	await createAuditLog({ userId: created.id, action: 'user_created', entityType: 'user', entityId: String(created.id), payload: { email, nickname, role: input.role } });
	return toUser(created);
}

export async function getUserById(userId: string | null | undefined): Promise<User | null> {
	await ensureDatabaseReady();
	if (!userId) return null;
	const [row] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
	return row ? toUser(row) : null;
}

export async function getUserByNickname(nickname: string): Promise<User | null> {
	await ensureDatabaseReady();
	const [row] = await db.select().from(users).where(eq(users.nickname, nickname)).limit(1);
	return row ? toUser(row) : null;
}

export async function getUserCount(): Promise<number> {
	await ensureDatabaseReady();
	const rows = await db.select({ id: users.id }).from(users);
	return rows.length;
}

export async function bootstrapFirstAdmin(input: { email: string; password: string; nickname?: string }): Promise<User> {
	if ((await getUserCount()) > 0) throw new Error('Ya existe al menos un usuario.');
	return createUserInternal({ ...input, role: 'admin' });
}

export async function authenticateUser(input: { email: string; password: string }): Promise<User> {
	await ensureDatabaseReady();
	const email = assertEmail(input.email);
	const password = assertPassword(input.password);
	const [row] = await db.select().from(users).where(eq(users.username, email)).limit(1);
	if (!row || !row.passwordHash || !verifyPassword(password, row.passwordHash)) throw new Error('Usuario o clave invalidos.');
	return toUser(row);
}

export async function findOrCreateGoogleUser(input: { googleId: string; email: string; name: string; avatarUrl?: string }): Promise<User> {
	await ensureDatabaseReady();

	// Look up by googleId first
	const [byGoogleId] = await db.select().from(users).where(eq(users.googleId, input.googleId)).limit(1);
	if (byGoogleId) return toUser(byGoogleId);

	// Look up by email (existing local user, link their Google account)
	const [byEmail] = await db.select().from(users).where(eq(users.username, input.email.toLowerCase())).limit(1);
	if (byEmail) {
		const [updated] = await db
			.update(users)
			.set({ googleId: input.googleId, avatarUrl: input.avatarUrl ?? null })
			.where(eq(users.id, byEmail.id))
			.returning();
		await createAuditLog({ userId: updated.id, action: 'google_account_linked', entityType: 'user', entityId: String(updated.id), payload: { googleId: input.googleId } });
		return toUser(updated);
	}

	// New user via Google
	const totalUsers = await getUserCount();
	const role: UserRole = totalUsers === 0 ? 'admin' : 'player';
	const baseNickname = input.name
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9_]/g, '_')
		.replace(/_+/g, '_')
		.slice(0, 20) || 'player';

	// Ensure unique nickname
	let nickname = baseNickname;
	let suffix = 1;
	while (true) {
		const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.nickname, nickname)).limit(1);
		if (!exists) break;
		nickname = `${baseNickname.slice(0, 17)}_${suffix++}`;
	}

	const [created] = await db
		.insert(users)
		.values({
			username: input.email.toLowerCase(),
			nickname,
			passwordHash: null,
			googleId: input.googleId,
			avatarUrl: input.avatarUrl ?? null,
			role,
			createdAt: new Date().toISOString()
		})
		.returning();

	const activeTournament = await getActiveTournament();
	if (activeTournament) {
		await db.insert(userTournaments).values({ userId: created.id, tournamentId: activeTournament.id, createdAt: new Date().toISOString() });
	}

	await createAuditLog({ userId: created.id, action: 'user_created_google', entityType: 'user', entityId: String(created.id), payload: { email: input.email, role } });
	return toUser(created);
}

export async function createUserByAdmin(input: { email: string; password: string; nickname?: string; role: UserRole }): Promise<User> {
	return createUserInternal(input);
}

export async function listUsers(): Promise<User[]> {
	await ensureDatabaseReady();
	const rows = await db.select().from(users).orderBy(asc(users.username));
	return rows.map(toUser);
}

export async function listTournaments(): Promise<Tournament[]> {
	await ensureDatabaseReady();
	const rows = await db.select().from(tournaments).orderBy(asc(tournaments.createdAt));
	return rows.map(toTournament);
}

export async function getTournamentByAlias(alias: string): Promise<Tournament | null> {
	await ensureDatabaseReady();
	const [row] = await db.select().from(tournaments).where(eq(tournaments.alias, alias)).limit(1);
	return row ? toTournament(row) : null;
}

export async function getActiveTournament(): Promise<Tournament | null> {
	const all = await listTournaments();
	if (all.length === 0) return null;
	return all[all.length - 1] ?? null;
}

export async function createTournament(input: {
	name: string;
	alias?: string;
	headerImageUrl?: string;
	startAt: string;
	scoringConfig?: ScoringConfig;
	actorUserId?: string;
}): Promise<Tournament> {
	await ensureDatabaseReady();
	const name = input.name.trim();
	if (name.length < 3) throw new Error('El torneo debe tener al menos 3 caracteres.');
	const alias = slugifyAlias(input.alias?.trim() || name);
	if (!alias) throw new Error('Alias de torneo invalido.');
	const startAt = new Date(input.startAt).toISOString();
	if (!Number.isFinite(new Date(startAt).getTime())) throw new Error('Fecha de inicio invalida.');

	const [exists] = await db.select().from(tournaments).where(eq(tournaments.alias, alias)).limit(1);
	if (exists) throw new Error('El alias ya existe.');

	const scoringConfig = input.scoringConfig ?? defaultScoringConfig();

	const [created] = await db
		.insert(tournaments)
		.values({
			id: randomUUID(),
			alias,
			name,
			headerImageUrl: input.headerImageUrl?.trim() || generateTournamentHeaderImage(name),
			state: 'open_predictions',
			startAt,
			lockReason: null,
			scoringConfigJson: serializeScoringConfig(scoringConfig),
			createdAt: new Date().toISOString()
		})
		.returning();

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'tournament_created',
		entityType: 'tournament',
		entityId: created.id,
		payload: { alias: created.alias, name: created.name }
	});

	return toTournament(created);
}

export async function assignUserToTournament(input: { userId: string; tournamentId: string; actorUserId?: string }): Promise<void> {
	await ensureDatabaseReady();
	const [exists] = await db
		.select()
		.from(userTournaments)
		.where(and(eq(userTournaments.userId, Number(input.userId)), eq(userTournaments.tournamentId, input.tournamentId)))
		.limit(1);
	if (exists) return;
	await db.insert(userTournaments).values({
		userId: Number(input.userId),
		tournamentId: input.tournamentId,
		createdAt: new Date().toISOString()
	});
	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'user_assigned_tournament',
		entityType: 'tournament',
		entityId: input.tournamentId,
		payload: { userId: input.userId }
	});
}

export async function listUserTournamentIds(userId: string): Promise<string[]> {
	await ensureDatabaseReady();
	const rows = await db.select({ tournamentId: userTournaments.tournamentId }).from(userTournaments).where(eq(userTournaments.userId, Number(userId)));
	return rows.map((r) => r.tournamentId);
}

async function isTournamentLocked(tournament: Tournament): Promise<boolean> {
	if (tournament.state === 'locked' || tournament.state === 'finished') return true;
	const start = new Date(tournament.startAt).getTime();
	return Number.isFinite(start) && Date.now() >= start;
}

export async function listMatches(tournamentId: string): Promise<Match[]> {
	await ensureDatabaseReady();
	const rows = await db
		.select()
		.from(tournamentMatches)
		.where(eq(tournamentMatches.tournamentId, tournamentId))
		.orderBy(asc(tournamentMatches.kickoffAt));
	return rows.map(toMatch);
}

export async function listPredictionsForUser(userId: string, tournamentId: string): Promise<Prediction[]> {
	await ensureDatabaseReady();
	const rows = await db
		.select()
		.from(tournamentPredictions)
		.where(and(eq(tournamentPredictions.userId, Number(userId)), eq(tournamentPredictions.tournamentId, tournamentId)));
	return rows.map(toPrediction);
}

export async function savePrediction(input: {
	userId: string;
	tournamentId: string;
	matchId: string;
	predA: number;
	predB: number;
	predPenaltyWinner: SideWinner;
}): Promise<Prediction> {
	await ensureDatabaseReady();
	const tournament = await getTournamentById(input.tournamentId);
	if (!tournament) throw new Error('Torneo inexistente.');
	if (await isTournamentLocked(tournament)) throw new Error('El torneo esta bloqueado.');

	const memberships = await listUserTournamentIds(input.userId);
	if (!memberships.includes(input.tournamentId)) throw new Error('No estas asignado a este torneo.');

	const [match] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, input.matchId)).limit(1);
	if (!match || match.tournamentId !== input.tournamentId) throw new Error('Partido inexistente.');
	if (Date.now() >= new Date(match.kickoffAt).getTime()) throw new Error('Este partido ya comenzo y no admite cambios.');
	if (input.predA < 0 || input.predB < 0) throw new Error('Los goles no pueden ser negativos.');

	const [existing] = await db
		.select()
		.from(tournamentPredictions)
		.where(
			and(
				eq(tournamentPredictions.userId, Number(input.userId)),
				eq(tournamentPredictions.tournamentId, input.tournamentId),
				eq(tournamentPredictions.matchId, input.matchId)
			)
		)
		.limit(1);

	const now = new Date().toISOString();
	if (existing) {
		const [updated] = await db
			.update(tournamentPredictions)
			.set({ predA: input.predA, predB: input.predB, predPenaltyWinner: input.predPenaltyWinner, updatedAt: now })
			.where(eq(tournamentPredictions.id, existing.id))
			.returning();
		return toPrediction(updated);
	}

	const [created] = await db
		.insert(tournamentPredictions)
		.values({
			userId: Number(input.userId),
			tournamentId: input.tournamentId,
			matchId: input.matchId,
			predA: input.predA,
			predB: input.predB,
			predPenaltyWinner: input.predPenaltyWinner,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return toPrediction(created);
}

export async function setMatchResult(input: {
	tournamentId: string;
	matchId: string;
	scoreA: number;
	scoreB: number;
	penaltyWinner: SideWinner;
	actorUserId?: string;
}): Promise<Match> {
	await ensureDatabaseReady();
	if (input.scoreA < 0 || input.scoreB < 0) throw new Error('El resultado real no puede tener goles negativos.');

	const [updated] = await db
		.update(tournamentMatches)
		.set({ scoreA: input.scoreA, scoreB: input.scoreB, penaltyWinner: input.penaltyWinner, isClosed: true })
		.where(and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, input.tournamentId)))
		.returning();
	if (!updated) throw new Error('Partido inexistente.');

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'match_result_saved',
		entityType: 'match',
		entityId: input.matchId,
		payload: { scoreA: input.scoreA, scoreB: input.scoreB, penaltyWinner: input.penaltyWinner }
	});

	return toMatch(updated);
}

async function getTournamentById(tournamentId: string): Promise<Tournament | null> {
	await ensureDatabaseReady();
	const [row] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
	return row ? toTournament(row) : null;
}

export async function getScoringRules(tournamentId: string): Promise<ScoringRules> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) throw new Error('Torneo inexistente.');
	return tournament.scoringConfig;
}

export async function updateScoringRules(input: {
	tournamentId: string;
	scoringConfig: ScoringConfig;
	actorUserId?: string;
}): Promise<ScoringRules> {
	await ensureDatabaseReady();

	const [updated] = await db
		.update(tournaments)
		.set({ scoringConfigJson: serializeScoringConfig(input.scoringConfig) })
		.where(eq(tournaments.id, input.tournamentId))
		.returning();
	if (!updated) throw new Error('Torneo inexistente.');

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'scoring_rules_updated',
		entityType: 'tournament',
		entityId: input.tournamentId,
		payload: input.scoringConfig
	});

	return parseScoringConfig(updated.scoringConfigJson);
}

export async function getTournamentSettings(tournamentId: string): Promise<TournamentSettings> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) throw new Error('Torneo inexistente.');
	const lockedByDate = tournament.state === 'open_predictions' && Date.now() >= new Date(tournament.startAt).getTime();
	return {
		state: lockedByDate ? 'locked' : tournament.state,
		tournamentStartAt: tournament.startAt,
		lockReason: tournament.lockReason
	};
}

export async function lockTournament(tournamentId: string, reason: string, actorUserId?: string): Promise<TournamentSettings> {
	await ensureDatabaseReady();
	const [updated] = await db
		.update(tournaments)
		.set({ state: 'locked', lockReason: reason || 'Bloqueo manual por administracion.' })
		.where(eq(tournaments.id, tournamentId))
		.returning();
	if (!updated) throw new Error('Torneo inexistente.');

	await createAuditLog({
		userId: actorUserId ? Number(actorUserId) : null,
		action: 'tournament_locked',
		entityType: 'tournament',
		entityId: tournamentId,
		payload: { reason }
	});

	return { state: 'locked', tournamentStartAt: updated.startAt, lockReason: updated.lockReason };
}

export async function getLeaderboard(tournamentId: string): Promise<LeaderboardEntry[]> {
	await ensureDatabaseReady();
	const [memberships, allUsers, predictionRows, matchRows, tournament] = await Promise.all([
		db.select().from(userTournaments).where(eq(userTournaments.tournamentId, tournamentId)),
		listUsers(),
		db.select().from(tournamentPredictions).where(eq(tournamentPredictions.tournamentId, tournamentId)),
		db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId)),
		getTournamentById(tournamentId)
	]);
	if (!tournament) throw new Error('Torneo inexistente.');

	const userIds = new Set(memberships.map((m) => String(m.userId)));
	const usersInTournament = allUsers.filter((u) => userIds.has(u.id));
	const matchMap = new Map(matchRows.map((row) => [row.id, toMatch(row)]));
	const config = tournament.scoringConfig;

	const board = usersInTournament.map((user) => {
		let totalPoints = 0;
		let exactHits = 0;
		let outcomeHits = 0;
		let bracketPoints = 0;
		for (const row of predictionRows.filter((item) => String(item.userId) === user.id)) {
			const prediction = toPrediction(row);
			const match = matchMap.get(prediction.matchId);
			if (!match || match.scoreA === null || match.scoreB === null) continue;

			const stageConfig = getStageConfig(config, match.stage);
			const predictedOutcome = getOutcome(prediction.predA, prediction.predB, match.stage, prediction.predPenaltyWinner);
			const actualOutcome = getOutcome(match.scoreA, match.scoreB, match.stage, match.penaltyWinner);
			const exact = prediction.predA === match.scoreA && prediction.predB === match.scoreB;

			if (exact) {
				totalPoints += stageConfig.outcome + stageConfig.exact;
				exactHits += 1;
			} else if (predictedOutcome === actualOutcome) {
				totalPoints += stageConfig.outcome;
				outcomeHits += 1;
			}

			// Bracket bonus: points for correctly predicting the advancing team
			if (match.stage !== 'groups' && predictedOutcome === actualOutcome) {
				totalPoints += stageConfig.bracketTeam;
				bracketPoints += stageConfig.bracketTeam;
			}
		}
		return { userId: user.id, nickname: user.nickname, role: user.role, totalPoints, exactHits, outcomeHits, bracketPoints };
	});

	return board.sort((a, b) => {
		if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
		if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
		return b.outcomeHits - a.outcomeHits;
	});
}

/** Get per-match point breakdown for a specific user */
export async function getPlayerMatchDetails(userId: string, tournamentId: string): Promise<MatchPointDetail[]> {
	await ensureDatabaseReady();
	const [tournament, predRows, matchRows] = await Promise.all([
		getTournamentById(tournamentId),
		db.select().from(tournamentPredictions).where(
			and(eq(tournamentPredictions.userId, Number(userId)), eq(tournamentPredictions.tournamentId, tournamentId))
		),
		db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId))
	]);
	if (!tournament) return [];
	const config = tournament.scoringConfig;
	const matchMap = new Map(matchRows.map((row) => [row.id, toMatch(row)]));
	const details: MatchPointDetail[] = [];

	for (const row of predRows) {
		const pred = toPrediction(row);
		const match = matchMap.get(pred.matchId);
		if (!match || match.scoreA === null || match.scoreB === null) continue;

		const stageConfig = getStageConfig(config, match.stage);
		const predictedOutcome = getOutcome(pred.predA, pred.predB, match.stage, pred.predPenaltyWinner);
		const actualOutcome = getOutcome(match.scoreA, match.scoreB, match.stage, match.penaltyWinner);
		const exact = pred.predA === match.scoreA && pred.predB === match.scoreB;

		let outcomePoints = 0;
		let exactPoints = 0;
		let bracketPts = 0;
		let reason = '';

		if (exact) {
			outcomePoints = stageConfig.outcome;
			exactPoints = stageConfig.exact;
			reason = 'Resultado exacto';
		} else if (predictedOutcome === actualOutcome) {
			outcomePoints = stageConfig.outcome;
			reason = 'Acierto de resultado';
		} else {
			reason = 'No acerto';
		}

		if (match.stage !== 'groups' && predictedOutcome === actualOutcome) {
			bracketPts = stageConfig.bracketTeam;
			reason += ` + equipo avanza (${bracketPts}pts)`;
		}

		details.push({
			matchId: match.id,
			stage: match.stage,
			teamA: match.teamA,
			teamB: match.teamB,
			scoreA: match.scoreA,
			scoreB: match.scoreB,
			predA: pred.predA,
			predB: pred.predB,
			outcomePoints,
			exactPoints,
			bracketPoints: bracketPts,
			totalPoints: outcomePoints + exactPoints + bracketPts,
			reason
		});
	}

	return details.sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function updateMatchTeams(input: {
	tournamentId: string;
	matchId: string;
	teamA: string;
	teamB: string;
	actorUserId?: string;
}): Promise<Match> {
	await ensureDatabaseReady();
	const [updated] = await db
		.update(tournamentMatches)
		.set({ teamA: input.teamA.trim(), teamB: input.teamB.trim() })
		.where(and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, input.tournamentId)))
		.returning();
	if (!updated) throw new Error('Partido inexistente.');

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'match_teams_updated',
		entityType: 'match',
		entityId: input.matchId,
		payload: { teamA: input.teamA, teamB: input.teamB }
	});

	return toMatch(updated);
}

export async function addMatch(input: {
	tournamentId: string;
	stage: Match['stage'];
	groupCode: string | null;
	teamA: string;
	teamB: string;
	kickoffAt: string;
	venue?: string;
	actorUserId?: string;
}): Promise<Match> {
	await ensureDatabaseReady();
	const id = randomUUID();
	const [created] = await db
		.insert(tournamentMatches)
		.values({
			id,
			tournamentId: input.tournamentId,
			stage: input.stage,
			groupCode: input.groupCode || null,
			teamA: input.teamA.trim(),
			teamB: input.teamB.trim(),
			kickoffAt: new Date(input.kickoffAt).toISOString(),
			venue: input.venue || null,
			scoreA: null,
			scoreB: null,
			penaltyWinner: null,
			isClosed: false
		})
		.returning();

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'match_created',
		entityType: 'match',
		entityId: id,
		payload: { teamA: input.teamA, teamB: input.teamB, stage: input.stage }
	});

	return toMatch(created);
}

export async function buildGroupStandings(tournamentId: string): Promise<Record<string, GroupStandingRow[]>> {
	const matches = await listMatches(tournamentId);
	const groupMatches = matches.filter((m) => m.groupCode && m.stage === 'groups');
	const tables = new Map<string, Map<string, GroupStandingRow>>();

	for (const match of groupMatches) {
		const group = match.groupCode ?? 'NA';
		if (!tables.has(group)) tables.set(group, new Map<string, GroupStandingRow>());
		const table = tables.get(group)!;
		for (const team of [match.teamA, match.teamB]) {
			if (!table.has(team)) {
				table.set(team, { team, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 });
			}
		}

		if (match.scoreA === null || match.scoreB === null) continue;
		const a = table.get(match.teamA)!;
		const b = table.get(match.teamB)!;
		a.played += 1;
		b.played += 1;
		a.goalsFor += match.scoreA;
		a.goalsAgainst += match.scoreB;
		b.goalsFor += match.scoreB;
		b.goalsAgainst += match.scoreA;
		a.goalDiff = a.goalsFor - a.goalsAgainst;
		b.goalDiff = b.goalsFor - b.goalsAgainst;

		if (match.scoreA > match.scoreB) {
			a.wins += 1;
			b.losses += 1;
			a.points += 3;
		} else if (match.scoreB > match.scoreA) {
			b.wins += 1;
			a.losses += 1;
			b.points += 3;
		} else {
			a.draws += 1;
			b.draws += 1;
			a.points += 1;
			b.points += 1;
		}
	}

	const result: Record<string, GroupStandingRow[]> = {};
	for (const [group, rows] of tables.entries()) {
		result[group] = [...rows.values()].sort((x, y) => {
			if (y.points !== x.points) return y.points - x.points;
			if (y.goalDiff !== x.goalDiff) return y.goalDiff - x.goalDiff;
			return y.goalsFor - x.goalsFor;
		});
	}
	return result;
}

export async function buildLandingData() {
	const tournament = await getActiveTournament();
	if (!tournament) {
		return {
			tournament: null,
			leaderboard: [],
			matches: [],
			groups: {},
			groupMatches: [],
			bracketMatches: []
		};
	}

	const [leaderboard, matches, groups] = await Promise.all([
		getLeaderboard(tournament.id),
		listMatches(tournament.id),
		buildGroupStandings(tournament.id)
	]);

	return {
		tournament,
		leaderboard,
		matches,
		groups,
		groupMatches: matches.filter((m) => m.stage === 'groups'),
		bracketMatches: matches.filter((m) => m.stage !== 'groups')
	};
}
