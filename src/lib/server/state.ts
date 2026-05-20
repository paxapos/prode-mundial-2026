import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import type {
	GroupStandingRow,
	LeaderboardEntry,
	Match,
	MatchPointDetail,
	Prediction,
	ScoringConfig,
	SideWinner,
	Tournament,
	TournamentSettings,
	User,
	UserRole,
	BlogPost
} from '$lib/types';
import {
	compareThirdPlaceMetrics,
	FLOW,
	getMatchOutcome,
	hasUnresolvedGroupBoundaryTie,
	rankThirdPlacedGroups,
	R32_DEFS,
	resolveBestThirds,
	resolveWinner,
	sortGroupStandingRows,
	teamAt
} from '$lib/bracket-rules';
import { defaultScoringConfig, parseScoringConfig, serializeScoringConfig, getStageConfig } from '$lib/scoring-config';
import { db } from '$lib/server/db/client';
import {
	auditLogs,
	blogPosts,
	teamGroupAdjustments,
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

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateTournamentHeaderImage(name: string): string {
	const title = escapeXml(name);
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
		parentTournamentId: row.parentTournamentId ?? null,
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

type PredictionPointResult = MatchPointDetail & {
	exactHit: boolean;
	outcomeHit: boolean;
};

function calculatePredictionPoints(prediction: Prediction, match: Match, config: ScoringConfig): PredictionPointResult | null {
	if (match.scoreA === null || match.scoreB === null) return null;

	const stageConfig = getStageConfig(config, match.stage);
	const predictedOutcome = getMatchOutcome(prediction.predA, prediction.predB, match.stage, prediction.predPenaltyWinner);
	const actualOutcome = getMatchOutcome(match.scoreA, match.scoreB, match.stage, match.penaltyWinner);
	const exactScore = prediction.predA === match.scoreA && prediction.predB === match.scoreB;
	const exactPenaltyWinner = match.stage === 'groups' || match.scoreA !== match.scoreB || prediction.predPenaltyWinner === match.penaltyWinner;
	const exactHit = exactScore && exactPenaltyWinner;
	const outcomeHit = !exactHit && predictedOutcome === actualOutcome;
	const outcomePoints = exactHit || outcomeHit ? stageConfig.outcome : 0;
	const exactPoints = exactHit ? stageConfig.exact : 0;
	const bracketPoints = match.stage !== 'groups' && predictedOutcome === actualOutcome ? stageConfig.bracketTeam : 0;
	const reason = exactHit
		? 'Resultado exacto'
		: outcomeHit
			? 'Acierto de resultado'
			: 'No acertó';

	return {
		matchId: match.id,
		stage: match.stage,
		teamA: match.teamA,
		teamB: match.teamB,
		scoreA: match.scoreA,
		scoreB: match.scoreB,
		predA: prediction.predA,
		predB: prediction.predB,
		outcomePoints,
		exactPoints,
		bracketPoints,
		totalPoints: outcomePoints + exactPoints + bracketPoints,
		reason: bracketPoints > 0 ? `${reason} + equipo avanza (${bracketPoints}pts)` : reason,
		exactHit,
		outcomeHit
	};
}

function toMatchPointDetail(points: PredictionPointResult): MatchPointDetail {
	return {
		matchId: points.matchId,
		stage: points.stage,
		teamA: points.teamA,
		teamB: points.teamB,
		scoreA: points.scoreA,
		scoreB: points.scoreB,
		predA: points.predA,
		predB: points.predB,
		outcomePoints: points.outcomePoints,
		exactPoints: points.exactPoints,
		bracketPoints: points.bracketPoints,
		totalPoints: points.totalPoints,
		reason: points.reason
	};
}

async function createUserInternal(input: { email: string; password: string; nickname?: string; role: UserRole }): Promise<User> {
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
	if (!userId) return null;
	const [row] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
	return row ? toUser(row) : null;
}

export async function getUserByNickname(nickname: string): Promise<User | null> {
	const [row] = await db.select().from(users).where(eq(users.nickname, nickname)).limit(1);
	return row ? toUser(row) : null;
}

export async function getUserCount(): Promise<number> {
	const [{ value }] = await db.select({ value: count() }).from(users);
	return value;
}

export async function bootstrapFirstAdmin(input: { email: string; password: string; nickname?: string }): Promise<User> {
	if ((await getUserCount()) > 0) throw new Error('Ya existe al menos un usuario.');
	return createUserInternal({ ...input, role: 'admin' });
}

export async function authenticateUser(input: { email: string; password: string }): Promise<User> {
	const email = assertEmail(input.email);
	const password = assertPassword(input.password);
	const [row] = await db.select().from(users).where(eq(users.username, email)).limit(1);
	if (!row || !row.passwordHash || !verifyPassword(password, row.passwordHash)) throw new Error('Usuario o clave invalidos.');
	return toUser(row);
}

export async function findOrCreateGoogleUser(input: { googleId: string; email: string; name: string; avatarUrl?: string }): Promise<{ user: User; isNew: boolean }> {
	// Look up by googleId first
	const [byGoogleId] = await db.select().from(users).where(eq(users.googleId, input.googleId)).limit(1);
	if (byGoogleId) return { user: toUser(byGoogleId), isNew: false };

	// Look up by email (existing local user, link their Google account)
	const [byEmail] = await db.select().from(users).where(eq(users.username, input.email.toLowerCase())).limit(1);
	if (byEmail) {
		const [updated] = await db
			.update(users)
			.set({ googleId: input.googleId, avatarUrl: input.avatarUrl ?? null })
			.where(eq(users.id, byEmail.id))
			.returning();
		await createAuditLog({ userId: updated.id, action: 'google_account_linked', entityType: 'user', entityId: String(updated.id), payload: { googleId: input.googleId } });
		return { user: toUser(updated), isNew: false };
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
	return { user: toUser(created), isNew: true };
}

export async function createUserByAdmin(input: { email: string; password: string; nickname?: string; role: UserRole }): Promise<User> {
	return createUserInternal(input);
}

export async function registerUser(input: { email: string; password: string; nickname: string }): Promise<User> {
	return createUserInternal({ ...input, role: 'player' });
}

export async function updateUserByAdmin(input: { userId: string; nickname: string; role: UserRole; actorUserId: string }): Promise<User> {
	const id = Number(input.userId);
	const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
	if (!existing) throw new Error('Usuario no encontrado.');

	const nickname = assertNickname(input.nickname);

	// Check nickname uniqueness (excluding current user)
	const [dupe] = await db.select().from(users).where(eq(users.nickname, nickname)).limit(1);
	if (dupe && dupe.id !== id) throw new Error('Ese nickname ya está en uso.');

	const [updated] = await db.update(users).set({ nickname, role: input.role }).where(eq(users.id, id)).returning();
	await createAuditLog({
		userId: Number(input.actorUserId),
		action: 'user_updated_by_admin',
		entityType: 'user',
		entityId: String(id),
		payload: { nickname, role: input.role, previousNickname: existing.nickname, previousRole: existing.role }
	});
	return toUser(updated);
}

export async function updateOwnProfile(input: { userId: string; nickname: string }): Promise<User> {
	const id = Number(input.userId);
	const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
	if (!existing) throw new Error('Usuario no encontrado.');

	const nickname = assertNickname(input.nickname);

	const [dupe] = await db.select().from(users).where(eq(users.nickname, nickname)).limit(1);
	if (dupe && dupe.id !== id) throw new Error('Ese nickname ya está en uso.');

	const [updated] = await db.update(users).set({ nickname }).where(eq(users.id, id)).returning();
	return toUser(updated);
}

export async function listUsers(): Promise<User[]> {
	const rows = await db.select().from(users).orderBy(asc(users.username));
	return rows.map(toUser);
}

export async function listTournaments(): Promise<Tournament[]> {
	const rows = await db.select().from(tournaments).orderBy(asc(tournaments.createdAt));
	return rows.map(toTournament);
}

export async function getTournamentByAlias(alias: string): Promise<Tournament | null> {
	const [row] = await db.select().from(tournaments).where(eq(tournaments.alias, alias)).limit(1);
	return row ? toTournament(row) : null;
}

export async function getActiveTournament(): Promise<Tournament | null> {
	const rows = await db.select().from(tournaments).where(isNull(tournaments.parentTournamentId)).orderBy(asc(tournaments.createdAt));
	if (rows.length === 0) return null;
	// Return the first root tournament (the competition, e.g. Mundial 2026)
	return toTournament(rows[0]);
}

/** List only ligas (child tournaments that share a parent's matches) */
export async function listLigas(parentId?: string): Promise<Tournament[]> {
	const condition = parentId
		? eq(tournaments.parentTournamentId, parentId)
		: isNotNull(tournaments.parentTournamentId);
	const rows = await db.select().from(tournaments).where(condition).orderBy(asc(tournaments.createdAt));
	return rows.map(toTournament);
}

/** Create a liga (pool) as a child of the source tournament */
export async function createLiga(input: {
	name: string;
	alias?: string;
	parentTournamentId: string;
	actorUserId?: string;
}): Promise<Tournament> {
	const name = input.name.trim();
	if (name.length < 3) throw new Error('La liga debe tener al menos 3 caracteres.');
	const alias = slugifyAlias(input.alias?.trim() || name);
	if (!alias) throw new Error('Alias de liga invalido.');

	const [parent] = await db.select().from(tournaments).where(eq(tournaments.id, input.parentTournamentId)).limit(1);
	if (!parent) throw new Error('Competicion padre inexistente.');

	const [exists] = await db.select().from(tournaments).where(eq(tournaments.alias, alias)).limit(1);
	if (exists) throw new Error('El alias ya existe.');

	const [created] = await db
		.insert(tournaments)
		.values({
			id: randomUUID(),
			alias,
			name,
			headerImageUrl: generateTournamentHeaderImage(name),
			state: parent.state,
			startAt: parent.startAt,
			lockReason: null,
			scoringConfigJson: parent.scoringConfigJson,
			parentTournamentId: input.parentTournamentId,
			createdAt: new Date().toISOString()
		})
		.returning();

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'liga_created',
		entityType: 'tournament',
		entityId: created.id,
		payload: { alias, name, parentTournamentId: input.parentTournamentId }
	});

	return toTournament(created);
}

/** Get the source tournament ID (root) for a given tournament/liga */
function getSourceId(tournament: Tournament): string {
	return tournament.parentTournamentId ?? tournament.id;
}

async function getSourceTournamentId(tournamentId: string): Promise<string> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) throw new Error('Liga inexistente.');
	return getSourceId(tournament);
}

function groupStageIsComplete(matches: Match[]): boolean {
	const groupMatches = matches.filter((match) => match.stage === 'groups');
	return groupMatches.length > 0 && groupMatches.every((match) => match.scoreA !== null && match.scoreB !== null);
}

function hasUnresolvedQualificationTie(standings: Record<string, GroupStandingRow[]>, matches: Match[]): boolean {
	for (const [group, rows] of Object.entries(standings)) {
		if (rows.length < 4) return true;
		const matchesForGroup = matches.filter((match) => match.groupCode === group && match.stage === 'groups');
		if (hasUnresolvedGroupBoundaryTie(rows, matchesForGroup, 0)) return true;
		if (hasUnresolvedGroupBoundaryTie(rows, matchesForGroup, 1)) return true;
		if (hasUnresolvedGroupBoundaryTie(rows, matchesForGroup, 2)) return true;
	}

	const thirds = rankThirdPlacedGroups(standings);
	if (thirds.length < 12) return true;
	return compareThirdPlaceMetrics(thirds[7].row, thirds[8].row) === 0;
}

async function updateKnockoutSlot(sourceId: string, matchId: string, side: 'A' | 'B', team: string): Promise<void> {
	await db
		.update(tournamentMatches)
		.set(side === 'A' ? { teamA: team } : { teamB: team })
		.where(and(eq(tournamentMatches.id, matchId), eq(tournamentMatches.tournamentId, sourceId)));
}

async function syncRound32TeamsFromGroups(sourceId: string): Promise<boolean> {
	const matches = await listMatches(sourceId);
	if (!groupStageIsComplete(matches)) return false;

	const standings = await buildGroupStandings(sourceId);
	if (hasUnresolvedQualificationTie(standings, matches)) return false;

	let changed = false;
	for (const [matchId, def] of Object.entries(R32_DEFS)) {
		const teamA = teamAt(standings, def.aGroup, def.aPos);
		if (teamA) {
			await updateKnockoutSlot(sourceId, matchId, 'A', teamA);
			changed = true;
		}

		if (def.bGroup !== undefined && def.bPos !== undefined) {
			const teamB = teamAt(standings, def.bGroup, def.bPos);
			if (teamB) {
				await updateKnockoutSlot(sourceId, matchId, 'B', teamB);
				changed = true;
			}
		}
	}

	const thirdAssignment = resolveBestThirds(standings);
	for (const [matchId, group] of thirdAssignment) {
		const team = teamAt(standings, group, 2);
		if (!team) continue;
		await updateKnockoutSlot(sourceId, matchId, 'B', team);
		changed = true;
	}

	return changed;
}

async function syncKnockoutWinner(sourceId: string, match: Match): Promise<boolean> {
	const flow = FLOW[match.id];
	if (!flow) return false;

	const { winner, loser } = resolveWinner(match.teamA, match.teamB, match.scoreA, match.scoreB, match.penaltyWinner);
	if (!winner) return false;

	await updateKnockoutSlot(sourceId, flow.w[0], flow.w[1], winner);
	if (loser && flow.l) {
		await updateKnockoutSlot(sourceId, flow.l[0], flow.l[1], loser);
	}

	return true;
}

export async function createTournament(input: {
	name: string;
	alias?: string;
	headerImageUrl?: string;
	startAt: string;
	scoringConfig?: ScoringConfig;
	actorUserId?: string;
}): Promise<Tournament> {
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

	// If this is a liga (has parent), also ensure user is enrolled in the source tournament
	const tournament = await getTournamentById(input.tournamentId);
	if (tournament?.parentTournamentId) {
		const [sourceExists] = await db
			.select()
			.from(userTournaments)
			.where(and(eq(userTournaments.userId, Number(input.userId)), eq(userTournaments.tournamentId, tournament.parentTournamentId)))
			.limit(1);
		if (!sourceExists) {
			await db.insert(userTournaments).values({
				userId: Number(input.userId),
				tournamentId: tournament.parentTournamentId,
				createdAt: new Date().toISOString()
			});
		}
	}
}

export async function listUserTournamentIds(userId: string): Promise<string[]> {
	const rows = await db.select({ tournamentId: userTournaments.tournamentId }).from(userTournaments).where(eq(userTournaments.userId, Number(userId)));
	return rows.map((r) => r.tournamentId);
}

export async function listTournamentMembers(tournamentId: string): Promise<User[]> {
	const rows = await db
		.select({ user: users })
		.from(userTournaments)
		.innerJoin(users, eq(userTournaments.userId, users.id))
		.where(eq(userTournaments.tournamentId, tournamentId))
		.orderBy(asc(users.nickname));
	return rows.map((r) => toUser(r.user));
}

export async function removeUserFromTournament(input: { userId: string; tournamentId: string; actorUserId: string }): Promise<void> {
	await db
		.delete(userTournaments)
		.where(and(eq(userTournaments.userId, Number(input.userId)), eq(userTournaments.tournamentId, input.tournamentId)));
	await createAuditLog({
		userId: Number(input.actorUserId),
		action: 'user_removed_from_tournament',
		entityType: 'tournament',
		entityId: input.tournamentId,
		payload: { userId: input.userId }
	});
}

async function isTournamentLocked(tournament: Tournament): Promise<boolean> {
	if (tournament.state === 'locked' || tournament.state === 'finished') return true;
	const start = new Date(tournament.startAt).getTime();
	return Number.isFinite(start) && Date.now() >= start;
}

export async function listMatches(tournamentId: string): Promise<Match[]> {
	// If this is a liga (has parent), get matches from the parent (source)
	const tournament = await getTournamentById(tournamentId);
	const sourceId = tournament ? getSourceId(tournament) : tournamentId;
	const rows = await db
		.select()
		.from(tournamentMatches)
		.where(eq(tournamentMatches.tournamentId, sourceId))
		.orderBy(asc(tournamentMatches.kickoffAt));
	return rows.map(toMatch);
}

export async function listPredictionsForUser(userId: string, tournamentId: string): Promise<Prediction[]> {
	// Predictions are always stored against the source tournament
	const tournament = await getTournamentById(tournamentId);
	const sourceId = tournament ? getSourceId(tournament) : tournamentId;
	const rows = await db
		.select()
		.from(tournamentPredictions)
		.where(and(eq(tournamentPredictions.userId, Number(userId)), eq(tournamentPredictions.tournamentId, sourceId)));
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
	const tournament = await getTournamentById(input.tournamentId);
	if (!tournament) throw new Error('Liga inexistente.');
	const sourceId = getSourceId(tournament);
	const sourceTournament = tournament.parentTournamentId ? await getTournamentById(sourceId) : tournament;
	if (!sourceTournament) throw new Error('Competicion inexistente.');
	if (await isTournamentLocked(sourceTournament)) throw new Error('La competicion esta bloqueada.');

	// Check user is enrolled in source or any liga
	const memberships = await listUserTournamentIds(input.userId);
	const hasAccess = memberships.includes(sourceId) || memberships.includes(input.tournamentId);
	if (!hasAccess) throw new Error('No estas asignado a ninguna liga.');

	const [match] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, input.matchId)).limit(1);
	if (!match || match.tournamentId !== sourceId) throw new Error('Partido inexistente.');
	if (Date.now() >= new Date(match.kickoffAt).getTime()) throw new Error('Este partido ya comenzo y no admite cambios.');
	if (input.predA < 0 || input.predB < 0) throw new Error('Los goles no pueden ser negativos.');

	const [existing] = await db
		.select()
		.from(tournamentPredictions)
		.where(
			and(
				eq(tournamentPredictions.userId, Number(input.userId)),
				eq(tournamentPredictions.tournamentId, sourceId),
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
			tournamentId: sourceId,
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
	if (input.scoreA < 0 || input.scoreB < 0) throw new Error('El resultado real no puede tener goles negativos.');
	const sourceId = await getSourceTournamentId(input.tournamentId);

	const [existing] = await db.select().from(tournamentMatches).where(and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, sourceId))).limit(1);
	if (!existing) throw new Error('Partido inexistente.');
	if (existing.stage === 'groups' && input.penaltyWinner) {
		throw new Error('Los partidos de fase de grupos no admiten ganador por penales.');
	}
	if (existing.stage !== 'groups' && input.scoreA === input.scoreB && !input.penaltyWinner) {
		throw new Error('Los partidos de eliminación directa con empate requieren un ganador por penales.');
	}
	if (existing.stage !== 'groups' && input.scoreA !== input.scoreB && input.penaltyWinner) {
		throw new Error('Solo se puede cargar ganador por penales cuando el resultado esta empatado.');
	}

	const [updated] = await db
		.update(tournamentMatches)
		.set({ scoreA: input.scoreA, scoreB: input.scoreB, penaltyWinner: input.penaltyWinner, isClosed: true })
		.where(and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, sourceId)))
		.returning();

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'match_result_saved',
		entityType: 'match',
		entityId: input.matchId,
		payload: { scoreA: input.scoreA, scoreB: input.scoreB, penaltyWinner: input.penaltyWinner }
	});

	const match = toMatch(updated);
	const synced = match.stage === 'groups'
		? await syncRound32TeamsFromGroups(sourceId)
		: await syncKnockoutWinner(sourceId, match);
	if (synced) {
		await createAuditLog({
			userId: input.actorUserId ? Number(input.actorUserId) : null,
			action: 'bracket_synced',
			entityType: 'tournament',
			entityId: sourceId,
			payload: { sourceMatchId: input.matchId, stage: match.stage }
		});
	}

	return match;
}

export async function getTournamentById(tournamentId: string): Promise<Tournament | null> {
	const [row] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
	return row ? toTournament(row) : null;
}

export async function getScoringRules(tournamentId: string): Promise<ScoringConfig> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) throw new Error('Liga inexistente.');
	const source = tournament.parentTournamentId ? await getTournamentById(tournament.parentTournamentId) : tournament;
	if (!source) throw new Error('Competicion inexistente.');
	return source.scoringConfig;
}

export async function updateScoringRules(input: {
	tournamentId: string;
	scoringConfig: ScoringConfig;
	actorUserId?: string;
}): Promise<ScoringConfig> {
	const sourceId = await getSourceTournamentId(input.tournamentId);

	const [updated] = await db
		.update(tournaments)
		.set({ scoringConfigJson: serializeScoringConfig(input.scoringConfig) })
		.where(eq(tournaments.id, sourceId))
		.returning();
	if (!updated) throw new Error('Competicion inexistente.');

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'scoring_rules_updated',
		entityType: 'tournament',
		entityId: sourceId,
		payload: input.scoringConfig
	});

	return parseScoringConfig(updated.scoringConfigJson);
}

export async function getTournamentSettings(tournamentId: string): Promise<TournamentSettings> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) throw new Error('Liga inexistente.');
	// For ligas, settings come from the source (parent) tournament
	const source = tournament.parentTournamentId ? await getTournamentById(tournament.parentTournamentId) : tournament;
	if (!source) throw new Error('Competicion inexistente.');
	const lockedByDate = source.state === 'open_predictions' && Date.now() >= new Date(source.startAt).getTime();
	return {
		state: lockedByDate ? 'locked' : source.state,
		tournamentStartAt: source.startAt,
		lockReason: source.lockReason
	};
}

export async function lockTournament(tournamentId: string, reason: string, actorUserId?: string): Promise<TournamentSettings> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const [updated] = await db
		.update(tournaments)
		.set({ state: 'locked', lockReason: reason || 'Bloqueo manual por administracion.' })
		.where(eq(tournaments.id, sourceId))
		.returning();
	if (!updated) throw new Error('Competicion inexistente.');

	await createAuditLog({
		userId: actorUserId ? Number(actorUserId) : null,
		action: 'tournament_locked',
		entityType: 'tournament',
		entityId: sourceId,
		payload: { reason }
	});

	return { state: 'locked', tournamentStartAt: updated.startAt, lockReason: updated.lockReason };
}

export async function getLeaderboard(tournamentId: string): Promise<LeaderboardEntry[]> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) throw new Error('Liga inexistente.');
	const sourceId = getSourceId(tournament);

	const [memberships, predictionRows, matchRows, sourceTournament] = await Promise.all([
		// Users enrolled in THIS liga/tournament
		db.select().from(userTournaments).where(eq(userTournaments.tournamentId, tournamentId)),
		// Predictions from the SOURCE tournament
		db.select().from(tournamentPredictions).where(eq(tournamentPredictions.tournamentId, sourceId)),
		// Matches from the SOURCE tournament
		db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, sourceId)),
		tournament.parentTournamentId ? getTournamentById(sourceId) : Promise.resolve(tournament)
	]);
	if (!sourceTournament) throw new Error('Competicion inexistente.');

	const memberUserIds = memberships.map((m) => m.userId);
	const userRows = memberUserIds.length > 0
		? await db.select().from(users).where(inArray(users.id, memberUserIds))
		: [];
	const usersInTournament = userRows.map(toUser);
	const matchMap = new Map(matchRows.map((row) => [row.id, toMatch(row)]));
	const config = sourceTournament.scoringConfig;

	const board = usersInTournament.map((user) => {
		let totalPoints = 0;
		let exactHits = 0;
		let outcomeHits = 0;
		let bracketPoints = 0;
		for (const row of predictionRows.filter((item) => String(item.userId) === user.id)) {
			const prediction = toPrediction(row);
			const match = matchMap.get(prediction.matchId);
			if (!match) continue;
			const points = calculatePredictionPoints(prediction, match, config);
			if (!points) continue;

			totalPoints += points.totalPoints;
			bracketPoints += points.bracketPoints;
			if (points.exactHit) exactHits += 1;
			else if (points.outcomeHit) outcomeHits += 1;
		}
		return { userId: user.id, nickname: user.nickname, role: user.role, avatarUrl: user.avatarUrl, totalPoints, exactHits, outcomeHits, bracketPoints };
	});

	return board.sort((a, b) => {
		if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
		if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
		return b.outcomeHits - a.outcomeHits;
	});
}

/** Get per-match point breakdown for a specific user */
export async function getPlayerMatchDetails(userId: string, tournamentId: string): Promise<MatchPointDetail[]> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) return [];
	const sourceId = getSourceId(tournament);
	const sourceTournament = tournament.parentTournamentId ? await getTournamentById(sourceId) : tournament;
	if (!sourceTournament) return [];
	const [predRows, matchRows] = await Promise.all([
		db.select().from(tournamentPredictions).where(
			and(eq(tournamentPredictions.userId, Number(userId)), eq(tournamentPredictions.tournamentId, sourceId))
		),
		db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, sourceId))
	]);
	const config = sourceTournament.scoringConfig;
	const matchMap = new Map(matchRows.map((row) => [row.id, toMatch(row)]));
	const details: MatchPointDetail[] = [];

	for (const row of predRows) {
		const pred = toPrediction(row);
		const match = matchMap.get(pred.matchId);
		if (!match) continue;
		const points = calculatePredictionPoints(pred, match, config);
		if (points) details.push(toMatchPointDetail(points));
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
	const sourceId = await getSourceTournamentId(input.tournamentId);
	const [updated] = await db
		.update(tournamentMatches)
		.set({ teamA: input.teamA.trim(), teamB: input.teamB.trim() })
		.where(and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, sourceId)))
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
	const sourceId = await getSourceTournamentId(input.tournamentId);
	const id = randomUUID();
	const [created] = await db
		.insert(tournamentMatches)
		.values({
			id,
			tournamentId: sourceId,
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
	const sourceId = await getSourceTournamentId(tournamentId);
	const matches = await listMatches(sourceId);
	const groupMatches = matches.filter((m) => m.groupCode && m.stage === 'groups');
	const tables = new Map<string, Map<string, GroupStandingRow>>();

	// Load tiebreaker adjustments
	const adjustments = await db
		.select()
		.from(teamGroupAdjustments)
		.where(eq(teamGroupAdjustments.tournamentId, sourceId));
	const adjustmentMap = new Map<string, number>();
	for (const adj of adjustments) {
		adjustmentMap.set(`${adj.groupCode}::${adj.team}`, adj.tiebreakerPoints);
	}

	for (const match of groupMatches) {
		const group = match.groupCode ?? 'NA';
		if (!tables.has(group)) tables.set(group, new Map<string, GroupStandingRow>());
		const table = tables.get(group)!;
		for (const team of [match.teamA, match.teamB]) {
			if (!table.has(team)) {
				table.set(team, {
					team, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
					tiebreakerPoints: adjustmentMap.get(`${group}::${team}`) ?? 0
				});
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
		const matchesForGroup = groupMatches.filter((match) => match.groupCode === group);
		result[group] = sortGroupStandingRows([...rows.values()], matchesForGroup);
	}
	return result;
}

/* ─── Tiebreaker adjustments ─── */

export async function getGroupAdjustments(tournamentId: string) {
	const sourceId = await getSourceTournamentId(tournamentId);
	return db
		.select()
		.from(teamGroupAdjustments)
		.where(eq(teamGroupAdjustments.tournamentId, sourceId));
}

export async function setGroupAdjustment(input: {
	tournamentId: string;
	groupCode: string;
	team: string;
	tiebreakerPoints: number;
	reason?: string;
	actorUserId: string;
}) {
	const sourceId = await getSourceTournamentId(input.tournamentId);
	const now = new Date().toISOString();
	await db
		.insert(teamGroupAdjustments)
		.values({
			tournamentId: sourceId,
			groupCode: input.groupCode,
			team: input.team,
			tiebreakerPoints: input.tiebreakerPoints,
			reason: input.reason || null,
			createdAt: now
		})
		.onConflictDoUpdate({
			target: [teamGroupAdjustments.tournamentId, teamGroupAdjustments.groupCode, teamGroupAdjustments.team],
			set: {
				tiebreakerPoints: input.tiebreakerPoints,
				reason: input.reason || null
			}
		});

	await createAuditLog({
		userId: Number(input.actorUserId),
		action: 'tiebreaker_set',
		entityType: 'team_group_adjustment',
		entityId: `${sourceId}::${input.groupCode}::${input.team}`,
		payload: { tiebreakerPoints: input.tiebreakerPoints, reason: input.reason }
	});

	const synced = await syncRound32TeamsFromGroups(sourceId);
	if (synced) {
		await createAuditLog({
			userId: Number(input.actorUserId),
			action: 'bracket_synced',
			entityType: 'tournament',
			entityId: sourceId,
			payload: { source: 'tiebreaker', groupCode: input.groupCode, team: input.team }
		});
	}
}

export async function buildLandingData() {
	const tournament = await getActiveTournament();
	if (!tournament) {
		return {
			tournament: null,
			matches: [],
			groups: {},
			groupMatches: [],
			bracketMatches: []
		};
	}

	const [matches, groups] = await Promise.all([
		listMatches(tournament.id),
		buildGroupStandings(tournament.id)
	]);

	return {
		tournament,
		matches,
		groups,
		groupMatches: matches.filter((m) => m.stage === 'groups'),
		bracketMatches: matches.filter((m) => m.stage !== 'groups')
	};
}

/* ─────────────────────────────────────────────── */
/* Blog                                            */
/* ─────────────────────────────────────────────── */

function toBlogPost(row: typeof blogPosts.$inferSelect, authorNickname: string): BlogPost {
	return {
		id: String(row.id),
		slug: row.slug,
		title: row.title,
		excerpt: row.excerpt,
		body: row.body,
		imageUrl: row.imageUrl ?? null,
		authorId: String(row.authorId),
		authorNickname,
		published: row.published,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export async function listPublishedBlogPosts(limit = 10): Promise<BlogPost[]> {
	const rows = await db
		.select({
			post: blogPosts,
			nickname: users.nickname
		})
		.from(blogPosts)
		.innerJoin(users, eq(blogPosts.authorId, users.id))
		.where(eq(blogPosts.published, true))
		.orderBy(asc(blogPosts.createdAt))
		.limit(limit);
	return rows.reverse().map((r) => toBlogPost(r.post, r.nickname));
}

export async function listAllBlogPosts(): Promise<BlogPost[]> {
	const rows = await db
		.select({
			post: blogPosts,
			nickname: users.nickname
		})
		.from(blogPosts)
		.innerJoin(users, eq(blogPosts.authorId, users.id))
		.orderBy(asc(blogPosts.createdAt));
	return rows.reverse().map((r) => toBlogPost(r.post, r.nickname));
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
	const rows = await db
		.select({
			post: blogPosts,
			nickname: users.nickname
		})
		.from(blogPosts)
		.innerJoin(users, eq(blogPosts.authorId, users.id))
		.where(eq(blogPosts.slug, slug))
		.limit(1);
	if (!rows.length) return null;
	return toBlogPost(rows[0].post, rows[0].nickname);
}

export async function createBlogPost(input: {
	title: string;
	excerpt: string;
	body: string;
	imageUrl?: string;
	authorId: number;
}): Promise<BlogPost> {
	const title = input.title.trim();
	if (!title) throw new Error('El título es obligatorio.');
	const excerpt = input.excerpt.trim();
	if (!excerpt) throw new Error('La descripción corta es obligatoria.');
	const body = input.body.trim();
	if (!body) throw new Error('El contenido es obligatorio.');

	const slug = slugifyAlias(title) + '-' + Date.now().toString(36);
	const now = new Date().toISOString();

	const [created] = await db
		.insert(blogPosts)
		.values({
			slug,
			title,
			excerpt,
			body,
			imageUrl: input.imageUrl?.trim() || null,
			authorId: input.authorId,
			published: true,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	const author = await getUserById(String(input.authorId));
	return toBlogPost(created, author?.nickname ?? 'Admin');
}

export async function deleteBlogPost(postId: string): Promise<void> {
	await db.delete(blogPosts).where(eq(blogPosts.id, Number(postId)));
}
