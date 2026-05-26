import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const tournamentQuery = url.searchParams.get('t');
	const suffix = tournamentQuery ? `?t=${encodeURIComponent(tournamentQuery)}` : '';
	throw redirect(302, `/admin/resultados/carga${suffix}`);
};