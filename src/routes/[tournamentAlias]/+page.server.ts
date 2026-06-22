import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLeaderboard, getScoringRules, getTournamentByAlias } from '$lib/server/state';

export const load: PageServerLoad = async ({ params }) => {
	const tournament = await getTournamentByAlias(params.tournamentAlias);
	if (!tournament) throw error(404, 'Liga no encontrada.');

	const [leaderboard, scoringConfig] = await Promise.all([
		getLeaderboard(tournament.id),
		getScoringRules(tournament.id)
	]);

	return {
		tournament: { ...tournament, scoringConfig },
		leaderboard
	};
};
