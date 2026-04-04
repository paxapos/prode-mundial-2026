import type { LayoutServerLoad } from './$types';
import { ensureDatabaseReady } from '$lib/server/bootstrap';
import { getActiveTournament, getTournamentSettings, listLigas, listUserTournamentIds } from '$lib/server/state';

export const load: LayoutServerLoad = async ({ locals }) => {
	try {
		await ensureDatabaseReady();
		const activeTournament = await getActiveTournament();

		// List only ligas (child tournaments) the user is enrolled in
		let userLigas: Awaited<ReturnType<typeof listLigas>> = [];
		if (locals.user && activeTournament) {
			const allLigas = await listLigas(activeTournament.id);
			const enrolledIds = await listUserTournamentIds(String(locals.user.id));
			userLigas = allLigas.filter((l) => enrolledIds.includes(l.id));
		}

		return {
			user: locals.user,
			activeTournament,
			ligas: userLigas,
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
			ligas: [],
			settings: { state: 'draft', tournamentStartAt: new Date().toISOString(), lockReason: null },
			dbReady: false,
			dbInitMessage: `No se pudo inicializar la base de datos: ${reason}`
		};
	}
};
