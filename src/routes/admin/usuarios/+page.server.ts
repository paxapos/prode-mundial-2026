import type { Actions, PageServerLoad } from './$types';
import { createUserAction, editUserAction } from '$lib/server/admin-actions';
import { listLigas, listUsers } from '$lib/server/state';

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedTournament } = await parent();
	const ligasParentId = selectedTournament?.parentTournamentId ?? selectedTournament?.id;
	const [users, ligas] = await Promise.all([
		listUsers(),
		ligasParentId ? listLigas(ligasParentId) : Promise.resolve([])
	]);

	return { users, ligas };
};

export const actions: Actions = {
	createUser: createUserAction,
	editUser: editUserAction
};