import type { Actions, PageServerLoad } from './$types';
import { lockAction, updateRulesAction } from '$lib/server/admin-actions';
import { getScoringRules } from '$lib/server/state';

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedTournament } = await parent();
	return {
		rules: selectedTournament ? await getScoringRules(selectedTournament.id) : null
	};
};

export const actions: Actions = {
	updateRules: updateRulesAction,
	lock: lockAction
};