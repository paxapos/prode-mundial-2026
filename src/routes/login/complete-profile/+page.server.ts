import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { updateOwnProfile } from '$lib/server/state';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	return { user: locals.user };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const nickname = String(formData.get('nickname') ?? '').trim();

		if (nickname.length < 3 || nickname.length > 20) {
			return fail(400, { message: 'El nickname debe tener entre 3 y 20 caracteres.', nickname });
		}

		try {
			await updateOwnProfile({ userId: locals.user.id, nickname });
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : 'No se pudo guardar el nickname.',
				nickname
			});
		}

		throw redirect(303, '/prode');
	}
};
