import type { Actions, PageServerLoad } from './$types';
import {
	createUserAction,
	disableUserPredictionUnlockAction,
	editUserAction,
	enableUserPredictionUnlockAction
} from '$lib/server/admin-actions';
import {
	listLigas,
	listPredictionChangeAuditForUser,
	listPredictionUnlocksForTournament,
	listUserPredictionChangeSummaries,
	listUsers
} from '$lib/server/state';

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedTournament } = await parent();
	const ligasParentId = selectedTournament?.parentTournamentId ?? selectedTournament?.id;
	let users: Awaited<ReturnType<typeof listUsers>>;
	try {
		users = await listUsers();
	} catch (error) {
		console.error('[admin/usuarios] listUsers failed', {
			selectedTournamentId: selectedTournament?.id,
			ligasParentId,
			error
		});
		throw error;
	}

	const [ligas, changeSummaries, predictionUnlocks] = await Promise.all([
		ligasParentId
			? listLigas(ligasParentId).catch((error) => {
				console.error('[admin/usuarios] listLigas failed', { ligasParentId, error });
				return [];
			})
			: Promise.resolve([]),
		selectedTournament
			? listUserPredictionChangeSummaries(selectedTournament.id).catch((error) => {
				console.error('[admin/usuarios] listUserPredictionChangeSummaries failed', {
					tournamentId: selectedTournament.id,
					error
				});
				return [];
			})
			: Promise.resolve([]),
		selectedTournament
			? listPredictionUnlocksForTournament(selectedTournament.id).catch((error) => {
				console.error('[admin/usuarios] listPredictionUnlocksForTournament failed', {
					tournamentId: selectedTournament.id,
					error
				});
				return [];
			})
			: Promise.resolve([])
	]);

	const predictionChangeAudit = selectedTournament
		? Object.fromEntries(
			await Promise.all(
				users.map(async (user) => {
					try {
						return [user.id, await listPredictionChangeAuditForUser(user.id, selectedTournament.id)] as const;
					} catch (error) {
						console.error('[admin/usuarios] listPredictionChangeAuditForUser failed', {
							userId: user.id,
							tournamentId: selectedTournament.id,
							error
						});
						return [user.id, []] as const;
					}
				})
			)
		)
		: {};

	return { users, ligas, changeSummaries, predictionUnlocks, predictionChangeAudit };
};

export const actions: Actions = {
	createUser: createUserAction,
	editUser: editUserAction,
	enablePredictionUnlock: enableUserPredictionUnlockAction,
	disablePredictionUnlock: disableUserPredictionUnlockAction
};