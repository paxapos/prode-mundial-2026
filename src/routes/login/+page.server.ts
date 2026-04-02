import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { createSession } from '$lib/server/auth';
import { authenticateUser, bootstrapFirstAdmin, getUserCount } from '$lib/server/state';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		throw redirect(302, '/prode');
	}
	const errorParam = url.searchParams.get('error');
	const errorMessages: Record<string, string> = {
		google_not_configured: 'Login con Google no configurado.',
		oauth_state_mismatch: 'Error de seguridad en el login con Google. Intenta de nuevo.',
		google_auth_failed: 'No se pudo autenticar con Google. Intenta de nuevo.'
	};
	return {
		googleEnabled: Boolean(env.GOOGLE_CLIENT_ID),
		errorMessage: errorParam ? (errorMessages[errorParam] ?? 'Error al iniciar sesion.') : null
	};
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
