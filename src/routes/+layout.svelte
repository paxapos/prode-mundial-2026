<script lang="ts">
	import '../app.css';
	import { Badge, Button } from 'flowbite-svelte';
	import { page, navigating } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import YouTubeModal from '$lib/components/YouTubeModal.svelte';
	import { getFlagUrl, VENUES } from '$lib/teams';
	import { formatMatchDate as formatDate, formatMatchTime as formatTime } from '$lib/match-datetime';

	let { children, data } = $props();

	const ogImage = $derived(`${$page.url.origin}/og-image.jpg`);

	const stateTone: Record<string, 'gray' | 'green' | 'yellow' | 'purple'> = {
		draft: 'gray',
		open_predictions: 'green',
		locked: 'yellow',
		finished: 'purple'
	};

	let mobileMenuOpen = $state(false);

	// --- PWA & Font Scaling State ---
	let fontScale = $state('100');
	let deferredPrompt = $state<any>(null);
	let showInstallPopup = $state(false);
	let isIOS = $state(false);
	let isInstalled = $state(false);

	// Init client-only (font scaling + PWA). $effect corre una sola vez tras montar:
	// usamos variables locales (no los $state que seteamos) para no crear un loop reactivo.
	$effect(() => {
		fontScale = localStorage.getItem('app-font-scale') || '100';

		const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
		const installed =
			window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
		isIOS = iOS;
		isInstalled = installed;

		const dismissedTime = localStorage.getItem('pwa-prompt-dismissed-time');
		const isRecentlyDismissed =
			!!dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 30 * 24 * 60 * 60 * 1000; // 30 días
		// Mostrar el auto-popup como máximo una vez por sesión.
		const alreadyShownThisSession = sessionStorage.getItem('pwa-prompt-shown') === '1';

		let timer: ReturnType<typeof setTimeout> | undefined;
		const maybeAutoShow = () => {
			if (installed || isRecentlyDismissed || alreadyShownThisSession) return;
			sessionStorage.setItem('pwa-prompt-shown', '1');
			timer = setTimeout(() => {
				showInstallPopup = true;
			}, 4000);
		};

		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e;
			maybeAutoShow();
		};
		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

		if (iOS) maybeAutoShow();

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			if (timer) clearTimeout(timer);
		};
	});

	function updateFontScale(val: string) {
		fontScale = val;
		localStorage.setItem('app-font-scale', val);
		document.documentElement.style.fontSize = val + '%';
	}

	async function installPWA() {
		if (!deferredPrompt) return;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'dismissed') {
			localStorage.setItem('pwa-prompt-dismissed-time', String(Date.now()));
		}
		deferredPrompt = null;
		showInstallPopup = false;
	}

	function dismissInstall() {
		showInstallPopup = false;
		localStorage.setItem('pwa-prompt-dismissed-time', String(Date.now()));
	}

	function manualInstallTrigger() {
		showInstallPopup = true;
		if (mobileMenuOpen) mobileMenuOpen = false;
	}

	function closeMenu() {
		mobileMenuOpen = false;
	}

	function venueCity(venueName: string | null): string {
		if (!venueName) return '';
		return VENUES[venueName]?.city ?? venueName;
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

{#if $navigating}
	<div class="fixed left-0 right-0 top-0 z-50 h-1 bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400">
		<div class="h-full bg-sky-600 animate-loading-bar"></div>
	</div>
{/if}

<YouTubeModal />

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

				<!-- Desktop Font Size Control -->
				<div class="ml-2 mr-2 flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
					<button onclick={() => updateFontScale('80')} class="px-2 py-1 text-xs font-bold transition-colors {fontScale === '80' ? 'bg-slate-100 text-slate-900 rounded-md shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}" title="Más chico">A-</button>
					<button onclick={() => updateFontScale('100')} class="px-2 py-1 text-xs font-bold transition-colors {fontScale === '100' ? 'bg-slate-100 text-slate-900 rounded-md shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}" title="Normal">A</button>
					<button onclick={() => updateFontScale('120')} class="px-2 py-1 text-xs font-bold transition-colors {fontScale === '120' ? 'bg-slate-100 text-slate-900 rounded-md shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}" title="Más grande">A+</button>
				</div>

				{#if data.user}
					<form method="POST" action="/logout">
						<Button type="submit" size="xs" color="light">Salir ({data.user.nickname})</Button>
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
					<!-- Mobile Font Size Control -->
					<div class="mb-5">
						<label class="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tamaño de letra</label>
						<div class="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-1">
							<button onclick={() => updateFontScale('80')} class="flex-1 py-2 text-xs font-bold transition-colors {fontScale === '80' ? 'bg-white text-slate-900 rounded-md shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}">A-</button>
							<button onclick={() => updateFontScale('100')} class="flex-1 py-2 text-xs font-bold transition-colors {fontScale === '100' ? 'bg-white text-slate-900 rounded-md shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}">Normal</button>
							<button onclick={() => updateFontScale('120')} class="flex-1 py-2 text-xs font-bold transition-colors {fontScale === '120' ? 'bg-white text-slate-900 rounded-md shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}">A+</button>
						</div>
					</div>

					{#if !isInstalled}
					<div class="mb-5">
						<button onclick={manualInstallTrigger} class="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-700 transition-colors hover:bg-sky-100">
							<span class="text-lg">📲</span> Instalar App
						</button>
					</div>
					{/if}

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
							<Button type="submit" size="sm" color="light" class="w-full">Salir ({data.user.nickname})</Button>
						</form>
					{:else}
						<Button size="sm" color="blue" href="/login" class="w-full">Ingresar</Button>
					{/if}
				</div>
			</nav>
		</div>
	{/if}

	<main>
		<!-- PWA Install Popup / iOS Tooltip -->
		{#if showInstallPopup && !isInstalled}
			<div class="fixed inset-x-0 bottom-0 z-50 flex pointer-events-none justify-center p-4 md:p-6 {isIOS ? 'mb-4' : ''}">
				<div class="relative pointer-events-auto w-full max-w-sm overflow-visible rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-2xl backdrop-blur-xl transition-all">
					
					<button onclick={dismissInstall} class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800" aria-label="Cerrar">
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
					</button>

					<div class="flex items-start gap-4 pr-6">
						<img src="/icon-192.png" alt="App Icon" class="h-12 w-12 shrink-0 rounded-xl shadow-sm border border-slate-100" />
						<div class="flex-1">
							<h3 class="text-base font-black tracking-tight text-slate-900">Prode Mundial 2026</h3>
							
							{#if isIOS}
								<p class="mt-1 text-[11px] font-medium leading-snug text-slate-500">
									Tener el prode a mano es más fácil. Instalalo en tu pantalla de inicio:
								</p>
								<div class="mt-3 space-y-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] font-semibold text-slate-700">
									<p class="flex items-center gap-2">
										<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">1</span>
										Tocá el botón <strong class="text-sky-600">Compartir</strong> 
										<svg class="inline h-4 w-4 -mt-0.5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
										abajo.
									</p>
									<p class="flex items-start gap-2">
										<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">2</span>
										<span>Deslizá y seleccioná <strong class="text-slate-900">Agregar a Inicio</strong> <strong class="inline text-lg leading-none">+</strong></span>
									</p>
								</div>
							{:else}
								<p class="mt-1 text-xs font-medium leading-snug text-slate-500">
									Instalá la app para acceder directo a tus resultados.
								</p>
								<div class="mt-4 flex items-center gap-2">
									<button onclick={installPWA} class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700">
										Instalar App
									</button>
								</div>
							{/if}
						</div>
					</div>

					{#if isIOS}
						<!-- iOS downward pointer to safari share button -->
						<div class="absolute -bottom-2 left-1/2 -ml-2 h-4 w-4 rotate-45 border-b border-r border-slate-200 bg-white" style="box-shadow: 2px 2px 5px rgba(0,0,0,0.05);"></div>
					{/if}
				</div>
			</div>
		{/if}

		{#if !data.dbReady && data.dbInitMessage}
			<div class="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
				<strong>Inicializacion incompleta:</strong> {data.dbInitMessage}
			</div>
		{/if}

		<!-- Banner de próximos partidos / en vivo -->
		{#if data.upcomingMatches && data.upcomingMatches.length > 0}
			<div class="mb-8 rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
				<div class="flex items-center justify-between mb-3 border-b border-amber-200/40 pb-2">
					<div class="flex items-center gap-2">
						<span class="text-xl">🔥</span>
						<span class="text-xs font-black uppercase tracking-wider text-amber-950">Partidos Clave en Vivo / Próximos</span>
					</div>
					<span class="text-[10px] font-bold text-amber-800 bg-amber-200/40 px-2.5 py-0.5 rounded-full">Mundial 2026</span>
				</div>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.upcomingMatches as match}
						{@const isLive = new Date(match.kickoffAt).getTime() <= Date.now() && !match.isClosed}
						<div class="relative overflow-hidden rounded-xl border border-amber-100 bg-white p-3 shadow-[0_2px_10px_rgb(0,0,0,0.01)] hover:shadow-md transition-shadow">
							{#if isLive}
								<span class="absolute right-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white uppercase animate-pulse">
									En Vivo
								</span>
							{:else}
								<span class="absolute right-2 top-2 text-[9px] font-bold text-slate-400">
									🕒 {formatTime(match.kickoffAt)} hs
								</span>
							{/if}
							
							<div class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
								{#if match.stage === 'groups'}
									Grupo {match.groupCode}
								{:else}
									{match.stage.toUpperCase()}
								{/if}
							</div>
							
							<div class="flex items-center justify-between gap-2 my-1">
								<!-- Team A -->
								<div class="flex items-center gap-1.5 min-w-0 flex-1">
									{#if getFlagUrl(match.teamA)}
										<img src={getFlagUrl(match.teamA, 40)} alt={match.teamA} class="h-4 w-6 shrink-0 rounded-sm object-cover border border-slate-100 shadow-xs" />
									{/if}
									<span class="truncate text-xs font-bold text-slate-800" title={match.teamA}>{match.teamA}</span>
								</div>
								
								<!-- Score/VS -->
								<div class="flex items-center gap-1 shrink-0 px-2 bg-slate-50 rounded py-0.5 border border-slate-100/70">
									{#if match.scoreA !== null && match.scoreB !== null}
										<span class="text-xs font-black text-slate-900">{match.scoreA}</span>
										<span class="text-[10px] text-slate-300">-</span>
										<span class="text-xs font-black text-slate-900">{match.scoreB}</span>
									{:else}
										<span class="text-[9px] font-bold text-slate-400">VS</span>
									{/if}
								</div>
								
								<!-- Team B -->
								<div class="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
									<span class="truncate text-xs font-bold text-slate-800 text-right" title={match.teamB}>{match.teamB}</span>
									{#if getFlagUrl(match.teamB)}
										<img src={getFlagUrl(match.teamB, 40)} alt={match.teamB} class="h-4 w-6 shrink-0 rounded-sm object-cover border border-slate-100 shadow-xs" />
									{/if}
								</div>
							</div>
							
							<div class="mt-2 flex items-center justify-between text-[9px] text-slate-400 font-semibold border-t border-slate-50 pt-1.5">
								<span>{formatDate(match.kickoffAt)}</span>
								{#if match.venue}
									<span class="truncate max-w-[120px]">📍 {venueCity(match.venue)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{@render children()}
	</main>
</div>
