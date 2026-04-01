import type { PageServerLoad } from './$types';
import { buildLandingData } from '$lib/server/state';

export const load: PageServerLoad = async () => {
	return buildLandingData();
};
