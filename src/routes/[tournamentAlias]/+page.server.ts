import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLeaderboard, getTournamentByAlias, listPublishedBlogPosts } from '$lib/server/state';

export const load: PageServerLoad = async ({ params }) => {
	const tournament = await getTournamentByAlias(params.tournamentAlias);
	if (!tournament) throw error(404, 'Liga no encontrada.');

	const [leaderboard, blogPosts] = await Promise.all([
		getLeaderboard(tournament.id),
		listPublishedBlogPosts(3)
	]);

	return {
		tournament,
		leaderboard,
		blogPosts
	};
};
