import type { Actions, PageServerLoad } from './$types';
import { createPostAction, deletePostAction, editPostAction } from '$lib/server/admin-actions';
import { listAllBlogPosts } from '$lib/server/state';

export const load: PageServerLoad = async () => {
	return {
		blogPosts: await listAllBlogPosts()
	};
};

export const actions: Actions = {
	createPost: createPostAction,
	editPost: editPostAction,
	deletePost: deletePostAction
};