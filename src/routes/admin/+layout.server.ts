import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getActiveTournament, getTournamentByAlias, getTournamentById, getTournamentSettings } from '$lib/server/state';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (locals.user.role !== 'admin') throw error(403, 'Solo administradores.');

	const alias = url.searchParams.get('t');
	const selectedTournament = alias ? await getTournamentByAlias(alias) : await getActiveTournament();
	const parentTournament = selectedTournament?.parentTournamentId
		? await getTournamentById(selectedTournament.parentTournamentId)
		: null;

	return {
		selectedTournament,
		parentTournament,
		settings: selectedTournament ? await getTournamentSettings(selectedTournament.id) : null
	};
};