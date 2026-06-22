import type { Actions, PageServerLoad } from './$types';
import {
	createUserAction,
	disableUserPredictionUnlockAction,
	editUserAction,
	enableUserPredictionUnlockAction,
	disableUserPredictionLockAction,
	enableUserPredictionLockAction
} from '$lib/server/admin-actions';
import {
	listLigas,
	getPredictionChangeAuditsAndSummaries,
	listPredictionUnlocksForTournament,
	listPredictionLocksForTournament,
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

	const [ligas, predictionUnlocks, predictionLocks, auditData] = await Promise.all([
		ligasParentId
			? listLigas(ligasParentId).catch((error) => {
				console.error('[admin/usuarios] listLigas failed', { ligasParentId, error });
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
			: Promise.resolve([]),
		selectedTournament
			? listPredictionLocksForTournament(selectedTournament.id).catch((error) => {
				console.error('[admin/usuarios] listPredictionLocksForTournament failed', {
					tournamentId: selectedTournament.id,
					error
				});
				return [];
			})
			: Promise.resolve([]),
		selectedTournament
			? getPredictionChangeAuditsAndSummaries(selectedTournament.id).catch((error) => {
				console.error('[admin/usuarios] getPredictionChangeAuditsAndSummaries failed', {
					tournamentId: selectedTournament.id,
					error
				});
				return { changeSummaries: [], predictionChangeAudit: {} as Record<string, import('$lib/types').PredictionChangeAudit[]> };
			})
			: Promise.resolve({ changeSummaries: [], predictionChangeAudit: {} as Record<string, import('$lib/types').PredictionChangeAudit[]> })
	]);

	const { changeSummaries, predictionChangeAudit } = auditData;

	return { users, ligas, changeSummaries, predictionUnlocks, predictionLocks, predictionChangeAudit };
};

export const actions: Actions = {
	createUser: createUserAction,
	editUser: editUserAction,
	enablePredictionUnlock: enableUserPredictionUnlockAction,
	disablePredictionUnlock: disableUserPredictionUnlockAction,
	enablePredictionLock: enableUserPredictionLockAction,
	disablePredictionLock: disableUserPredictionLockAction
};