<script lang="ts">
	import '../app.css';
	import { Badge, Button } from 'flowbite-svelte';
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();

	const ogImage = $derived(`${$page.url.origin}/og-image.jpg`);

	const stateTone: Record<string, 'gray' | 'green' | 'yellow' | 'purple'> = {
		draft: 'gray',
		open_predictions: 'green',
		locked: 'yellow',
		finished: 'purple'
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Prode Mundial 2026 ⚽</title>
	<meta name="description" content="Prode para los amigos, Mundial 2026" />
	<meta property="og:title" content="Prode Mundial 2026 ⚽" />
	<meta property="og:description" content="Prode para los amigos, Mundial 2026" />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:type" content="image/jpeg" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={$page.url.href} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Prode Mundial 2026 ⚽" />
	<meta name="twitter:description" content="Prode para los amigos, Mundial 2026" />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<div class="mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-6 md:px-6">
	<header class="sticky top-3 z-20 mb-8 rounded-2xl border border-slate-200/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur md:px-6">
		<div class="flex flex-wrap items-center gap-3">
			<a href="/" class="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900">
				<img src={favicon} alt="Copa" class="h-6 w-6" />
				PRODE 2026
			</a>
			<a href="/" class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Inicio</a>
			{#if data.user}
				{#each data.tournaments as tournament}
					<a href={`/${tournament.alias}`} class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
						Tabla {tournament.name}
					</a>
				{/each}
				<a href="/prode" class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Mi Prode</a>
			{/if}
			<a href="/estadisticas" class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Estadísticas</a>
			{#if data.user?.role === 'admin'}
				<a href="/admin" class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Administracion</a>
			{/if}

			<div class="ml-auto flex items-center gap-2">
			{#if data.activeTournament}
				<Badge color="blue">{data.activeTournament.name}</Badge>
			{/if}
				<Badge color={stateTone[data.settings.state] ?? 'blue'}>
					Estado: {data.settings.state}
				</Badge>
				{#if data.user}
					<form method="POST" action="/logout">
						<Button size="xs" color="light">Salir ({data.user.nickname})</Button>
					</form>
				{:else}
					<Button size="xs" color="blue" href="/login">Ingresar</Button>
				{/if}
			</div>
		</div>
	</header>

	<main>
		{#if !data.dbReady && data.dbInitMessage}
			<div class="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
				<strong>Inicializacion incompleta:</strong> {data.dbInitMessage}
			</div>
		{/if}

		{@render children()}
	</main>
</div>
