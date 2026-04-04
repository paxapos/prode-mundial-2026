import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { SideWinner } from '$lib/types';
import {
	getActiveTournament,
	getPlayerMatchDetails,
	getTournamentSettings,
	listLigas,
	listMatches,
	listPredictionsForUser,
	listUserTournamentIds,
	savePrediction
} from '$lib/server/state';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	// Always load from the source tournament (the competition with matches)
	const source = await getActiveTournament();
	if (!source) {
		return { ligas: [], sourceTournament: null, matches: [], predictions: [], settings: null };
	}

	const userTournamentIds = await listUserTournamentIds(locals.user.id);
	const hasAccess = userTournamentIds.includes(source.id) || userTournamentIds.some(id => id !== source.id);
	if (!hasAccess) {
		return {
			ligas: await listLigas(source.id),
			sourceTournament: source,
			matches: [],
			predictions: [],
			settings: await getTournamentSettings(source.id),
			message: 'Todavia no estas asignado a ninguna liga.'
		};
	}

	return {
		ligas: await listLigas(source.id),
		sourceTournament: source,
		matches: await listMatches(source.id),
		predictions: await listPredictionsForUser(locals.user.id, source.id),
		settings: await getTournamentSettings(source.id),
		matchDetails: await getPlayerMatchDetails(locals.user.id, source.id)
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const matchId = String(data.get('matchId') ?? '');
		const predA = Number(data.get('predA'));
		const predB = Number(data.get('predB'));
		const predPenaltyWinnerRaw = String(data.get('predPenaltyWinner') ?? '');
		const predPenaltyWinner: SideWinner =
			predPenaltyWinnerRaw === 'A' || predPenaltyWinnerRaw === 'B' ? predPenaltyWinnerRaw : null;

		if (!Number.isFinite(predA) || !Number.isFinite(predB)) {
			return fail(400, { message: 'Pronostico invalido.' });
		}

		// Get source tournament for saving prediction
		const source = await getActiveTournament();
		if (!source) {
			return fail(400, { message: 'No hay competicion activa.' });
		}

		try {
			await savePrediction({
				userId: locals.user.id,
				tournamentId: source.id,
				matchId,
				predA,
				predB,
				predPenaltyWinner
			});
			return { ok: true };
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : 'No se pudo guardar el pronostico.'
			});
		}
	}
};
