import type { Actions, PageServerLoad } from './$types';
import { clearResultAction, saveResultAction, updateMatchAction } from '$lib/server/admin-actions';
import { buildGroupStandings, listMatchesWithResolvedBracket, listTournamentTeamNames, syncTournamentBracket } from '$lib/server/state';

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedTournament } = await parent();
	if (!selectedTournament) return { matches: [], teamOptions: [], groupStandings: {} };

	await syncTournamentBracket(selectedTournament.id);
	const [matches, teamOptions, groupStandings] = await Promise.all([
		listMatchesWithResolvedBracket(selectedTournament.id),
		listTournamentTeamNames(selectedTournament.id),
		buildGroupStandings(selectedTournament.id)
	]);

	return { matches, teamOptions, groupStandings };
};

export const actions: Actions = {
	saveResult: saveResultAction,
	clearResult: clearResultAction,
	updateMatch: updateMatchAction
};