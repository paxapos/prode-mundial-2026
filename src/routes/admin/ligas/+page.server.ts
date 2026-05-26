import type { Actions, PageServerLoad } from './$types';
import { addToTournamentAction, createLigaAction, createTournamentAction, removeFromTournamentAction } from '$lib/server/admin-actions';
import { listLigas, listTournaments, listTournamentMembers, listUsers } from '$lib/server/state';

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedTournament } = await parent();
	if (!selectedTournament) return { tournaments: [], ligas: [], users: [], tournamentMembers: [] };

	const ligasParentId = selectedTournament.parentTournamentId ?? selectedTournament.id;
	const [tournaments, ligas, users, tournamentMembers] = await Promise.all([
		listTournaments(),
		listLigas(ligasParentId),
		listUsers(),
		selectedTournament.parentTournamentId ? listTournamentMembers(selectedTournament.id) : Promise.resolve([])
	]);

	return { tournaments, ligas, users, tournamentMembers };
};

export const actions: Actions = {
	createLiga: createLigaAction,
	createTournament: createTournamentAction,
	addToTournament: addToTournamentAction,
	removeFromTournament: removeFromTournamentAction
};