import type { PageServerLoad } from './$types';
import { buildLandingData, countPublishedBlogPosts, listLigas, listUserTournamentIds, getActiveTournament, listPublishedBlogPosts } from '$lib/server/state';

const BLOG_PAGE_SIZE = 8;

export const load: PageServerLoad = async ({ locals, url }) => {
	const requestedBlogPage = Number(url.searchParams.get('blogPage') ?? '1');
	const normalizedBlogPage = Number.isInteger(requestedBlogPage) && requestedBlogPage > 0 ? requestedBlogPage : 1;

	const [landing, blogPostCount] = await Promise.all([
		buildLandingData(),
		countPublishedBlogPosts()
	]);
	const blogTotalPages = Math.max(1, Math.ceil(blogPostCount / BLOG_PAGE_SIZE));
	const blogPage = Math.min(normalizedBlogPage, blogTotalPages);
	const blogPosts = await listPublishedBlogPosts(BLOG_PAGE_SIZE, (blogPage - 1) * BLOG_PAGE_SIZE);
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
		user: locals.user,
		blogPosts,
		blogPagination: {
			page: blogPage,
			pageSize: BLOG_PAGE_SIZE,
			total: blogPostCount,
			totalPages: blogTotalPages
		}
	};
};
