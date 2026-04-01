import type { LayoutServerLoad } from './$types';
import { getActiveTournament, getTournamentSettings, listTournaments } from '$lib/server/state';

export const load: LayoutServerLoad = async ({ locals }) => {
	const activeTournament = await getActiveTournament();
	return {
		user: locals.user,
		activeTournament,
		tournaments: await listTournaments(),
		settings: activeTournament
			? await getTournamentSettings(activeTournament.id)
			: { state: 'draft', tournamentStartAt: new Date().toISOString(), lockReason: null }
	};
};
