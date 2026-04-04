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

	let mobileMenuOpen = $state(false);

	function closeMenu() {
		mobileMenuOpen = false;
	}
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
	<!-- ═══ STICKY NAV ═══ -->
	<header class="sticky top-3 z-30 mb-8 rounded-2xl border border-slate-200/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur md:px-6">
		<div class="flex items-center gap-3">
			<!-- Logo -->
			<a href="/" class="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900">
				<img src={favicon} alt="Copa" class="h-6 w-6" />
				<span class="hidden sm:inline">PRODE 2026</span>
			</a>

			<!-- Desktop nav -->
			<nav class="hidden items-center gap-1 md:flex">
				<a href="/" class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Inicio</a>
				{#if data.user}
					{#each data.ligas as liga}
						<a href={`/${liga.alias}`} class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
							Liga {liga.name}
						</a>
					{/each}
					<a href="/prode" class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Mi Prode</a>
				{/if}
				<a href="/estadisticas" class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Estadísticas</a>
				{#if data.user?.role === 'admin'}
					<a href="/admin" class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Admin</a>
				{/if}
			</nav>

			<!-- Spacer -->
			<div class="flex-1"></div>

			<!-- Desktop right section -->
			<div class="hidden items-center gap-2 md:flex">
				{#if data.activeTournament}
					<Badge color="blue">{data.activeTournament.name}</Badge>
				{/if}
				<Badge color={stateTone[data.settings.state] ?? 'blue'}>
					{data.settings.state}
				</Badge>
				{#if data.user}
					<form method="POST" action="/logout">
						<Button size="xs" color="light">Salir ({data.user.nickname})</Button>
					</form>
				{:else}
					<Button size="xs" color="blue" href="/login">Ingresar</Button>
				{/if}
			</div>

			<!-- Mobile: status + hamburger -->
			<div class="flex items-center gap-2 md:hidden">
				{#if data.user}
					<span class="text-xs font-semibold text-slate-500">{data.user.nickname}</span>
				{/if}
				<button
					onclick={() => mobileMenuOpen = !mobileMenuOpen}
					class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
					aria-label="Menú"
				>
					{#if mobileMenuOpen}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
					{:else}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
					{/if}
				</button>
			</div>
		</div>
	</header>

	<!-- ═══ MOBILE DRAWER ═══ -->
	{#if mobileMenuOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40 md:hidden" onkeydown={(e) => e.key === 'Escape' && closeMenu()}>
			<!-- Backdrop -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
				onclick={closeMenu}
			></div>

			<!-- Drawer panel -->
			<nav class="absolute inset-y-0 right-0 flex w-72 flex-col bg-white shadow-2xl">
				<!-- Drawer header -->
				<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
					<div class="flex items-center gap-2">
						<img src={favicon} alt="Copa" class="h-6 w-6" />
						<span class="text-lg font-black text-slate-900">PRODE 2026</span>
					</div>
					<button onclick={closeMenu} class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar">
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
					</button>
				</div>

				<!-- Drawer links -->
				<div class="flex-1 overflow-y-auto px-3 py-4">
					<div class="space-y-1">
						<a href="/" onclick={closeMenu} class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
							<span class="text-lg">🏠</span> Inicio
						</a>

						{#if data.user}
							<a href="/prode" onclick={closeMenu} class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
								<span class="text-lg">⚽</span> Mi Prode
							</a>

							{#if data.ligas.length > 0}
								<div class="px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Mis Ligas</div>
								{#each data.ligas as liga}
									<a href={`/${liga.alias}`} onclick={closeMenu} class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
										<span class="text-lg">🏆</span> {liga.name}
									</a>
								{/each}
							{/if}
						{/if}

						<a href="/estadisticas" onclick={closeMenu} class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
							<span class="text-lg">📊</span> Estadísticas
						</a>

						{#if data.user?.role === 'admin'}
							<a href="/admin" onclick={closeMenu} class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
								<span class="text-lg">⚙️</span> Admin
							</a>
						{/if}
					</div>
				</div>

				<!-- Drawer footer -->
				<div class="border-t border-slate-100 px-5 py-4">
					<div class="mb-3 flex flex-wrap gap-1.5">
						{#if data.activeTournament}
							<Badge color="blue">{data.activeTournament.name}</Badge>
						{/if}
						<Badge color={stateTone[data.settings.state] ?? 'blue'}>
							{data.settings.state}
						</Badge>
					</div>
					{#if data.user}
						<form method="POST" action="/logout">
							<Button size="sm" color="light" class="w-full">Salir ({data.user.nickname})</Button>
						</form>
					{:else}
						<Button size="sm" color="blue" href="/login" class="w-full">Ingresar</Button>
					{/if}
				</div>
			</nav>
		</div>
	{/if}

	<main>
		{#if !data.dbReady && data.dbInitMessage}
			<div class="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
				<strong>Inicializacion incompleta:</strong> {data.dbInitMessage}
			</div>
		{/if}

		{@render children()}
	</main>
</div>
