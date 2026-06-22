import { Buffer } from 'node:buffer';
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { MatchStage, SideWinner } from '$lib/types';
import {
	addMatch,
	assignUserToTournament,
	createBlogPost,
	createLiga,
	createTournament,
	createUserByAdmin,
	clearMatchResult,
	deleteBlogPost,
	disableUserPredictionUnlock,
	setUserPredictionUnlock,
	disableUserPredictionLock,
	setUserPredictionLock,
	lockTournament,
	removeUserFromTournament,
	setGroupAdjustment,
	setMatchResult,
	unlockTournament,
	updateBlogPost,
	updateMatchTeams,
	updateScoringRules,
	updateUserByAdmin
} from '$lib/server/state';

const BLOG_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const BLOG_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function requireAdmin(locals: RequestEvent['locals']) {
	if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
	return locals.user;
}

async function uploadedBlogImageToDataUrl(entry: FormDataEntryValue | null): Promise<string | undefined> {
	if (!entry || typeof entry === 'string' || entry.size === 0) return undefined;
	if (!BLOG_IMAGE_TYPES.has(entry.type)) throw new Error('La imagen debe ser JPG, PNG, WebP o GIF.');
	if (entry.size > BLOG_IMAGE_MAX_BYTES) throw new Error('La imagen no puede superar los 20 MB.');

	const bytes = Buffer.from(await entry.arrayBuffer());
	return `data:${entry.type};base64,${bytes.toString('base64')}`;
}

export async function saveResultAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const tournamentId = String(data.get('tournamentId') ?? '');
	const matchId = String(data.get('matchId') ?? '');
	const scoreA = Number(data.get('scoreA'));
	const scoreB = Number(data.get('scoreB'));
	const penaltyWinnerRaw = String(data.get('penaltyWinner') ?? '');
	const penaltyWinner: SideWinner = penaltyWinnerRaw === 'A' || penaltyWinnerRaw === 'B' ? penaltyWinnerRaw : null;

	if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return fail(400, { message: 'Resultado invalido.' });

	try {
		await setMatchResult({ tournamentId, matchId, scoreA, scoreB, penaltyWinner, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo guardar resultado.' });
	}
}

export async function clearResultAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const tournamentId = String(data.get('tournamentId') ?? '');
	const matchId = String(data.get('matchId') ?? '');

	try {
		await clearMatchResult({ tournamentId, matchId, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo eliminar resultado.' });
	}
}

export async function updateMatchAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const tournamentId = String(data.get('tournamentId') ?? '');
	const matchId = String(data.get('matchId') ?? '');
	const teamA = String(data.get('teamA') ?? '');
	const teamB = String(data.get('teamB') ?? '');

	try {
		await updateMatchTeams({ tournamentId, matchId, teamA, teamB, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo actualizar partido.' });
	}
}

export async function addMatchAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const tournamentId = String(data.get('tournamentId') ?? '');
	const stage = String(data.get('stage') ?? 'groups') as MatchStage;
	const groupCode = String(data.get('groupCode') ?? '') || null;
	const teamA = String(data.get('teamA') ?? '');
	const teamB = String(data.get('teamB') ?? '');
	const kickoffAt = String(data.get('kickoffAt') ?? new Date().toISOString());

	try {
		await addMatch({ tournamentId, stage, groupCode, teamA, teamB, kickoffAt, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo crear partido.' });
	}
}

export async function saveTiebreakerAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const tournamentId = String(data.get('tournamentId') ?? '');
	const groupCode = String(data.get('groupCode') ?? '');
	const team = String(data.get('team') ?? '');
	const tiebreakerPoints = Number(data.get('tiebreakerPoints') ?? 0);
	const reason = String(data.get('reason') ?? '');

	if (!tournamentId || !groupCode || !team) return fail(400, { message: 'Faltan datos obligatorios.' });
	if (!Number.isFinite(tiebreakerPoints)) return fail(400, { message: 'Puntos de desempate inválidos.' });

	try {
		await setGroupAdjustment({ tournamentId, groupCode, team, tiebreakerPoints, reason: reason || undefined, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo guardar desempate.' });
	}
}

export async function updateRulesAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const tournamentId = String(data.get('tournamentId') ?? '');
	const configJson = String(data.get('scoringConfigJson') ?? '');

	let scoringConfig;
	try {
		scoringConfig = JSON.parse(configJson);
	} catch {
		return fail(400, { message: 'Configuración de puntuación inválida.' });
	}

	try {
		await updateScoringRules({ tournamentId, scoringConfig, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo actualizar reglas.' });
	}
}

export async function lockAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const tournamentId = String(data.get('tournamentId') ?? '');
	const reason = String(data.get('reason') ?? 'Bloqueo manual por administracion.');
	try {
		await lockTournament(tournamentId, reason, user.id);
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo bloquear la competicion.' });
	}
}

export async function unlockAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const tournamentId = String(data.get('tournamentId') ?? '');
	try {
		await unlockTournament(tournamentId, user.id);
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo desbloquear la competicion.' });
	}
}

export async function enableUserPredictionUnlockAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const userId = String(data.get('userId') ?? '');
	const tournamentId = String(data.get('tournamentId') ?? '');
	const reason = String(data.get('reason') ?? '');
	try {
		await setUserPredictionUnlock({ userId, tournamentId, reason, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo desbloquear al usuario.' });
	}
}

export async function disableUserPredictionUnlockAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const userId = String(data.get('userId') ?? '');
	const tournamentId = String(data.get('tournamentId') ?? '');
	try {
		await disableUserPredictionUnlock({ userId, tournamentId, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo rebloquear al usuario.' });
	}
}

export async function enableUserPredictionLockAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const userId = String(data.get('userId') ?? '');
	const tournamentId = String(data.get('tournamentId') ?? '');
	const reason = String(data.get('reason') ?? '');
	try {
		await setUserPredictionLock({ userId, tournamentId, reason, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo bloquear al usuario.' });
	}
}

export async function disableUserPredictionLockAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const userId = String(data.get('userId') ?? '');
	const tournamentId = String(data.get('tournamentId') ?? '');
	try {
		await disableUserPredictionLock({ userId, tournamentId, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo habilitar al usuario.' });
	}
}

export async function createUserAction({ request, locals }: RequestEvent) {
	requireAdmin(locals);
	const data = await request.formData();
	const email = String(data.get('email') ?? '');
	const password = String(data.get('password') ?? '');
	const nickname = String(data.get('nickname') ?? '');
	const roleInput = String(data.get('role') ?? 'player');
	const role = roleInput === 'admin' ? 'admin' : 'player';

	try {
		await createUserByAdmin({ email, password, nickname, role });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo crear usuario.' });
	}
}

export async function editUserAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const userId = String(data.get('userId') ?? '');
	const nickname = String(data.get('nickname') ?? '');
	const roleInput = String(data.get('role') ?? 'player');
	const role = roleInput === 'admin' ? 'admin' : 'player';
	const password = String(data.get('password') ?? '');

	try {
		await updateUserByAdmin({ userId, nickname, role, password: password || undefined, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo editar usuario.' });
	}
}

export async function createTournamentAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const name = String(data.get('name') ?? '');
	const alias = String(data.get('alias') ?? '');
	const headerImageUrl = String(data.get('headerImageUrl') ?? '');
	const startAt = String(data.get('startAt') ?? new Date().toISOString());

	try {
		await createTournament({ name, alias, headerImageUrl, startAt, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo crear torneo.' });
	}
}

export async function createLigaAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const name = String(data.get('name') ?? '');
	const alias = String(data.get('alias') ?? '');
	const parentTournamentId = String(data.get('parentTournamentId') ?? '');

	try {
		await createLiga({ name, alias: alias || undefined, parentTournamentId, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo crear liga.' });
	}
}

export async function addToTournamentAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const userId = String(data.get('userId') ?? '');
	const tournamentId = String(data.get('tournamentId') ?? '');

	try {
		await assignUserToTournament({ userId, tournamentId, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo agregar usuario.' });
	}
}

export async function removeFromTournamentAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const userId = String(data.get('userId') ?? '');
	const tournamentId = String(data.get('tournamentId') ?? '');

	try {
		await removeUserFromTournament({ userId, tournamentId, actorUserId: user.id });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo quitar usuario.' });
	}
}

export async function createPostAction({ request, locals }: RequestEvent) {
	const user = requireAdmin(locals);
	const data = await request.formData();
	const title = String(data.get('title') ?? '');
	const excerpt = String(data.get('excerpt') ?? '');
	const body = String(data.get('body') ?? '');

	try {
		const imageUrl = await uploadedBlogImageToDataUrl(data.get('imageFile'));
		await createBlogPost({ title, excerpt, body, imageUrl, authorId: Number(user.id) });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo crear el artículo.' });
	}
}

export async function editPostAction({ request, locals }: RequestEvent) {
	requireAdmin(locals);
	const data = await request.formData();
	const postId = String(data.get('postId') ?? '');
	const title = String(data.get('title') ?? '');
	const excerpt = String(data.get('excerpt') ?? '');
	const body = String(data.get('body') ?? '');
	const removeImage = data.get('removeImage') === 'on';

	try {
		const imageUrl = await uploadedBlogImageToDataUrl(data.get('imageFile'));
		await updateBlogPost({ postId, title, excerpt, body, imageUrl, removeImage });
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo editar el artículo.' });
	}
}

export async function deletePostAction({ request, locals }: RequestEvent) {
	requireAdmin(locals);
	const data = await request.formData();
	const postId = String(data.get('postId') ?? '');

	try {
		await deleteBlogPost(postId);
		return { ok: true };
	} catch (err) {
		return fail(400, { message: err instanceof Error ? err.message : 'No se pudo eliminar el artículo.' });
	}
}