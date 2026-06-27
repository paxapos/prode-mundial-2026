import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import type {
	GroupStagePointResult,
	GroupStandingRow,
	LeaderboardEntry,
	Match,
	MatchPointDetail,
	Prediction,
	PredictionChangeAudit,
	PredictionEditUnlock,
	PredictionLock,
	ScoringConfig,
	SideWinner,
	Tournament,
	TournamentSettings,
	User,
	UserPredictionChangeSummary,
	UserRole,
	BlogPost
} from '$lib/types';
import {
	compareThirdPlaceMetrics,
	FLOW,
	hasUnresolvedGroupBoundaryTie,
	rankThirdPlacedGroups,
	R32_DEFS,
	resolveBestThirds,
	resolveWinner,
	sortGroupStandingRows,
	teamAt
} from '$lib/bracket-rules';
import { buildBracket, type BracketSlot, type LivePred } from '$lib/bracket-engine';
import { defaultScoringConfig, parseScoringConfig, serializeScoringConfig } from '$lib/scoring-config';
import { calculatePredictionPoints, calculateGroupStagePoints, type PredictionPointResult } from '$lib/scoring-engine';
import { canonicalTeamName, getTeamId } from '$lib/teams';
import { WORLD_CUP_2026_MATCHES } from '$lib/worldcup-2026-fixture';
import { db } from '$lib/server/db/client';
import {
	auditLogs,
	blogPosts,
	predictionEditUnlocks,
	predictionLocks,
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
		teamA: canonicalTeamName(row.teamA),
		teamB: canonicalTeamName(row.teamB),
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

function toPredictionEditUnlock(row: typeof predictionEditUnlocks.$inferSelect): PredictionEditUnlock {
	return {
		id: String(row.id),
		userId: String(row.userId),
		tournamentId: row.tournamentId,
		enabled: row.enabled,
		reason: row.reason ?? null,
		createdBy: row.createdBy === null ? null : String(row.createdBy),
		createdAt: row.createdAt,
		updatedBy: row.updatedBy === null ? null : String(row.updatedBy),
		updatedAt: row.updatedAt
	};
}

function toPredictionLock(row: typeof predictionLocks.$inferSelect): PredictionLock {
	return {
		id: String(row.id),
		userId: String(row.userId),
		tournamentId: row.tournamentId,
		enabled: row.enabled,
		reason: row.reason ?? null,
		createdBy: row.createdBy === null ? null : String(row.createdBy),
		createdAt: row.createdAt,
		updatedBy: row.updatedBy === null ? null : String(row.updatedBy),
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

function r32SeedLabel(group: string, position: number): string {
	return `${position + 1}° Grupo ${group}`;
}

function matchesForPredictionBracket(matches: Match[]): Match[] {
	return matches.map((match) => {
		if (match.stage === 'groups') return { ...match };

		const r32Def = R32_DEFS[match.id];
		if (r32Def) {
			return {
				...match,
				teamA: r32SeedLabel(r32Def.aGroup, r32Def.aPos),
				teamB: r32Def.bGroup !== undefined && r32Def.bPos !== undefined
					? r32SeedLabel(r32Def.bGroup, r32Def.bPos)
					: r32Def.bLabel
			};
		}

		return { ...match, teamA: `Pendiente ${match.id} A`, teamB: `Pendiente ${match.id} B` };
	});
}

function toLivePreds(predictions: Prediction[]): Record<string, LivePred> {
	return Object.fromEntries(
		predictions.map((prediction) => [
			prediction.matchId,
			{
				predA: prediction.predA,
				predB: prediction.predB,
				predPenaltyWinner: prediction.predPenaltyWinner
			}
		])
	);
}

export function buildPredictedBracket(matches: Match[], predictions: Prediction[]): Record<string, BracketSlot> {
	return buildBracket(matchesForPredictionBracket(matches), toLivePreds(predictions));
}

const FIXTURE_MATCH_BY_ID = new Map(WORLD_CUP_2026_MATCHES.map((match) => [match.id, match]));

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

export async function updateUserByAdmin(input: { userId: string; nickname: string; role: UserRole; password?: string; actorUserId: string }): Promise<User> {
	const id = Number(input.userId);
	const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
	if (!existing) throw new Error('Usuario no encontrado.');

	const nickname = assertNickname(input.nickname);

	// Check nickname uniqueness (excluding current user)
	const [dupe] = await db.select().from(users).where(eq(users.nickname, nickname)).limit(1);
	if (dupe && dupe.id !== id) throw new Error('Ese nickname ya está en uso.');

	// Guarda: no degradar al último admin (dejaría a todos afuera del panel de admin).
	if (existing.role === 'admin' && input.role !== 'admin') {
		const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
		if (admins.length <= 1) {
			throw new Error('No se puede quitar el rol de admin: es el último administrador.');
		}
	}

	const toUpdate = input.password
		? { nickname, role: input.role, passwordHash: hashPassword(assertPassword(input.password)) }
		: { nickname, role: input.role };

	const [updated] = await db.update(users).set(toUpdate).where(eq(users.id, id)).returning();
	await createAuditLog({
		userId: Number(input.actorUserId),
		action: 'user_updated_by_admin',
		entityType: 'user',
		entityId: String(id),
		payload: { nickname, role: input.role, passwordChanged: !!input.password, previousNickname: existing.nickname, previousRole: existing.role }
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

function isGroupPositionResolved(
	standings: Record<string, GroupStandingRow[]>,
	matches: Match[],
	group: string,
	position: number
): boolean {
	const rows = standings[group];
	if (!rows?.[position] || rows.length < 4) return false;

	const matchesForGroup = matches.filter((match) => match.groupCode === group && match.stage === 'groups');
	if (position > 0 && hasUnresolvedGroupBoundaryTie(rows, matchesForGroup, position - 1)) return false;
	if (position < rows.length - 1 && hasUnresolvedGroupBoundaryTie(rows, matchesForGroup, position)) return false;

	return true;
}

function isBestThirdCutoffResolved(standings: Record<string, GroupStandingRow[]>): boolean {
	const thirds = rankThirdPlacedGroups(standings);
	if (thirds.length < 12) return false;
	return compareThirdPlaceMetrics(thirds[7].row, thirds[8].row) !== 0;
}

function groupFullyPlayed(matches: Match[], group: string): boolean {
	const groupMatches = matches.filter((match) => match.stage === 'groups' && match.groupCode === group);
	return groupMatches.length > 0 && groupMatches.every((match) => match.scoreA !== null && match.scoreB !== null);
}

// Equipo real de una posición de grupo, resuelto de forma PROGRESIVA: solo cuando ese grupo ya
// jugó sus 6 partidos y la posición no quedó empatada (mismos criterios FIFA + desempate manual).
// Así se pueden ir mostrando los cruces de los grupos ya terminados sin esperar a que cierre toda
// la fase de grupos. Devuelve null si la posición todavía no es definitiva.
function resolvedGroupPositionTeam(
	standings: Record<string, GroupStandingRow[]>,
	matches: Match[],
	group: string,
	position: number
): string | null {
	if (!groupFullyPlayed(matches, group)) return null;
	if (!isGroupPositionResolved(standings, matches, group, position)) return null;
	return teamAt(standings, group, position);
}

async function updateKnockoutSlot(
	sourceId: string,
	matchId: string,
	side: 'A' | 'B',
	team: string,
	matchById: Map<string, Match>,
	manualOverrideMatchIds = new Set<string>()
): Promise<boolean> {
	if (manualOverrideMatchIds.has(matchId)) return false;

	const current = matchById.get(matchId);
	if (current && (side === 'A' ? current.teamA : current.teamB) === team) return false;

	const [updated] = await db
		.update(tournamentMatches)
		.set(side === 'A' ? { teamA: team } : { teamB: team })
		.where(and(eq(tournamentMatches.id, matchId), eq(tournamentMatches.tournamentId, sourceId)))
		.returning();

	if (!updated) return false;
	if (current) {
		if (side === 'A') current.teamA = team;
		else current.teamB = team;
	}

	return true;
}

async function listManualBracketOverrideMatchIds(matchIds: string[]): Promise<Set<string>> {
	if (matchIds.length === 0) return new Set();

	const rows = await db
		.select({ entityId: auditLogs.entityId, action: auditLogs.action })
		.from(auditLogs)
		.where(and(inArray(auditLogs.action, ['match_teams_updated', 'match_teams_auto_reset']), inArray(auditLogs.entityId, matchIds)))
		.orderBy(asc(auditLogs.id));

	const latestActionByMatchId = new Map<string, string>();
	for (const row of rows) {
		latestActionByMatchId.set(row.entityId, row.action);
	}

	return new Set(
		[...latestActionByMatchId.entries()]
			.filter(([, action]) => action === 'match_teams_updated')
			.map(([entityId]) => entityId)
	);
}

function downstreamMatchIds(matchId: string): string[] {
	const found = new Set<string>();
	const queue = [matchId];

	while (queue.length > 0) {
		const currentId = queue.shift()!;
		const flow = FLOW[currentId];
		const nextIds = [flow?.w[0], flow?.l?.[0]].filter((id): id is string => !!id);
		for (const nextId of nextIds) {
			if (found.has(nextId)) continue;
			found.add(nextId);
			queue.push(nextId);
		}
	}

	return [...found];
}

async function resetDownstreamBracketMatches(sourceId: string, matchId: string, actorUserId?: string): Promise<string[]> {
	const resetIds: string[] = [];

	for (const downstreamId of downstreamMatchIds(matchId)) {
		const seededMatch = FIXTURE_MATCH_BY_ID.get(downstreamId);
		if (!seededMatch) continue;

		const [updated] = await db
			.update(tournamentMatches)
			.set({
				teamA: seededMatch.teamA,
				teamB: seededMatch.teamB,
				scoreA: null,
				scoreB: null,
				penaltyWinner: null,
				isClosed: false
			})
			.where(and(eq(tournamentMatches.id, downstreamId), eq(tournamentMatches.tournamentId, sourceId)))
			.returning();

		if (!updated) continue;
		resetIds.push(downstreamId);
		await createAuditLog({
			userId: actorUserId ? Number(actorUserId) : null,
			action: 'match_teams_auto_reset',
			entityType: 'match',
			entityId: downstreamId,
			payload: { tournamentId: sourceId, sourceMatchId: matchId }
		});
	}

	return resetIds;
}

async function resetAllKnockoutMatches(sourceId: string, sourceMatchId: string, actorUserId?: string): Promise<string[]> {
	const resetIds: string[] = [];

	for (const seededMatch of WORLD_CUP_2026_MATCHES.filter((match) => match.stage !== 'groups')) {
		const [updated] = await db
			.update(tournamentMatches)
			.set({
				teamA: seededMatch.teamA,
				teamB: seededMatch.teamB,
				scoreA: null,
				scoreB: null,
				penaltyWinner: null,
				isClosed: false
			})
			.where(and(eq(tournamentMatches.id, seededMatch.id), eq(tournamentMatches.tournamentId, sourceId)))
			.returning();

		if (!updated) continue;
		resetIds.push(seededMatch.id);
		await createAuditLog({
			userId: actorUserId ? Number(actorUserId) : null,
			action: 'match_teams_auto_reset',
			entityType: 'match',
			entityId: seededMatch.id,
			payload: { tournamentId: sourceId, sourceMatchId, reason: 'group_result_cleared' }
		});
	}

	return resetIds;
}

async function syncRound32TeamsFromGroups(sourceId: string, manualOverrideMatchIds = new Set<string>()): Promise<boolean> {
	const matches = await listMatches(sourceId);
	if (!groupStageIsComplete(matches)) return false;

	const standings = await buildGroupStandings(sourceId);
	const matchById = new Map(matches.map((match) => [match.id, match]));

	let changed = false;
	for (const [matchId, def] of Object.entries(R32_DEFS)) {
		const teamA = isGroupPositionResolved(standings, matches, def.aGroup, def.aPos)
			? teamAt(standings, def.aGroup, def.aPos)
			: null;
		if (teamA) {
			changed = await updateKnockoutSlot(sourceId, matchId, 'A', teamA, matchById, manualOverrideMatchIds) || changed;
		}

		if (def.bGroup !== undefined && def.bPos !== undefined) {
			const teamB = isGroupPositionResolved(standings, matches, def.bGroup, def.bPos)
				? teamAt(standings, def.bGroup, def.bPos)
				: null;
			if (teamB) {
				changed = await updateKnockoutSlot(sourceId, matchId, 'B', teamB, matchById, manualOverrideMatchIds) || changed;
			}
		}
	}

	const thirdAssignment = isBestThirdCutoffResolved(standings) ? resolveBestThirds(standings) : new Map<string, string>();
	for (const [matchId, group] of thirdAssignment) {
		if (!isGroupPositionResolved(standings, matches, group, 2)) continue;
		const team = teamAt(standings, group, 2);
		if (!team) continue;
		changed = await updateKnockoutSlot(sourceId, matchId, 'B', team, matchById, manualOverrideMatchIds) || changed;
	}

	return changed;
}

function resolveRound32TeamsForDisplay(
	matches: Match[],
	standings: Record<string, GroupStandingRow[]>,
	manualOverrideMatchIds = new Set<string>()
): Match[] {
	// Resolución progresiva: cada lado del cruce se completa apenas su grupo de origen termina
	// (no se espera a que cierre toda la fase de grupos). Los terceros, en cambio, dependen del
	// corte global 8°/9°, así que recién aparecen cuando ese corte queda definido.
	const resolvedMatches = matches.map((match) => ({ ...match }));
	const matchById = new Map(resolvedMatches.map((match) => [match.id, match]));

	for (const [matchId, def] of Object.entries(R32_DEFS)) {
		if (manualOverrideMatchIds.has(matchId)) continue;

		const slot = matchById.get(matchId);
		if (!slot) continue;

		const teamA = resolvedGroupPositionTeam(standings, matches, def.aGroup, def.aPos);
		if (teamA) slot.teamA = teamA;

		if (def.bGroup !== undefined && def.bPos !== undefined) {
			const teamB = resolvedGroupPositionTeam(standings, matches, def.bGroup, def.bPos);
			if (teamB) slot.teamB = teamB;
		}
	}

	const thirdAssignment = isBestThirdCutoffResolved(standings) ? resolveBestThirds(standings) : new Map<string, string>();
	for (const [matchId, group] of thirdAssignment) {
		if (manualOverrideMatchIds.has(matchId)) continue;

		const slot = matchById.get(matchId);
		const team = resolvedGroupPositionTeam(standings, matches, group, 2);
		if (slot && team) slot.teamB = team;
	}

	return resolvedMatches;
}

function tournamentTeamNamesFromMatches(matches: Match[]): string[] {
	const names = new Set<string>();
	for (const match of matches) {
		if (match.stage !== 'groups') continue;
		names.add(canonicalTeamName(match.teamA));
		names.add(canonicalTeamName(match.teamB));
	}
	return [...names].sort((a, b) => a.localeCompare(b, 'es'));
}

async function canonicalizeStoredMatchTeams(sourceId: string): Promise<boolean> {
	const rows = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, sourceId));
	let changed = false;

	for (const row of rows) {
		const teamA = canonicalTeamName(row.teamA);
		const teamB = canonicalTeamName(row.teamB);
		if (teamA === row.teamA && teamB === row.teamB) continue;

		await db
			.update(tournamentMatches)
			.set({ teamA, teamB })
			.where(and(eq(tournamentMatches.id, row.id), eq(tournamentMatches.tournamentId, sourceId)));
		changed = true;
	}

	return changed;
}

export async function syncTournamentBracket(tournamentId: string): Promise<boolean> {
	const sourceId = await getSourceTournamentId(tournamentId);
	return syncTournamentBracketForSource(sourceId);
}

async function syncKnockoutTeamsFromResults(sourceId: string, manualOverrideMatchIds = new Set<string>()): Promise<boolean> {
	const matches = await listMatches(sourceId);
	const matchById = new Map(matches.map((match) => [match.id, match]));
	let changed = false;

	for (const match of matches) {
		if (match.stage === 'groups') continue;
		if (match.scoreA === null || match.scoreB === null) continue;

		const flow = FLOW[match.id];
		if (!flow) continue;

		const { winner, loser } = resolveWinner(match.teamA, match.teamB, match.scoreA, match.scoreB, match.penaltyWinner);
		if (!winner) continue;

		changed = await updateKnockoutSlot(sourceId, flow.w[0], flow.w[1], winner, matchById, manualOverrideMatchIds) || changed;
		if (loser && flow.l) {
			changed = await updateKnockoutSlot(sourceId, flow.l[0], flow.l[1], loser, matchById, manualOverrideMatchIds) || changed;
		}
	}

	return changed;
}

async function syncTournamentBracketForSource(sourceId: string): Promise<boolean> {
	const canonicalChanged = await canonicalizeStoredMatchTeams(sourceId);
	const matches = await listMatches(sourceId);
	const knockoutMatchIds = matches.filter((match) => match.stage !== 'groups').map((match) => match.id);
	const manualOverrideMatchIds = await listManualBracketOverrideMatchIds(knockoutMatchIds);
	const round32Changed = await syncRound32TeamsFromGroups(sourceId, manualOverrideMatchIds);
	const knockoutChanged = await syncKnockoutTeamsFromResults(sourceId, manualOverrideMatchIds);
	return canonicalChanged || round32Changed || knockoutChanged;
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
	clearLeaderboardCache();
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
	clearLeaderboardCache();
}

// El torneo se considera "bloqueado" para edición global SOLO cuando el admin lo bloqueó
// explícitamente (state 'locked') o ya terminó ('finished'). El comienzo del torneo NO
// bloquea todo el prode: cada partido se cierra por su cuenta 10 minutos antes de su
// kickoff (ver savePrediction y canEditMatch). Así, con el prode desbloqueado el usuario
// puede seguir cargando pronósticos de partidos que todavía no empezaron (p. ej. 16avos),
// aunque la fase de grupos ya haya arrancado.
async function isTournamentLocked(tournament: Tournament): Promise<boolean> {
	return tournament.state === 'locked' || tournament.state === 'finished';
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

export async function listMatchesWithResolvedBracket(tournamentId: string): Promise<Match[]> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const matches = await listMatches(sourceId);
	const standings = await buildGroupStandings(sourceId);
	const knockoutMatchIds = matches.filter((match) => match.stage !== 'groups').map((match) => match.id);
	const manualOverrideMatchIds = await listManualBracketOverrideMatchIds(knockoutMatchIds);
	return resolveRound32TeamsForDisplay(matches, standings, manualOverrideMatchIds);
}

export async function listTournamentTeamNames(tournamentId: string): Promise<string[]> {
	return tournamentTeamNamesFromMatches(await listMatches(tournamentId));
}

/**
 * Resuelve, de forma progresiva, qué equipo real entra en cada casillero de 16avos
 * a medida que cada grupo cierra — sin esperar a que termine toda la fase de grupos.
 *
 * A diferencia de la sincronización del bracket (que recién corre con todos los grupos
 * completos), acá un casillero de 1°/2° se resuelve apenas su grupo jugó sus 6 partidos
 * y la posición no quedó empatada (mismo criterio FIFA + desempate manual del admin).
 * Los 8 mejores terceros sólo se resuelven cuando el corte 8°/9° está definido, porque
 * dependen de todos los grupos.
 *
 * Devuelve `{ matchId: { A?, B? } }` con los lados ya definidos. Se usa en "Mi Prode"
 * para mostrar aciertos/llaves muertas sin que cambie el cálculo oficial de puntos.
 */
export async function getProgressiveR32Classifiers(
	tournamentId: string
): Promise<Record<string, { A?: string; B?: string }>> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const matches = await listMatches(sourceId);
	const standings = await buildGroupStandings(sourceId);
	const result: Record<string, { A?: string; B?: string }> = {};

	const positionTeam = (group: string, position: number): string | null =>
		resolvedGroupPositionTeam(standings, matches, group, position);

	for (const [matchId, def] of Object.entries(R32_DEFS)) {
		const entry: { A?: string; B?: string } = {};
		const teamA = positionTeam(def.aGroup, def.aPos);
		if (teamA) entry.A = teamA;
		if (def.bGroup !== undefined && def.bPos !== undefined) {
			const teamB = positionTeam(def.bGroup, def.bPos);
			if (teamB) entry.B = teamB;
		}
		if (entry.A || entry.B) result[matchId] = entry;
	}

	// Los terceros dependen del corte global 8°/9°; sólo se resuelven cuando está definido.
	if (isBestThirdCutoffResolved(standings)) {
		for (const [matchId, group] of resolveBestThirds(standings)) {
			const team = positionTeam(group, 2);
			if (team) result[matchId] = { ...(result[matchId] ?? {}), B: team };
		}
	}

	return result;
}

/**
 * Equipos que YA quedaron eliminados de forma definitiva en la realidad. Un equipo
 * eliminado no puede ocupar ningún casillero del bracket de ahí en adelante, así que
 * "Mi Prode" lo muestra en gris en todas las fases siguientes (no sólo donde erró el cruce).
 *
 * Se considera eliminado:
 * - El 4° de un grupo ya jugado y con la posición resuelta (sin empate en el corte 3°/4°).
 * - Los 4 peores terceros, una vez definido el corte global 8°/9°.
 * - El perdedor de cualquier cruce de eliminación directa ya jugado.
 */
export async function getRealEliminatedTeams(tournamentId: string): Promise<string[]> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const matches = await listMatches(sourceId);
	const standings = await buildGroupStandings(sourceId);
	const eliminated = new Set<string>();

	const groupFullyPlayed = (group: string): boolean => {
		const groupMatches = matches.filter((m) => m.stage === 'groups' && m.groupCode === group);
		return groupMatches.length > 0 && groupMatches.every((m) => m.scoreA !== null && m.scoreB !== null);
	};

	// 4° de cada grupo terminado (con el corte 3°/4° resuelto).
	for (const [group, rows] of Object.entries(standings)) {
		if (!groupFullyPlayed(group) || !rows || rows.length < 4) continue;
		if (!isGroupPositionResolved(standings, matches, group, 3)) continue;
		const fourth = rows[3]?.team;
		if (fourth) eliminated.add(getTeamId(fourth));
	}

	// Los 4 peores terceros, cuando el corte 8°/9° quedó definido.
	if (isBestThirdCutoffResolved(standings)) {
		const thirds = rankThirdPlacedGroups(standings);
		for (let i = 8; i < thirds.length; i += 1) {
			const team = thirds[i]?.row?.team;
			if (team) eliminated.add(getTeamId(team));
		}
	}

	// Perdedores de cruces de eliminación directa ya jugados.
	for (const m of matches) {
		if (m.stage === 'groups' || m.scoreA === null || m.scoreB === null) continue;
		const { loser } = resolveWinner(m.teamA, m.teamB, m.scoreA, m.scoreB, m.penaltyWinner);
		if (loser) eliminated.add(getTeamId(loser));
	}

	return [...eliminated];
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

async function getActivePredictionUnlock(userId: string, tournamentId: string): Promise<PredictionEditUnlock | null> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const [row] = await db
		.select()
		.from(predictionEditUnlocks)
		.where(
			and(
				eq(predictionEditUnlocks.userId, Number(userId)),
				eq(predictionEditUnlocks.tournamentId, sourceId),
				eq(predictionEditUnlocks.enabled, true)
			)
		)
		.limit(1);
	return row ? toPredictionEditUnlock(row) : null;
}

export async function canUserEditPredictions(userId: string, tournamentId: string): Promise<boolean> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) return false;
	const sourceId = getSourceId(tournament);
	const sourceTournament = tournament.parentTournamentId ? await getTournamentById(sourceId) : tournament;
	if (!sourceTournament) return false;
	if (await isUserPredictionLocked(userId, sourceId)) return false;
	if (!(await isTournamentLocked(sourceTournament))) return true;
	return (await getActivePredictionUnlock(userId, sourceId)) !== null;
}

export async function savePrediction(input: {
	userId: string;
	tournamentId: string;
	matchId: string;
	predA: number;
	predB: number;
	predPenaltyWinner: SideWinner;
	actorUserId?: string;
}): Promise<Prediction> {
	const tournament = await getTournamentById(input.tournamentId);
	if (!tournament) throw new Error('Liga inexistente.');
	const sourceId = getSourceId(tournament);
	const sourceTournament = tournament.parentTournamentId ? await getTournamentById(sourceId) : tournament;
	if (!sourceTournament) throw new Error('Competicion inexistente.');
	if (await isUserPredictionLocked(input.userId, sourceId)) {
		throw new Error('La competicion esta bloqueada para este usuario.');
	}
	const usedIndividualUnlock = await isTournamentLocked(sourceTournament);
	if (usedIndividualUnlock && !(await getActivePredictionUnlock(input.userId, sourceId))) {
		throw new Error('La competicion esta bloqueada para este usuario.');
	}

	// Check user is enrolled in source or any liga
	const memberships = await listUserTournamentIds(input.userId);
	const hasAccess = memberships.includes(sourceId) || memberships.includes(input.tournamentId);
	if (!hasAccess) throw new Error('No estas asignado a ninguna liga.');

	const [match] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, input.matchId)).limit(1);
	if (!match || match.tournamentId !== sourceId) throw new Error('Partido inexistente.');
	const kickoffTime = new Date(match.kickoffAt).getTime();
	const tenMinutesBefore = kickoffTime - 10 * 60 * 1000;
	if (match.isClosed || Date.now() >= tenMinutesBefore) {
		throw new Error('No es posible guardar el pronóstico. El partido está por comenzar (límite de 10 minutos) o ya comenzó.');
	}
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
		const previous = { predA: existing.predA, predB: existing.predB, predPenaltyWinner: (existing.predPenaltyWinner as SideWinner) ?? null };
		const [updated] = await db
			.update(tournamentPredictions)
			.set({ predA: input.predA, predB: input.predB, predPenaltyWinner: input.predPenaltyWinner, updatedAt: now })
			.where(eq(tournamentPredictions.id, existing.id))
			.returning();
		await createAuditLog({
			userId: input.actorUserId ? Number(input.actorUserId) : Number(input.userId),
			action: 'prediction_updated',
			entityType: 'prediction',
			entityId: String(updated.id),
			payload: {
				userId: input.userId,
				tournamentId: sourceId,
				matchId: input.matchId,
				previous,
				next: { predA: updated.predA, predB: updated.predB, predPenaltyWinner: (updated.predPenaltyWinner as SideWinner) ?? null },
				usedIndividualUnlock
			}
		});
		clearLeaderboardCache();
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
	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : Number(input.userId),
		action: 'prediction_created',
		entityType: 'prediction',
		entityId: String(created.id),
		payload: {
			userId: input.userId,
			tournamentId: sourceId,
			matchId: input.matchId,
			previous: null,
			next: { predA: created.predA, predB: created.predB, predPenaltyWinner: (created.predPenaltyWinner as SideWinner) ?? null },
			usedIndividualUnlock
		}
	});
	clearLeaderboardCache();
	return toPrediction(created);
}

export async function unlockTournament(tournamentId: string, actorUserId?: string): Promise<TournamentSettings> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const [updated] = await db
		.update(tournaments)
		.set({ state: 'open_predictions', lockReason: null })
		.where(eq(tournaments.id, sourceId))
		.returning();
	if (!updated) throw new Error('Competicion inexistente.');

	await createAuditLog({
		userId: actorUserId ? Number(actorUserId) : null,
		action: 'tournament_unlocked',
		entityType: 'tournament',
		entityId: sourceId,
		payload: {}
	});

	return getTournamentSettings(sourceId);
}

export async function setUserPredictionUnlock(input: {
	userId: string;
	tournamentId: string;
	reason?: string;
	actorUserId: string;
}): Promise<PredictionEditUnlock> {
	const sourceId = await getSourceTournamentId(input.tournamentId);
	const now = new Date().toISOString();
	const [row] = await db
		.insert(predictionEditUnlocks)
		.values({
			userId: Number(input.userId),
			tournamentId: sourceId,
			enabled: true,
			reason: input.reason?.trim() || null,
			createdBy: Number(input.actorUserId),
			createdAt: now,
			updatedBy: Number(input.actorUserId),
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [predictionEditUnlocks.userId, predictionEditUnlocks.tournamentId],
			set: {
				enabled: true,
				reason: input.reason?.trim() || null,
				updatedBy: Number(input.actorUserId),
				updatedAt: now
			}
		})
		.returning();

	// Exclusión mutua: habilitar el "unlock" deshabilita cualquier "lock" activo del mismo usuario.
	await db
		.update(predictionLocks)
		.set({ enabled: false, updatedBy: Number(input.actorUserId), updatedAt: now })
		.where(and(eq(predictionLocks.userId, Number(input.userId)), eq(predictionLocks.tournamentId, sourceId)));

	await createAuditLog({
		userId: Number(input.actorUserId),
		action: 'prediction_unlock_enabled',
		entityType: 'prediction_edit_unlock',
		entityId: `${sourceId}::${input.userId}`,
		payload: { userId: input.userId, tournamentId: sourceId, reason: input.reason?.trim() || null }
	});

	return toPredictionEditUnlock(row);
}

export async function disableUserPredictionUnlock(input: {
	userId: string;
	tournamentId: string;
	actorUserId: string;
}): Promise<void> {
	const sourceId = await getSourceTournamentId(input.tournamentId);
	const now = new Date().toISOString();
	await db
		.update(predictionEditUnlocks)
		.set({ enabled: false, updatedBy: Number(input.actorUserId), updatedAt: now })
		.where(and(eq(predictionEditUnlocks.userId, Number(input.userId)), eq(predictionEditUnlocks.tournamentId, sourceId)));

	await createAuditLog({
		userId: Number(input.actorUserId),
		action: 'prediction_unlock_disabled',
		entityType: 'prediction_edit_unlock',
		entityId: `${sourceId}::${input.userId}`,
		payload: { userId: input.userId, tournamentId: sourceId }
	});
}

export async function listPredictionUnlocksForTournament(tournamentId: string): Promise<PredictionEditUnlock[]> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const rows = await db.select().from(predictionEditUnlocks).where(eq(predictionEditUnlocks.tournamentId, sourceId));
	return rows.map(toPredictionEditUnlock);
}

export async function isUserPredictionLocked(userId: string, tournamentId: string): Promise<boolean> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const [row] = await db
		.select()
		.from(predictionLocks)
		.where(
			and(
				eq(predictionLocks.userId, Number(userId)),
				eq(predictionLocks.tournamentId, sourceId),
				eq(predictionLocks.enabled, true)
			)
		)
		.limit(1);
	return row !== undefined;
}

export async function setUserPredictionLock(input: {
	userId: string;
	tournamentId: string;
	reason?: string;
	actorUserId: string;
}): Promise<PredictionLock> {
	const sourceId = await getSourceTournamentId(input.tournamentId);
	const now = new Date().toISOString();
	const [row] = await db
		.insert(predictionLocks)
		.values({
			userId: Number(input.userId),
			tournamentId: sourceId,
			enabled: true,
			reason: input.reason?.trim() || null,
			createdBy: Number(input.actorUserId),
			createdAt: now,
			updatedBy: Number(input.actorUserId),
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [predictionLocks.userId, predictionLocks.tournamentId],
			set: {
				enabled: true,
				reason: input.reason?.trim() || null,
				updatedBy: Number(input.actorUserId),
				updatedAt: now
			}
		})
		.returning();

	// Exclusión mutua: habilitar el "lock" deshabilita cualquier "unlock" activo del mismo usuario.
	await db
		.update(predictionEditUnlocks)
		.set({ enabled: false, updatedBy: Number(input.actorUserId), updatedAt: now })
		.where(and(eq(predictionEditUnlocks.userId, Number(input.userId)), eq(predictionEditUnlocks.tournamentId, sourceId)));

	await createAuditLog({
		userId: Number(input.actorUserId),
		action: 'prediction_lock_enabled',
		entityType: 'prediction_lock',
		entityId: `${sourceId}::${input.userId}`,
		payload: { userId: input.userId, tournamentId: sourceId, reason: input.reason?.trim() || null }
	});

	return toPredictionLock(row);
}

export async function disableUserPredictionLock(input: {
	userId: string;
	tournamentId: string;
	actorUserId: string;
}): Promise<void> {
	const sourceId = await getSourceTournamentId(input.tournamentId);
	const now = new Date().toISOString();
	await db
		.update(predictionLocks)
		.set({ enabled: false, updatedBy: Number(input.actorUserId), updatedAt: now })
		.where(and(eq(predictionLocks.userId, Number(input.userId)), eq(predictionLocks.tournamentId, sourceId)));

	await createAuditLog({
		userId: Number(input.actorUserId),
		action: 'prediction_lock_disabled',
		entityType: 'prediction_lock',
		entityId: `${sourceId}::${input.userId}`,
		payload: { userId: input.userId, tournamentId: sourceId }
	});
}

export async function listPredictionLocksForTournament(tournamentId: string): Promise<PredictionLock[]> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const rows = await db.select().from(predictionLocks).where(eq(predictionLocks.tournamentId, sourceId));
	return rows.map(toPredictionLock);
}


function parsePredictionAuditPayload(payloadJson: string): {
	userId: string;
	tournamentId: string;
	matchId: string;
	previous: PredictionChangeAudit['previous'];
	next: PredictionChangeAudit['next'];
	usedIndividualUnlock: boolean;
} | null {
	try {
		const payload = JSON.parse(payloadJson) as {
			userId?: string | number;
			tournamentId?: string;
			matchId?: string;
			previous?: PredictionChangeAudit['previous'];
			next?: PredictionChangeAudit['next'];
			usedIndividualUnlock?: boolean;
		};
		if (!payload.userId || !payload.tournamentId || !payload.matchId || !payload.next) return null;
		return {
			userId: String(payload.userId),
			tournamentId: payload.tournamentId,
			matchId: payload.matchId,
			previous: payload.previous ?? null,
			next: payload.next,
			usedIndividualUnlock: payload.usedIndividualUnlock ?? false
		};
	} catch {
		return null;
	}
}

export async function listPredictionChangeAuditForUser(userId: string, tournamentId: string): Promise<PredictionChangeAudit[]> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const [rows, matches] = await Promise.all([
		db
			.select()
			.from(auditLogs)
			.where(inArray(auditLogs.action, ['prediction_created', 'prediction_updated']))
			.orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)),
		listMatches(sourceId)
	]);
	const matchLabels = new Map(matches.map((match) => [match.id, `${match.teamA} vs ${match.teamB}`]));

	return rows.flatMap((row) => {
		const payload = parsePredictionAuditPayload(row.payloadJson);
		if (!payload || payload.userId !== userId || payload.tournamentId !== sourceId) return [];
		return [{
			id: String(row.id),
			userId: payload.userId,
			tournamentId: payload.tournamentId,
			matchId: payload.matchId,
			matchLabel: matchLabels.get(payload.matchId) ?? payload.matchId,
			action: row.action as PredictionChangeAudit['action'],
			previous: payload.previous,
			next: payload.next,
			changedByUserId: row.userId === null ? null : String(row.userId),
			usedIndividualUnlock: payload.usedIndividualUnlock,
			createdAt: row.createdAt
		}];
	});
}

export async function listUserPredictionChangeSummaries(tournamentId: string): Promise<UserPredictionChangeSummary[]> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const rows = await db
		.select()
		.from(auditLogs)
		.where(inArray(auditLogs.action, ['prediction_created', 'prediction_updated']))
		.orderBy(desc(auditLogs.createdAt), desc(auditLogs.id));
	const summaries = new Map<string, UserPredictionChangeSummary>();

	for (const row of rows) {
		const payload = parsePredictionAuditPayload(row.payloadJson);
		if (!payload || payload.tournamentId !== sourceId) continue;
		const current = summaries.get(payload.userId);
		const change: PredictionChangeAudit = {
			id: String(row.id),
			userId: payload.userId,
			tournamentId: payload.tournamentId,
			matchId: payload.matchId,
			matchLabel: payload.matchId,
			action: row.action as PredictionChangeAudit['action'],
			previous: payload.previous,
			next: payload.next,
			changedByUserId: row.userId === null ? null : String(row.userId),
			usedIndividualUnlock: payload.usedIndividualUnlock,
			createdAt: row.createdAt
		};

		if (!current) {
			summaries.set(payload.userId, { userId: payload.userId, count: 1, lastChangedAt: row.createdAt, lastChange: change });
		} else {
			current.count += 1;
		}
	}

	return [...summaries.values()];
}

export async function getPredictionChangeAuditsAndSummaries(tournamentId: string): Promise<{
	changeSummaries: UserPredictionChangeSummary[];
	predictionChangeAudit: Record<string, PredictionChangeAudit[]>;
}> {
	const sourceId = await getSourceTournamentId(tournamentId);
	const [rows, matches] = await Promise.all([
		db
			.select()
			.from(auditLogs)
			.where(inArray(auditLogs.action, ['prediction_created', 'prediction_updated']))
			.orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)),
		listMatches(sourceId)
	]);

	const matchLabels = new Map(matches.map((match) => [match.id, `${match.teamA} vs ${match.teamB}`]));

	const changeSummaries = new Map<string, UserPredictionChangeSummary>();
	const predictionChangeAudit: Record<string, PredictionChangeAudit[]> = {};

	for (const row of rows) {
		const payload = parsePredictionAuditPayload(row.payloadJson);
		if (!payload || payload.tournamentId !== sourceId) continue;

		const userId = payload.userId;
		const change: PredictionChangeAudit = {
			id: String(row.id),
			userId,
			tournamentId: payload.tournamentId,
			matchId: payload.matchId,
			matchLabel: matchLabels.get(payload.matchId) ?? payload.matchId,
			action: row.action as PredictionChangeAudit['action'],
			previous: payload.previous,
			next: payload.next,
			changedByUserId: row.userId === null ? null : String(row.userId),
			usedIndividualUnlock: payload.usedIndividualUnlock,
			createdAt: row.createdAt
		};

		// Group audits by userId
		if (!predictionChangeAudit[userId]) {
			predictionChangeAudit[userId] = [];
		}
		predictionChangeAudit[userId].push(change);

		// Build change summary
		const current = changeSummaries.get(userId);
		if (!current) {
			changeSummaries.set(userId, {
				userId,
				count: 1,
				lastChangedAt: row.createdAt,
				lastChange: change
			});
		} else {
			current.count += 1;
		}
	}

	return {
		changeSummaries: [...changeSummaries.values()],
		predictionChangeAudit
	};
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
	const synced = await syncTournamentBracketForSource(sourceId);
	if (synced) {
		await createAuditLog({
			userId: input.actorUserId ? Number(input.actorUserId) : null,
			action: 'bracket_synced',
			entityType: 'tournament',
			entityId: sourceId,
			payload: { sourceMatchId: input.matchId, stage: match.stage }
		});
	}

	clearLeaderboardCache();
	clearLandingCache();
	return match;
}

export async function clearMatchResult(input: {
	tournamentId: string;
	matchId: string;
	actorUserId?: string;
}): Promise<Match> {
	const sourceId = await getSourceTournamentId(input.tournamentId);

	const [existing] = await db.select().from(tournamentMatches).where(and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, sourceId))).limit(1);
	if (!existing) throw new Error('Partido inexistente.');

	const [updated] = await db
		.update(tournamentMatches)
		.set({ scoreA: null, scoreB: null, penaltyWinner: null, isClosed: false })
		.where(and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, sourceId)))
		.returning();
	if (!updated) throw new Error('Partido inexistente.');

	const resetMatchIds = existing.stage === 'groups'
		? await resetAllKnockoutMatches(sourceId, input.matchId, input.actorUserId)
		: await resetDownstreamBracketMatches(sourceId, input.matchId, input.actorUserId);

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'match_result_cleared',
		entityType: 'match',
		entityId: input.matchId,
		payload: { tournamentId: sourceId, stage: existing.stage, resetMatchIds }
	});

	await syncTournamentBracketForSource(sourceId);

	clearLeaderboardCache();
	clearLandingCache();
	return toMatch(updated);
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
	return {
		// Reportamos el estado real del torneo. El cierre por partido (10 min antes del
		// kickoff) se maneja a nivel de cada partido y no marcando todo el torneo como
		// 'locked' al arrancar; así "Desbloquear" desde el admin tiene efecto real y el
		// badge refleja si el prode está realmente abierto.
		state: source.state,
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

const leaderboardCache = new Map<string, { promise: Promise<LeaderboardEntry[]>; timestamp: number }>();
const LEADERBOARD_CACHE_TTL = 60 * 1000; // 60 seconds

export function clearLeaderboardCache() {
	leaderboardCache.clear();
}

export async function getLeaderboard(tournamentId: string): Promise<LeaderboardEntry[]> {
	const now = Date.now();
	const cached = leaderboardCache.get(tournamentId);
	if (cached && (now - cached.timestamp < LEADERBOARD_CACHE_TTL)) {
		return cached.promise;
	}

	const promise = getLeaderboardUncached(tournamentId).catch((err) => {
		leaderboardCache.delete(tournamentId);
		throw err;
	});
	leaderboardCache.set(tournamentId, { promise, timestamp: now });
	return promise;
}

async function getLeaderboardUncached(tournamentId: string): Promise<LeaderboardEntry[]> {
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
	const matches = matchRows.map(toMatch);
	const matchMap = new Map(matches.map((match) => [match.id, match]));
	const config = sourceTournament.scoringConfig;

	const board = usersInTournament.map((user) => {
		let totalPoints = 0;
		let exactHits = 0;
		let outcomeHits = 0;
		let bracketPoints = 0;
		const userPredictions = predictionRows
			.filter((item) => String(item.userId) === user.id)
			.map(toPrediction);
		const predictedBracket = buildPredictedBracket(matches, userPredictions);
		for (const prediction of userPredictions) {
			const match = matchMap.get(prediction.matchId);
			if (!match) continue;
			const points = calculatePredictionPoints(prediction, match, config, predictedBracket[prediction.matchId]);
			if (!points) continue;

			totalPoints += points.totalPoints;
			bracketPoints += points.bracketPoints;
			if (points.exactHit) exactHits += 1;
			else if (points.outcomeHit) outcomeHits += 1;
		}
		const groupStage = calculateGroupStagePoints(predictedBracket, matches, config);
		totalPoints += groupStage.totalPoints;
		bracketPoints += groupStage.totalPoints;
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
	const matches = matchRows.map(toMatch);
	const matchMap = new Map(matches.map((match) => [match.id, match]));
	const predictions = predRows.map(toPrediction);
	const predictedBracket = buildPredictedBracket(matches, predictions);
	const details: MatchPointDetail[] = [];

	for (const pred of predictions) {
		const match = matchMap.get(pred.matchId);
		if (!match) continue;
		const points = calculatePredictionPoints(pred, match, config, predictedBracket[pred.matchId]);
		if (points) details.push(toMatchPointDetail(points));
	}

	return details.sort((a, b) => b.totalPoints - a.totalPoints);
}

/** Desglose del puntaje por clasificación de grupos de un jugador */
export async function getPlayerGroupStageDetails(userId: string, tournamentId: string): Promise<GroupStagePointResult> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) return { totalPoints: 0, details: [] };
	const sourceId = getSourceId(tournament);
	const sourceTournament = tournament.parentTournamentId ? await getTournamentById(sourceId) : tournament;
	if (!sourceTournament) return { totalPoints: 0, details: [] };
	const [predRows, matchRows] = await Promise.all([
		db.select().from(tournamentPredictions).where(
			and(eq(tournamentPredictions.userId, Number(userId)), eq(tournamentPredictions.tournamentId, sourceId))
		),
		db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, sourceId))
	]);
	const matches = matchRows.map(toMatch);
	const predictions = predRows.map(toPrediction);
	const predictedBracket = buildPredictedBracket(matches, predictions);
	return calculateGroupStagePoints(predictedBracket, matches, sourceTournament.scoringConfig);
}

export async function updateMatchTeams(input: {
	tournamentId: string;
	matchId: string;
	teamA: string;
	teamB: string;
	actorUserId?: string;
}): Promise<Match> {
	const sourceId = await getSourceTournamentId(input.tournamentId);
	const sourceMatches = await listMatches(sourceId);
	const existingMatch = sourceMatches.find((match) => match.id === input.matchId);
	if (!existingMatch) throw new Error('Partido inexistente.');

	const teamA = canonicalTeamName(input.teamA);
	const teamB = canonicalTeamName(input.teamB);
	const validTeamNames = new Set(tournamentTeamNamesFromMatches(sourceMatches));
	if (!validTeamNames.has(teamA) || !validTeamNames.has(teamB)) {
		throw new Error('Seleccioná equipos válidos del torneo.');
	}
	if (teamA === teamB) throw new Error('Un partido no puede tener el mismo equipo en ambos lados.');

	const teamIdentityChanged = getTeamId(existingMatch.teamA) !== getTeamId(teamA) || getTeamId(existingMatch.teamB) !== getTeamId(teamB);

	const [updated] = await db
		.update(tournamentMatches)
		.set({
			teamA,
			teamB,
			...(teamIdentityChanged
				? { scoreA: null, scoreB: null, penaltyWinner: null, isClosed: false }
				: {})
		})
		.where(and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, sourceId)))
		.returning();
	if (!updated) throw new Error('Partido inexistente.');

	const resetMatchIds = teamIdentityChanged
		? await resetDownstreamBracketMatches(sourceId, input.matchId, input.actorUserId)
		: [];

	await createAuditLog({
		userId: input.actorUserId ? Number(input.actorUserId) : null,
		action: 'match_teams_updated',
		entityType: 'match',
		entityId: input.matchId,
		payload: {
			tournamentId: sourceId,
			teamA,
			teamB,
			teamAId: getTeamId(teamA),
			teamBId: getTeamId(teamB),
			clearedResult: teamIdentityChanged,
			resetMatchIds
		}
	});

	clearLeaderboardCache();
	clearLandingCache();
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

	const synced = await syncTournamentBracketForSource(sourceId);
	if (synced) {
		await createAuditLog({
			userId: Number(input.actorUserId),
			action: 'bracket_synced',
			entityType: 'tournament',
			entityId: sourceId,
			payload: { source: 'tiebreaker', groupCode: input.groupCode, team: input.team }
		});
	}
	clearLeaderboardCache();
	clearLandingCache();
}

type LandingDataResult = {
	tournament: Tournament | null;
	matches: Match[];
	groups: Record<string, GroupStandingRow[]>;
	groupMatches: Match[];
	bracketMatches: Match[];
};

const landingCache = new Map<string, { promise: Promise<LandingDataResult>; timestamp: number }>();
const LANDING_CACHE_TTL = 60 * 1000;

export function clearLandingCache() {
	landingCache.clear();
}

export async function buildLandingData(): Promise<LandingDataResult> {
	const now = Date.now();
	const cached = landingCache.get('default');
	if (cached && now - cached.timestamp < LANDING_CACHE_TTL) {
		return cached.promise;
	}

	const promise = buildLandingDataUncached().catch((err) => {
		landingCache.delete('default');
		throw err;
	});
	landingCache.set('default', { promise, timestamp: now });
	return promise;
}

async function buildLandingDataUncached(): Promise<LandingDataResult> {
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

	await syncTournamentBracketForSource(tournament.id);

	const [rawMatches, groups] = await Promise.all([
		listMatches(tournament.id),
		buildGroupStandings(tournament.id)
	]);
	const matches = resolveRound32TeamsForDisplay(rawMatches, groups);

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

interface BlogCache {
	allPosts: Promise<BlogPost[]> | null;
	publishedPosts: Map<string, Promise<BlogPost[]>>;
	publishedCount: Promise<number> | null;
	postsBySlug: Map<string, Promise<BlogPost | null>>;
}

let blogCache: BlogCache = {
	allPosts: null,
	publishedPosts: new Map(),
	publishedCount: null,
	postsBySlug: new Map()
};

export function clearBlogCache() {
	blogCache = {
		allPosts: null,
		publishedPosts: new Map(),
		publishedCount: null,
		postsBySlug: new Map()
	};
}

function sanitizeBlogBody(body: string): string {
	return sanitizeHtml(body.trim(), {
		allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'iframe'],
		allowedAttributes: {
			a: ['href', 'target', 'rel'],
			iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'class']
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com'],
		allowProtocolRelative: false,
		transformTags: {
			div: 'p',
			b: 'strong',
			i: 'em',
			h1: 'h2',
			h4: 'h3',
			h5: 'h3',
			h6: 'h3',
			a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }, true)
		},
		nonTextTags: ['script', 'style', 'textarea', 'option']
	}).trim();
}

function textFromBlogBody(body: string): string {
	return sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} })
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function blogImageCacheVersion(updatedAt: string): string {
	const parsed = Date.parse(updatedAt);
	return Number.isFinite(parsed) ? String(parsed) : encodeURIComponent(updatedAt);
}

function publicBlogPostFields() {
	return {
		id: blogPosts.id,
		slug: blogPosts.slug,
		title: blogPosts.title,
		excerpt: blogPosts.excerpt,
		body: blogPosts.body,
		imageUrl: sql<string | null>`
			case
				when ${blogPosts.imageUrl} is null then null
				when substr(${blogPosts.imageUrl}, 1, 5) = 'data:' then 'data:'
				else ${blogPosts.imageUrl}
			end
		`.as('imageUrl'),
		authorId: blogPosts.authorId,
		published: blogPosts.published,
		createdAt: blogPosts.createdAt,
		updatedAt: blogPosts.updatedAt
	};
}

function publicBlogImageUrl(row: Pick<typeof blogPosts.$inferSelect, 'id' | 'imageUrl' | 'updatedAt'>): string | null {
	if (!row.imageUrl) return null;
	return row.imageUrl.startsWith('data:') ? `/blog/image/${row.id}?v=${blogImageCacheVersion(row.updatedAt)}` : row.imageUrl;
}

function toBlogPost(row: typeof blogPosts.$inferSelect, authorNickname: string): BlogPost {
	return {
		id: String(row.id),
		slug: row.slug,
		title: row.title,
		excerpt: row.excerpt,
		body: row.body,
		imageUrl: publicBlogImageUrl(row),
		authorId: String(row.authorId),
		authorNickname,
		published: row.published,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export async function countPublishedBlogPosts(): Promise<number> {
	if (blogCache.publishedCount !== null) {
		return blogCache.publishedCount;
	}
	const promise = db.select({ total: count() }).from(blogPosts).where(eq(blogPosts.published, true))
		.then(([row]) => row?.total ?? 0)
		.catch(err => { blogCache.publishedCount = null; throw err; });
	blogCache.publishedCount = promise;
	return promise;
}

export async function listPublishedBlogPosts(limit = 10, offset = 0): Promise<BlogPost[]> {
	const cacheKey = `${limit}:${offset}`;
	const cached = blogCache.publishedPosts.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}
	const promise = db
		.select({
			post: publicBlogPostFields(),
			nickname: users.nickname
		})
		.from(blogPosts)
		.innerJoin(users, eq(blogPosts.authorId, users.id))
		.where(eq(blogPosts.published, true))
		.orderBy(desc(blogPosts.createdAt), desc(blogPosts.id))
		.limit(limit)
		.offset(offset)
		.then(rows => rows.map((r) => toBlogPost(r.post, r.nickname)))
		.catch(err => { blogCache.publishedPosts.delete(cacheKey); throw err; });
	blogCache.publishedPosts.set(cacheKey, promise);
	return promise;
}

export async function listAllBlogPosts(): Promise<BlogPost[]> {
	if (blogCache.allPosts !== null) {
		return blogCache.allPosts;
	}
	const promise = db
		.select({
			post: publicBlogPostFields(),
			nickname: users.nickname
		})
		.from(blogPosts)
		.innerJoin(users, eq(blogPosts.authorId, users.id))
		.orderBy(asc(blogPosts.createdAt))
		.then(rows => rows.reverse().map((r) => toBlogPost(r.post, r.nickname)))
		.catch(err => { blogCache.allPosts = null; throw err; });
	blogCache.allPosts = promise;
	return promise;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
	const cached = blogCache.postsBySlug.get(slug);
	if (cached !== undefined) {
		return cached;
	}
	const promise = db
		.select({
			post: publicBlogPostFields(),
			nickname: users.nickname
		})
		.from(blogPosts)
		.innerJoin(users, eq(blogPosts.authorId, users.id))
		.where(eq(blogPosts.slug, slug))
		.limit(1)
		.then(rows => {
			if (!rows.length) return null;
			return toBlogPost(rows[0].post, rows[0].nickname);
		})
		.catch(err => { blogCache.postsBySlug.delete(slug); throw err; });
	blogCache.postsBySlug.set(slug, promise);
	return promise;
}

export async function getBlogPostImageById(postId: string): Promise<{ bytes: Buffer; contentType: string; updatedAt: string } | null> {
	const id = Number(postId);
	if (!Number.isFinite(id)) return null;

	const [post] = await db
		.select({ imageUrl: blogPosts.imageUrl, updatedAt: blogPosts.updatedAt })
		.from(blogPosts)
		.where(eq(blogPosts.id, id))
		.limit(1);
	if (!post?.imageUrl) return null;

	const match = /^data:([^;,]+);base64,(.*)$/s.exec(post.imageUrl);
	if (!match) return null;

	return {
		bytes: Buffer.from(match[2], 'base64'),
		contentType: match[1],
		updatedAt: post.updatedAt
	};
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
	const body = sanitizeBlogBody(input.body);
	if (!textFromBlogBody(body)) throw new Error('El contenido es obligatorio.');

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
	clearBlogCache();
	return toBlogPost(created, author?.nickname ?? 'Admin');
}

export async function updateBlogPost(input: {
	postId: string;
	title: string;
	excerpt: string;
	body: string;
	imageUrl?: string;
	removeImage?: boolean;
}): Promise<BlogPost> {
	const postId = Number(input.postId);
	if (!Number.isFinite(postId)) throw new Error('Artículo inválido.');
	const title = input.title.trim();
	if (!title) throw new Error('El título es obligatorio.');
	const excerpt = input.excerpt.trim();
	if (!excerpt) throw new Error('La descripción corta es obligatoria.');
	const body = sanitizeBlogBody(input.body);
	if (!textFromBlogBody(body)) throw new Error('El contenido es obligatorio.');

	const values: Partial<typeof blogPosts.$inferInsert> = {
		title,
		excerpt,
		body,
		updatedAt: new Date().toISOString()
	};
	if (input.removeImage) {
		values.imageUrl = null;
	} else if (input.imageUrl) {
		values.imageUrl = input.imageUrl.trim();
	}

	const [updated] = await db.update(blogPosts).set(values).where(eq(blogPosts.id, postId)).returning();
	if (!updated) throw new Error('Artículo no encontrado.');
	const author = await getUserById(String(updated.authorId));
	clearBlogCache();
	return toBlogPost(updated, author?.nickname ?? 'Admin');
}

export async function deleteBlogPost(postId: string): Promise<void> {
	await db.delete(blogPosts).where(eq(blogPosts.id, Number(postId)));
	clearBlogCache();
}
