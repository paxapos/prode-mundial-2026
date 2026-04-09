import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBlogPostBySlug } from '$lib/server/state';

export const load: PageServerLoad = async ({ params }) => {
	const post = await getBlogPostBySlug(params.slug);
	if (!post || !post.published) throw error(404, 'Artículo no encontrado.');
	return { post };
};
