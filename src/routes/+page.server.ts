import type { PageServerLoad } from './$types';
import { buildLandingData, listLigas, listUserTournamentIds, getActiveTournament } from '$lib/server/state';

export const load: PageServerLoad = async ({ locals }) => {
	const landing = await buildLandingData();
	const source = await getActiveTournament();

	// Load ligas for the user
	let userLigas: Awaited<ReturnType<typeof listLigas>> = [];
	if (locals.user && source) {
		const allLigas = await listLigas(source.id);
		const enrolledIds = await listUserTournamentIds(String(locals.user.id));
		userLigas = allLigas.filter((l) => enrolledIds.includes(l.id));
	}

	return {
		...landing,
		ligas: userLigas,
		user: locals.user
	};
};
