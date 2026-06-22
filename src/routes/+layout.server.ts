import type { LayoutServerLoad } from './$types';
import { getActiveTournament, getTournamentSettings, listLigas, listUserTournamentIds, listMatches } from '$lib/server/state';

export const load: LayoutServerLoad = async ({ locals }) => {
	try {
		const activeTournament = await getActiveTournament();

		// List only ligas (child tournaments) the user is enrolled in
		let userLigas: Awaited<ReturnType<typeof listLigas>> = [];
		if (locals.user && activeTournament) {
			const allLigas = await listLigas(activeTournament.id);
			const enrolledIds = await listUserTournamentIds(String(locals.user.id));
			userLigas = allLigas.filter((l) => enrolledIds.includes(l.id));
		}

		let upcomingMatches: any[] = [];
		if (activeTournament) {
			const allMatches = await listMatches(activeTournament.id);
			const now = Date.now();
			upcomingMatches = allMatches
				.filter((m) => {
					const kickoffTime = new Date(m.kickoffAt).getTime();
					// Match is either not closed, or it started less than 3 hours ago (live / recently started)
					return !m.isClosed && (kickoffTime + 3 * 60 * 60 * 1000 > now);
				})
				.slice(0, 3)
				.map((m) => ({
					id: m.id,
					teamA: m.teamA,
					teamB: m.teamB,
					kickoffAt: m.kickoffAt,
					scoreA: m.scoreA,
					scoreB: m.scoreB,
					stage: m.stage,
					groupCode: m.groupCode,
					venue: m.venue,
					isClosed: m.isClosed
				}));
		}

		return {
			user: locals.user,
			activeTournament,
			ligas: userLigas,
			settings: activeTournament
				? await getTournamentSettings(activeTournament.id)
				: { state: 'draft', tournamentStartAt: new Date().toISOString(), lockReason: null },
			dbReady: true,
			dbInitMessage: null,
			upcomingMatches
		};
	} catch (err) {
		const reason = err instanceof Error ? err.message : 'Error desconocido';
		return {
			user: locals.user,
			activeTournament: null,
			ligas: [],
			settings: { state: 'draft', tournamentStartAt: new Date().toISOString(), lockReason: null },
			dbReady: false,
			dbInitMessage: `No se pudo inicializar la base de datos: ${reason}`,
			upcomingMatches: []
		};
	}
};
