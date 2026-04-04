import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { SideWinner } from '$lib/types';
import {
	addMatch,
	assignUserToTournament,
	createLiga,
	createTournament,
	createUserByAdmin,
	getActiveTournament,
	getTournamentByAlias,
	getScoringRules,
	getTournamentSettings,
	listLigas,
	listUsers,
	listMatches,
	listTournaments,
	lockTournament,
	setMatchResult,
	updateMatchTeams,
	updateScoringRules
} from '$lib/server/state';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (locals.user.role !== 'admin') throw error(403, 'Solo administradores.');
	const alias = url.searchParams.get('t');
	const selectedTournament = alias ? await getTournamentByAlias(alias) : await getActiveTournament();
	if (!selectedTournament) {
		return { selectedTournament: null, tournaments: [], ligas: [], matches: [], users: [], rules: null, settings: null };
	}

	return {
		selectedTournament,
		tournaments: await listTournaments(),
		ligas: await listLigas(selectedTournament.id),
		matches: await listMatches(selectedTournament.id),
		users: await listUsers(),
		rules: await getScoringRules(selectedTournament.id),
		settings: await getTournamentSettings(selectedTournament.id)
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
	}
};
