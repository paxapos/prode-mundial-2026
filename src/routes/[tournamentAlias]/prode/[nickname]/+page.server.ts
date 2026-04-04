import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { SideWinner } from '$lib/types';
import {
	getPlayerMatchDetails,
	getTournamentByAlias,
	getTournamentSettings,
	getUserByNickname,
	listMatches,
	listPredictionsForUser,
	listUserTournamentIds,
	savePrediction
} from '$lib/server/state';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const tournament = await getTournamentByAlias(params.tournamentAlias);
	if (!tournament) throw error(404, 'Liga no encontrada.');

	const profileUser = await getUserByNickname(params.nickname);
	if (!profileUser) throw error(404, 'Usuario no encontrado.');

	const userTournamentIds = await listUserTournamentIds(profileUser.id);
	// Check enrollment in this specific liga OR the source tournament
	const sourceId = tournament.parentTournamentId ?? tournament.id;
	if (!userTournamentIds.includes(tournament.id) && !userTournamentIds.includes(sourceId)) {
		throw error(404, 'Este usuario no participa en esta liga.');
	}

	const currentUser = locals.user;
	const isOwner = currentUser?.id === profileUser.id;
	const isAdmin = currentUser?.role === 'admin';
	const canEdit = isOwner || isAdmin;

	const settings = await getTournamentSettings(tournament.id);
	const tournamentStarted = Date.now() >= new Date(settings.tournamentStartAt).getTime();
	const canViewPredictions = isOwner || isAdmin || tournamentStarted;

	return {
		tournament,
		profileUser: { id: profileUser.id, nickname: profileUser.nickname, avatarUrl: profileUser.avatarUrl },
		matches: await listMatches(tournament.id),
		predictions: canViewPredictions ? await listPredictionsForUser(profileUser.id, tournament.id) : [],
		settings,
		matchDetails: canViewPredictions ? await getPlayerMatchDetails(profileUser.id, tournament.id) : [],
		canEdit,
		isOwner,
		canViewPredictions
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const tournament = await getTournamentByAlias(params.tournamentAlias);
		if (!tournament) throw error(404, 'Liga no encontrada.');

		const profileUser = await getUserByNickname(params.nickname);
		if (!profileUser) throw error(404, 'Usuario no encontrado.');

		// Only the owner or an admin can save predictions
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Debes iniciar sesion.');
		const isOwner = currentUser.id === profileUser.id;
		const isAdmin = currentUser.role === 'admin';
		if (!isOwner && !isAdmin) throw error(403, 'No tenes permiso para editar este prode.');

		const data = await request.formData();
		const matchId = String(data.get('matchId') ?? '');
		const predA = Number(data.get('predA'));
		const predB = Number(data.get('predB'));
		const predPenaltyWinnerRaw = String(data.get('predPenaltyWinner') ?? '');
		const predPenaltyWinner: SideWinner =
			predPenaltyWinnerRaw === 'A' || predPenaltyWinnerRaw === 'B' ? predPenaltyWinnerRaw : null;

		if (!Number.isFinite(predA) || !Number.isFinite(predB)) {
			throw error(400, 'Pronostico invalido.');
		}

		try {
			await savePrediction({
				userId: profileUser.id,
				tournamentId: tournament.id,
				matchId,
				predA,
				predB,
				predPenaltyWinner
			});
			return { ok: true };
		} catch (err) {
			throw error(400, err instanceof Error ? err.message : 'No se pudo guardar el pronostico.');
		}
	}
};
