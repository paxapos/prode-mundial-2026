import type { Actions, PageServerLoad } from './$types';
import { saveTiebreakerAction } from '$lib/server/admin-actions';
import { buildGroupStandings, getGroupAdjustments, listMatchesWithResolvedBracket, syncTournamentBracket } from '$lib/server/state';

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedTournament } = await parent();
	if (!selectedTournament) return { matches: [], groupStandings: {}, groupAdjustments: [] };

	await syncTournamentBracket(selectedTournament.id);
	const [matches, groupStandings, groupAdjustments] = await Promise.all([
		listMatchesWithResolvedBracket(selectedTournament.id),
		buildGroupStandings(selectedTournament.id),
		getGroupAdjustments(selectedTournament.id)
	]);

	return { matches, groupStandings, groupAdjustments };
};

export const actions: Actions = {
	saveTiebreaker: saveTiebreakerAction
};