import type { PageServerLoad } from './$types';
import { countPublishedBlogPosts, listPublishedBlogPosts } from '$lib/server/state';

const BLOG_PAGE_SIZE = 12;

export const load: PageServerLoad = async ({ url }) => {
	const requestedPage = Number(url.searchParams.get('page') ?? '1');
	const normalizedPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

	const total = await countPublishedBlogPosts();
	const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
	const page = Math.min(normalizedPage, totalPages);
	const posts = await listPublishedBlogPosts(BLOG_PAGE_SIZE, (page - 1) * BLOG_PAGE_SIZE);

	return {
		posts,
		pagination: {
			page,
			pageSize: BLOG_PAGE_SIZE,
			total,
			totalPages
		}
	};
};
