import type { LayoutServerLoad } from './$types';
import { ensureDatabaseReady } from '$lib/server/bootstrap';
import { getActiveTournament, getTournamentSettings, listTournaments, listUserTournamentIds } from '$lib/server/state';

export const load: LayoutServerLoad = async ({ locals }) => {
	try {
		await ensureDatabaseReady();
		const activeTournament = await getActiveTournament();
		const allTournaments = await listTournaments();

		// Filter tournaments to only those the user is enrolled in
		let userTournaments = allTournaments;
		if (locals.user) {
			const enrolledIds = await listUserTournamentIds(String(locals.user.id));
			userTournaments = allTournaments.filter((t) => enrolledIds.includes(t.id));
		} else {
			userTournaments = [];
		}

		return {
			user: locals.user,
			activeTournament,
			tournaments: userTournaments,
			settings: activeTournament
				? await getTournamentSettings(activeTournament.id)
				: { state: 'draft', tournamentStartAt: new Date().toISOString(), lockReason: null },
			dbReady: true,
			dbInitMessage: null
		};
	} catch (err) {
		const reason = err instanceof Error ? err.message : 'Error desconocido';
		return {
			user: locals.user,
			activeTournament: null,
			tournaments: [],
			settings: { state: 'draft', tournamentStartAt: new Date().toISOString(), lockReason: null },
			dbReady: false,
			dbInitMessage: `No se pudo inicializar la base de datos: ${reason}`
		};
	}
};
