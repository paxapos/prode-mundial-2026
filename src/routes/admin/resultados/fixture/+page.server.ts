import type { Actions, PageServerLoad } from './$types';
import { addMatchAction, clearResultAction } from '$lib/server/admin-actions';
import { listMatchesWithResolvedBracket, syncTournamentBracket } from '$lib/server/state';

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedTournament } = await parent();
	if (!selectedTournament) return { matches: [] };

	await syncTournamentBracket(selectedTournament.id);
	return {
		matches: await listMatchesWithResolvedBracket(selectedTournament.id)
	};
};

export const actions: Actions = {
	clearResult: clearResultAction,
	addMatch: addMatchAction
};