import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLeaderboard, getTournamentByAlias } from '$lib/server/state';

export const load: PageServerLoad = async ({ params }) => {
	const tournament = await getTournamentByAlias(params.tournamentAlias);
	if (!tournament) throw error(404, 'Torneo no encontrado.');

	return {
		tournament,
		leaderboard: await getLeaderboard(tournament.id)
	};
};
