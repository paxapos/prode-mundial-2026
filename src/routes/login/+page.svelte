<script lang="ts">
	import { Alert, Button, Card, Input, Label } from 'flowbite-svelte';

	let { form } = $props();
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
	</Card>
</section>
