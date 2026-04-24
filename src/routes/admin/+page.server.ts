import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { SideWinner } from '$lib/types';
import {
	addMatch,
	assignUserToTournament,
	buildGroupStandings,
	createBlogPost,
	createLiga,
	createTournament,
	createUserByAdmin,
	deleteBlogPost,
	getActiveTournament,
	getGroupAdjustments,
	getTournamentByAlias,
	getTournamentById,
	getScoringRules,
	getTournamentSettings,
	listAllBlogPosts,
	listLigas,
	listUsers,
	listMatches,
	listTournaments,
	listTournamentMembers,
	lockTournament,
	removeUserFromTournament,
	setGroupAdjustment,
	setMatchResult,
	updateMatchTeams,
	updateScoringRules,
	updateUserByAdmin
} from '$lib/server/state';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
	const alias = url.searchParams.get('t');
	const selectedTournament = alias ? await getTournamentByAlias(alias) : await getActiveTournament();
	if (!selectedTournament) {
		return { selectedTournament: null, parentTournament: null, tournaments: [], ligas: [], matches: [], users: [], tournamentMembers: [], rules: null, settings: null, groupStandings: {}, groupAdjustments: [] };
	}

	const isLiga = !!selectedTournament.parentTournamentId;
	const parentTournament = isLiga ? await getTournamentById(selectedTournament.parentTournamentId!) : null;
	const ligasParentId = isLiga ? selectedTournament.parentTournamentId! : selectedTournament.id;

	return {
		selectedTournament,
		parentTournament,
		tournaments: await listTournaments(),
		ligas: await listLigas(ligasParentId),
		matches: await listMatches(selectedTournament.id),
		users: await listUsers(),
		tournamentMembers: await listTournamentMembers(selectedTournament.id),
		rules: await getScoringRules(selectedTournament.id),
		settings: await getTournamentSettings(selectedTournament.id),
		blogPosts: await listAllBlogPosts(),
		groupStandings: await buildGroupStandings(selectedTournament.id),
		groupAdjustments: await getGroupAdjustments(selectedTournament.id)
	};
};

export const actions: Actions = {
	saveResult: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');

		const data = await request.formData();
		const tournamentId = String(data.get('tournamentId') ?? '');
		const matchId = String(data.get('matchId') ?? '');
		const scoreA = Number(data.get('scoreA'));
		const scoreB = Number(data.get('scoreB'));
		const penaltyWinnerRaw = String(data.get('penaltyWinner') ?? '');
		const penaltyWinner: SideWinner =
			penaltyWinnerRaw === 'A' || penaltyWinnerRaw === 'B' ? penaltyWinnerRaw : null;

		if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
			return fail(400, { message: 'Resultado invalido.' });
		}

		try {
			await setMatchResult({ tournamentId, matchId, scoreA, scoreB, penaltyWinner, actorUserId: locals.user.id });
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo guardar resultado.' });
		}
	},
	updateRules: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');

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
			await updateScoringRules({
				tournamentId,
				scoringConfig,
				actorUserId: locals.user.id
			});
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo actualizar reglas.' });
		}
	},
	lock: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const tournamentId = String(data.get('tournamentId') ?? '');
		const reason = String(data.get('reason') ?? 'Bloqueo manual por administracion.');
		await lockTournament(tournamentId, reason, locals.user.id);
		return { ok: true };
	},
	editUser: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const userId = String(data.get('userId') ?? '');
		const nickname = String(data.get('nickname') ?? '');
		const roleInput = String(data.get('role') ?? 'player');
		const role = roleInput === 'admin' ? 'admin' : 'player';

		try {
			await updateUserByAdmin({ userId, nickname, role, actorUserId: locals.user.id });
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo editar usuario.' });
		}
	},
	createUser: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
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
	},
	createTournament: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const name = String(data.get('name') ?? '');
		const alias = String(data.get('alias') ?? '');
		const headerImageUrl = String(data.get('headerImageUrl') ?? '');
		const startAt = String(data.get('startAt') ?? new Date().toISOString());

		try {
			await createTournament({
				name,
				alias,
				headerImageUrl,
				startAt,
				actorUserId: locals.user.id
			});
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo crear torneo.' });
		}
	},
	assignUser: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const userId = String(data.get('userId') ?? '');
		const tournamentId = String(data.get('tournamentId') ?? '');
		try {
			await assignUserToTournament({ userId, tournamentId, actorUserId: locals.user.id });
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo asignar usuario.' });
		}
	},
	updateMatch: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const tournamentId = String(data.get('tournamentId') ?? '');
		const matchId = String(data.get('matchId') ?? '');
		const teamA = String(data.get('teamA') ?? '');
		const teamB = String(data.get('teamB') ?? '');
		try {
			await updateMatchTeams({ tournamentId, matchId, teamA, teamB, actorUserId: locals.user.id });
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo actualizar partido.' });
		}
	},
	addMatch: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const tournamentId = String(data.get('tournamentId') ?? '');
		const stage = String(data.get('stage') ?? 'groups') as 'groups' | 'round32' | 'round16' | 'quarterfinal' | 'semifinal' | 'final';
		const groupCode = String(data.get('groupCode') ?? '') || null;
		const teamA = String(data.get('teamA') ?? '');
		const teamB = String(data.get('teamB') ?? '');
		const kickoffAt = String(data.get('kickoffAt') ?? new Date().toISOString());
		try {
			await addMatch({ tournamentId, stage, groupCode, teamA, teamB, kickoffAt, actorUserId: locals.user.id });
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo crear partido.' });
		}
	},
	removeFromTournament: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const userId = String(data.get('userId') ?? '');
		const tournamentId = String(data.get('tournamentId') ?? '');
		try {
			await removeUserFromTournament({ userId, tournamentId, actorUserId: locals.user.id });
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo quitar usuario.' });
		}
	},
	addToTournament: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const userId = String(data.get('userId') ?? '');
		const tournamentId = String(data.get('tournamentId') ?? '');
		try {
			await assignUserToTournament({ userId, tournamentId, actorUserId: locals.user.id });
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo agregar usuario.' });
		}
	},
	createLiga: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const name = String(data.get('name') ?? '');
		const alias = String(data.get('alias') ?? '');
		const parentTournamentId = String(data.get('parentTournamentId') ?? '');

		try {
			await createLiga({
				name,
				alias: alias || undefined,
				parentTournamentId,
				actorUserId: locals.user.id
			});
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo crear liga.' });
		}
	},
	createPost: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const title = String(data.get('title') ?? '');
		const excerpt = String(data.get('excerpt') ?? '');
		const body = String(data.get('body') ?? '');
		const imageUrl = String(data.get('imageUrl') ?? '');

		try {
			await createBlogPost({
				title,
				excerpt,
				body,
				imageUrl: imageUrl || undefined,
				authorId: Number(locals.user.id)
			});
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo crear el artículo.' });
		}
	},
	deletePost: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const postId = String(data.get('postId') ?? '');
		try {
			await deleteBlogPost(postId);
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo eliminar el artículo.' });
		}
	},
	saveTiebreaker: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
		const data = await request.formData();
		const tournamentId = String(data.get('tournamentId') ?? '');
		const groupCode = String(data.get('groupCode') ?? '');
		const team = String(data.get('team') ?? '');
		const tiebreakerPoints = Number(data.get('tiebreakerPoints') ?? 0);
		const reason = String(data.get('reason') ?? '');

		if (!tournamentId || !groupCode || !team) {
			return fail(400, { message: 'Faltan datos obligatorios.' });
		}
		if (!Number.isFinite(tiebreakerPoints)) {
			return fail(400, { message: 'Puntos de desempate inválidos.' });
		}

		try {
			await setGroupAdjustment({
				tournamentId,
				groupCode,
				team,
				tiebreakerPoints,
				reason: reason || undefined,
				actorUserId: locals.user.id
			});
			return { ok: true };
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'No se pudo guardar desempate.' });
		}
	}
};
