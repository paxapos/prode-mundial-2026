import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { SideWinner } from '$lib/types';
import {
	getActiveTournament,
	getPlayerMatchDetails,
	getTournamentByAlias,
	getTournamentSettings,
	listMatches,
	listPredictionsForUser,
	listTournaments,
	listUserTournamentIds,
	savePrediction
} from '$lib/server/state';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	const wantedAlias = url.searchParams.get('t');
	const active = wantedAlias ? await getTournamentByAlias(wantedAlias) : await getActiveTournament();
	if (!active) {
		return { tournaments: [], selectedTournament: null, matches: [], predictions: [], settings: null };
	}

	const userTournamentIds = await listUserTournamentIds(locals.user.id);
	if (!userTournamentIds.includes(active.id)) {
		return {
			tournaments: await listTournaments(),
			selectedTournament: active,
			matches: [],
			predictions: [],
			settings: await getTournamentSettings(active.id),
			message: 'Todavia no estas asignado a este torneo.'
		};
	}

	return {
		tournaments: await listTournaments(),
		selectedTournament: active,
		matches: await listMatches(active.id),
		predictions: await listPredictionsForUser(locals.user.id, active.id),
		settings: await getTournamentSettings(active.id),
		matchDetails: await getPlayerMatchDetails(locals.user.id, active.id)
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
		const tournamentId = String(data.get('tournamentId') ?? '');
		const predPenaltyWinnerRaw = String(data.get('predPenaltyWinner') ?? '');
		const predPenaltyWinner: SideWinner =
			predPenaltyWinnerRaw === 'A' || predPenaltyWinnerRaw === 'B' ? predPenaltyWinnerRaw : null;

		if (!Number.isFinite(predA) || !Number.isFinite(predB)) {
			return fail(400, { message: 'Pronostico invalido.' });
		}

		try {
			await savePrediction({
				userId: locals.user.id,
				tournamentId,
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
