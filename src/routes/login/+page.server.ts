import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSession } from '$lib/server/auth';
import { authenticateUser, bootstrapFirstAdmin, getUserCount } from '$lib/server/state';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/prode');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '');
		const password = String(formData.get('password') ?? '');
		const nickname = String(formData.get('nickname') ?? '');

		let user;
		try {
			user =
				(await getUserCount()) === 0
					? await bootstrapFirstAdmin({ email, password, nickname })
					: await authenticateUser({ email, password });
			await createSession(cookies, user.id);
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : 'No se pudo iniciar sesion.',
				email,
				nickname
			});
		}
		throw redirect(303, user.role === 'admin' ? '/admin' : '/prode');
	}
};
