<script lang="ts">
	import { Alert, Button, Card, Input, Label } from 'flowbite-svelte';

	let { form, data } = $props();
</script>

<svelte:head>
	<title>Login | Prode Mundial 2026</title>
</svelte:head>

<section class="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 md:items-center">
	<div class="space-y-3">
		<p class="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
			Copa 2026
		</p>
		<h1 class="text-4xl font-black tracking-tight text-slate-900">Entrar al Prode</h1>
		<p class="text-slate-600">
			Si no existe ningun usuario, el primero que ingrese se crea automaticamente como administrador.
		</p>
	</div>

	<Card class="shadow-xl ring-1 ring-slate-200/70">
		{#if data.googleEnabled}
			<a
				href="/auth/google"
				class="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
					<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
					<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
					<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
				</svg>
				Continuar con Google
			</a>

			<div class="my-4 flex items-center gap-3">
				<hr class="flex-1 border-slate-200" />
				<span class="text-xs text-slate-400">o con email</span>
				<hr class="flex-1 border-slate-200" />
			</div>
		{/if}

		<form method="POST" class="space-y-4">
			<div>
				<Label for="email" class="mb-2">Mail</Label>
				<Input id="email" name="email" type="email" required placeholder="jugador@mail.com" />
			</div>

			<div>
				<Label for="password" class="mb-2">Clave</Label>
				<Input id="password" name="password" type="password" minlength={6} maxlength={72} required />
			</div>

			<div>
				<Label for="nickname" class="mb-2">Nickname (solo para primer admin)</Label>
				<Input id="nickname" name="nickname" minlength={3} maxlength={20} placeholder="apodo_tabla" />
			</div>

			<Button type="submit" class="w-full" color="green">Entrar</Button>
		</form>

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
	</Card>
</section>
