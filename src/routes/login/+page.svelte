<script lang="ts">
	import { untrack } from 'svelte';
	import { Alert, Button, Input, Label } from 'flowbite-svelte';

	let { form, data } = $props();

	let mode = $state<'login' | 'register'>(untrack(() => form)?.action === 'register' ? 'register' : 'login');
</script>

<svelte:head>
	<title>Login | Prode Mundial 2026</title>
</svelte:head>

<section class="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center">
	<!-- Left side: branding -->
	<div class="space-y-5">
		<div class="flex items-center gap-3">
			<img src="/copacup.svg" alt="Copa" class="h-12 w-12 drop-shadow-md" />
			<span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">Copa 2026</span>
		</div>
		<h1 class="text-5xl font-black tracking-tight text-slate-900">Entrar al Prode</h1>
		<p class="text-lg text-slate-500">
			Competí con tus amigos pronosticando los resultados del Mundial 2026.
		</p>
		<div class="flex items-center gap-4 pt-2 text-sm text-slate-400">
			<span class="flex items-center gap-1.5">⚽ Pronósticos</span>
			<span class="flex items-center gap-1.5">🏆 Ligas</span>
			<span class="flex items-center gap-1.5">📊 Ranking</span>
		</div>
		<p class="text-xs text-slate-400">Si no existe ningún usuario, el primero en ingresar se crea como administrador.</p>
	</div>

	<!-- Right side: login card -->
	<div class="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-xl ring-1 ring-slate-100 md:p-8">
		<!-- Google button (recommended) -->
		{#if data.googleEnabled}
			<a
				href="/auth/google"
				class="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
					<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
					<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
					<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
				</svg>
				Continuar con Google
				<span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Recomendado</span>
			</a>

			<div class="my-5 flex items-center gap-3">
				<hr class="flex-1 border-slate-200" />
				<span class="text-[11px] font-medium uppercase tracking-wider text-slate-300">o con email</span>
				<hr class="flex-1 border-slate-200" />
			</div>
		{/if}

		<!-- Login / Register tabs -->
		<div class="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
			<button
				type="button"
				onclick={() => { mode = 'login'; }}
				class="flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-all {mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}"
			>
				Iniciar sesión
			</button>
			<button
				type="button"
				onclick={() => { mode = 'register'; }}
				class="flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-all {mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}"
			>
				Registrarse
			</button>
		</div>

		<!-- Login form -->
		{#if mode === 'login'}
			<form method="POST" action="?/login" class="space-y-4">
				<div>
					<Label for="login-email" class="mb-1.5 text-xs font-bold text-slate-500">Email</Label>
					<Input id="login-email" name="email" type="email" required placeholder="jugador@mail.com" value={form?.action === 'login' ? form?.email : ''} class="!bg-slate-50 !text-slate-900 placeholder:text-slate-300" />
				</div>

				<div>
					<Label for="login-password" class="mb-1.5 text-xs font-bold text-slate-500">Contraseña</Label>
					<Input id="login-password" name="password" type="password" minlength={6} maxlength={72} required placeholder="••••••••" class="!bg-slate-50 !text-slate-900 placeholder:text-slate-300" />
				</div>

				<Button type="submit" class="!mt-6 w-full !rounded-xl !py-3 text-sm font-bold" color="green">Entrar</Button>
			</form>
		{:else}
			<!-- Register form -->
			<form method="POST" action="?/register" class="space-y-4">
				<div>
					<Label for="reg-email" class="mb-1.5 text-xs font-bold text-slate-500">Email</Label>
					<Input id="reg-email" name="email" type="email" required placeholder="jugador@mail.com" value={form?.action === 'register' ? form?.email : ''} class="!bg-slate-50 !text-slate-900 placeholder:text-slate-300" />
				</div>

				<div>
					<Label for="reg-password" class="mb-1.5 text-xs font-bold text-slate-500">Contraseña</Label>
					<Input id="reg-password" name="password" type="password" minlength={6} maxlength={72} required placeholder="Mínimo 6 caracteres" class="!bg-slate-50 !text-slate-900 placeholder:text-slate-300" />
				</div>

				<div>
					<Label for="reg-nickname" class="mb-1.5 text-xs font-bold text-slate-500">
						Nickname <span class="text-red-400">*</span>
					</Label>
					<Input id="reg-nickname" name="nickname" minlength={3} maxlength={20} required placeholder="ej: elcometrabas" value={form?.action === 'register' ? form?.nickname : ''} class="!bg-slate-50 !text-slate-900 placeholder:text-slate-300" />
					<p class="mt-1 text-[11px] text-slate-400">Así te van a ver los demás en las tablas. Debe ser único.</p>
				</div>

				<Button type="submit" class="!mt-6 w-full !rounded-xl !py-3 text-sm font-bold" color="green">Crear cuenta</Button>
			</form>
		{/if}

		{#if form?.message}
			<div class="mt-4">
				<Alert color="red">{form.message}</Alert>
			</div>
		{/if}

		{#if data.errorMessage}
			<div class="mt-4">
				<Alert color="red">{data.errorMessage}</Alert>
			</div>
		{/if}
	</div>
</section>
