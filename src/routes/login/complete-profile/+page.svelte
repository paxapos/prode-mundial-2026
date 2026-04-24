<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Input, Label } from 'flowbite-svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Completá tu perfil | Prode Mundial 2026</title>
</svelte:head>

<section class="mx-auto max-w-md pt-10">
	<div class="rounded-2xl border border-slate-200/70 bg-white p-8 shadow-xl ring-1 ring-slate-100">
		<!-- Avatar preview -->
		<div class="mb-6 flex flex-col items-center gap-3">
			{#if data.user.avatarUrl}
				<img
					src={data.user.avatarUrl}
					alt="Tu foto de perfil"
					class="h-20 w-20 rounded-full border-4 border-white object-cover shadow-lg"
					referrerpolicy="no-referrer"
				/>
			{:else}
				<div class="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-2xl font-black text-white shadow-lg">
					{data.user.nickname.charAt(0).toUpperCase()}
				</div>
			{/if}
			<div class="text-center">
				<h1 class="text-2xl font-black tracking-tight text-slate-900">¡Bienvenido! 🎉</h1>
				<p class="mt-1 text-sm text-slate-500">Elegí tu nickname para el prode. Es como te van a ver los demás.</p>
			</div>
		</div>

		<form method="POST" use:enhance class="space-y-4">
			<div>
				<Label for="nickname" class="mb-1.5 text-xs font-bold text-slate-500">Nickname</Label>
				<Input
					id="nickname"
					name="nickname"
					minlength={3}
					maxlength={20}
					required
					value={form?.nickname ?? data.user.nickname}
					placeholder="ej: elcometrabas"
					class="!bg-slate-50 !text-center !text-lg !font-bold placeholder:text-slate-300"
				/>
				<p class="mt-1.5 text-center text-[11px] text-slate-400">Entre 3 y 20 caracteres. Debe ser único.</p>
			</div>

			<Button type="submit" class="!mt-6 w-full !rounded-xl !py-3 text-sm font-bold" color="green">
				🚀 Empezar a jugar
			</Button>
		</form>

		{#if form?.message}
			<div class="mt-4">
				<Alert color="red">{form.message}</Alert>
			</div>
		{/if}
	</div>
</section>
