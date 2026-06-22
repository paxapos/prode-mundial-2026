<script lang="ts">
	import { untrack } from 'svelte';
	import { rankThirdPlacedGroups } from '$lib/bracket-rules';
	import { formatMatchDate as formatDate, formatMatchTime as formatTime } from '$lib/match-datetime';
	import { getFlagUrl, VENUES } from '$lib/teams';
	import type { Match } from '$lib/types';
	import BracketCanvas from '$lib/components/BracketCanvas.svelte';
	import { getBroadcastsForMatch } from '$lib/broadcasts';

	let { data } = $props();
	let blogPageNumbers = $derived.by(() => {
		const total = data.blogPagination?.totalPages ?? 1;
		const current = data.blogPagination?.page ?? 1;
		const end = Math.min(total, Math.max(5, current + 2));
		const start = Math.max(1, Math.min(current - 2, end - 4));

		return Array.from({ length: end - start + 1 }, (_, index) => start + index);
	});

	function blogPageHref(page: number): string {
		return page === 1 ? '/#blog' : `/?blogPage=${page}#blog`;
	}

	/** 12 distinct gradient pairs – only used for group headers */
	const groupColors: Record<string, { from: string; to: string }> = {
		A: { from: 'from-rose-600', to: 'to-rose-800' },
		B: { from: 'from-sky-600', to: 'to-sky-800' },
		C: { from: 'from-emerald-600', to: 'to-emerald-800' },
		D: { from: 'from-violet-600', to: 'to-violet-800' },
		E: { from: 'from-amber-600', to: 'to-amber-800' },
		F: { from: 'from-cyan-600', to: 'to-cyan-800' },
		G: { from: 'from-fuchsia-600', to: 'to-fuchsia-800' },
		H: { from: 'from-teal-600', to: 'to-teal-800' },
		I: { from: 'from-indigo-600', to: 'to-indigo-800' },
		J: { from: 'from-blue-600', to: 'to-blue-800' },
		K: { from: 'from-orange-600', to: 'to-orange-800' },
		L: { from: 'from-slate-600', to: 'to-slate-800' }
	};

	function getGroupColor(group: string) {
		return groupColors[group] ?? { from: 'from-slate-600', to: 'to-slate-800' };
	}

	function venueCity(venueName: string | null): string {
		if (!venueName) return '';
		return VENUES[venueName]?.city ?? venueName;
	}

	/** Check if any bracket match has already started → auto-scroll to bracket */
	let bracketSection = $state<HTMLElement>();
	let shouldAutoScroll = $derived.by(() => {
		if (!data.bracketMatches?.length) return false;
		const now = new Date();
		return data.bracketMatches.some((m: Match) => new Date(m.kickoffAt) <= now);
	});
	/** Ranking de mejores terceros en tiempo real (los 8 mejores clasifican). */
	const THIRDS_ADVANCE = 8;
	let thirdPlaceRank = $derived.by(() => {
		const ranking = rankThirdPlacedGroups(data.groups ?? {});
		const map: Record<string, { rank: number; advances: boolean }> = {};
		ranking.forEach((entry, index) => {
			map[entry.group] = { rank: index + 1, advances: index < THIRDS_ADVANCE };
		});
		return map;
	});

	// Shift kickoff date by -3 hours to group 00:00-02:59 matches in previous day
	function getShiftedDayKey(kickoffAt: string): string {
		const date = new Date(kickoffAt);
		const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
		return shifted.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
	}

	function formatSelectorDay(dayKey: string): string {
		const [year, month, day] = dayKey.split('-').map(Number);
		// dayKey ya es el día calendario (AR) correcto. Lo construimos y formateamos en UTC
		// para que el día de la semana/mes no se corra ni difiera entre SSR (UTC) y cliente.
		const date = new Date(Date.UTC(year, month - 1, day));
		let weekday = date.toLocaleDateString('es-AR', { weekday: 'short', timeZone: 'UTC' }).slice(0, 3);
		let monthName = date.toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' }).slice(0, 3);
		weekday = weekday.replace('.', '');
		monthName = monthName.replace('.', '');
		const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
		return `${capitalizedWeekday} ${day} ${monthName}`;
	}

	function formatNextMatchDate(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleDateString('es-AR', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: 'America/Argentina/Buenos_Aires'
		});
	}

	function getChannelBadgeClass(channel: string): string {
		switch (channel) {
			case 'TyC Sports':
				return 'bg-blue-600 text-white border border-blue-500 font-extrabold shadow-sm';
			case 'Telefe':
				return 'bg-gradient-to-r from-blue-600 via-green-600 to-red-600 text-white font-extrabold shadow-sm';
			case 'Disney+':
				return 'bg-indigo-900 text-indigo-100 border border-indigo-700 font-bold';
			case 'TV Pública':
				return 'bg-red-700 text-white border border-red-600 font-bold';
			case 'DSports':
				return 'bg-slate-800 text-cyan-300 border border-cyan-800/40 font-bold';
			case 'Paramount+':
				return 'bg-sky-950 text-sky-300 border border-sky-800/40 font-bold';
			case 'Flow':
				return 'bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-bold';
			default:
				return 'bg-slate-100 text-slate-600 border border-slate-200';
		}
	}

	let matchesByDay = $derived.by(() => {
		const groups: Record<string, Match[]> = {};
		for (const match of data.matches || []) {
			const key = getShiftedDayKey(match.kickoffAt);
			if (!groups[key]) groups[key] = [];
			groups[key].push(match);
		}
		for (const key in groups) {
			groups[key].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
		}
		return groups;
	});

	let sortedDays = $derived.by(() => {
		return Object.keys(matchesByDay).sort((a, b) => a.localeCompare(b));
	});

	let nextMatch = $derived.by(() => {
		const now = new Date();
		const upcoming = (data.matches || [])
			.filter((m: Match) => new Date(m.kickoffAt) > now)
			.sort((a: Match, b: Match) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
		return upcoming[0] || null;
	});

	// Día por defecto: el del próximo partido; si no hay, hoy; si no, el primero con partidos.
	// Es un $derived para que renderice en SSR (sin flash de vacío). El usuario puede sobreescribir.
	function defaultDay(): string {
		if (nextMatch) return getShiftedDayKey(nextMatch.kickoffAt);
		const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
		if (matchesByDay[todayKey]) return todayKey;
		return sortedDays[0] ?? '';
	}
	let userPickedDay = $state<string | null>(null);
	let selectedDay = $derived(userPickedDay ?? defaultDay());

	// Auto-scroll al bracket si ya empezó alguna llave (una sola vez, cuando el nodo existe).
	let didAutoScroll = false;
	$effect(() => {
		if (didAutoScroll || !shouldAutoScroll || !bracketSection) return;
		didAutoScroll = true;
		setTimeout(() => bracketSection?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
	});

	// Stage tabs navigation
	const STAGE_TABS = [
		{ key: 'groups', label: 'Grupos', emoji: '⚽' },
		{ key: 'bracket', label: 'Llaves', emoji: '🏆' }
	] as const;
	let activeTab = $state<'groups' | 'bracket'>(untrack(() => shouldAutoScroll) ? 'bracket' : 'groups');
</script>

<svelte:head>
	<title>Home | Prode Mundial 2026</title>
</svelte:head>

<section class="space-y-8">
	<!-- Hero -->
	{#if data.tournament}
		<div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 p-6 text-white shadow-lg md:p-10">
			<div class="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-400/10"></div>
			<div class="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-amber-400/10"></div>
			<div class="relative flex items-center gap-5">
				<img src="/mundial_2026.png" alt="FIFA World Cup 2026" class="h-20 w-auto drop-shadow-lg md:h-28" />
				<div>
					<h1 class="text-4xl font-black tracking-tight md:text-5xl">{data.tournament.name}</h1>
					<p class="mt-2 text-sm text-white/70">Fixture completo · Grupos · Llaves</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Quick links for logged-in users -->
	{#if data.user}
		<div class="flex flex-wrap gap-3">
			<a href="/prode" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
				⚽ Mi Prode
			</a>
			{#each data.ligas as liga}
				<a href={`/${liga.alias}`} class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
					🏆 {liga.name}
				</a>
			{/each}
		</div>
	{:else}
		<div class="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
			<img src="/copacup.svg" alt="Copa" class="mx-auto mb-3 h-12 w-12 opacity-40" />
			<p class="text-sm text-slate-500">Iniciá sesión para ver tus ligas, la tabla de posiciones y cargar tus pronósticos.</p>
			<a href="/login" class="mt-3 inline-block rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700">Ingresar</a>
		</div>
	{/if}

	<!-- PRÓXIMOS PARTIDOS Y CALENDARIO -->
	<div class="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<!-- Section Header -->
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
			<div class="flex items-center gap-3">
				<span class="text-3xl">📅</span>
				<div>
					<h2 class="text-xl font-black tracking-tight text-slate-900">Calendario de Partidos</h2>
					<p class="text-xs text-slate-400">Navegá los partidos del Mundial día a día</p>
				</div>
			</div>
			{#if nextMatch}
				<div class="rounded-xl bg-sky-50 px-4 py-2 border border-sky-100 text-xs font-bold text-sky-800">
					📢 Próximo partido: <span class="font-extrabold text-sky-900">{nextMatch.teamA} vs. {nextMatch.teamB}</span>
					({formatNextMatchDate(nextMatch.kickoffAt)} - {formatTime(nextMatch.kickoffAt)} hs)
				</div>
			{/if}
		</div>

		<!-- Day Selector Carousel -->
		{#if sortedDays.length > 0}
			<div class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
				{#each sortedDays as dayKey}
					<button
						onclick={() => userPickedDay = dayKey}
						class="shrink-0 rounded-xl px-4 py-3 text-center transition-all border {selectedDay === dayKey ? 'bg-sky-600 text-white border-sky-600 font-extrabold shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100 hover:text-slate-800 font-semibold'}"
					>
						<span class="block text-xs uppercase tracking-wider opacity-80">{formatSelectorDay(dayKey).split(' ')[0]}</span>
						<span class="block text-lg font-black leading-tight mt-0.5">{formatSelectorDay(dayKey).split(' ')[1]}</span>
						<span class="block text-[10px] opacity-70 mt-0.5">{formatSelectorDay(dayKey).split(' ')[2]}</span>
					</button>
				{/each}
			</div>
		{/if}

		<!-- Matches of Selected Day -->
		{#if selectedDay && matchesByDay[selectedDay]}
			<div class="grid gap-4 md:grid-cols-2">
				{#each matchesByDay[selectedDay] as match}
					{@const broadcasts = getBroadcastsForMatch(match)}
					{@const stats = data.matchPredictionStats?.[match.id]}
					
					<div class="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:border-slate-200 hover:shadow-sm">
						<!-- Match header (Time, Group, Venue) -->
						<div class="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-3">
							<span class="flex items-center gap-1">
								🕒 {formatTime(match.kickoffAt)} hs
								{#if match.stage === 'groups'}
									<span class="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] text-slate-500">Grupo {match.groupCode}</span>
								{:else}
									<span class="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 font-bold">{match.stage.toUpperCase()}</span>
								{/if}
							</span>
							<span class="truncate max-w-[150px]">📍 {venueCity(match.venue)}</span>
						</div>

						<!-- Teams Row -->
						<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-3">
							<!-- Team A -->
							<div class="flex items-center justify-end gap-2.5 min-w-0">
								<span class="truncate text-right text-xs sm:text-sm font-bold text-slate-800" title={match.teamA}>{match.teamA}</span>
								{#if getFlagUrl(match.teamA)}
									<img src={getFlagUrl(match.teamA, 40)} alt={match.teamA} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm border border-slate-100" />
								{/if}
							</div>
							
							<!-- Score/VS -->
							<div class="flex items-center gap-1.5 px-2">
								{#if match.scoreA !== null && match.scoreB !== null}
									<span class="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-xs font-bold text-white">
										{match.scoreA}
									</span>
									<span class="text-[10px] font-bold text-slate-300">-</span>
									<span class="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-xs font-bold text-white">
										{match.scoreB}
									</span>
								{:else}
									<span class="rounded bg-slate-200/60 px-2.5 py-1 text-[11px] font-black text-slate-400">VS</span>
								{/if}
							</div>

							<!-- Team B -->
							<div class="flex items-center gap-2.5 min-w-0">
								{#if getFlagUrl(match.teamB)}
									<img src={getFlagUrl(match.teamB, 40)} alt={match.teamB} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm border border-slate-100" />
								{/if}
								<span class="truncate text-left text-xs sm:text-sm font-bold text-slate-800" title={match.teamB}>{match.teamB}</span>
							</div>
						</div>

						<!-- Broadcasters Section -->
						<div class="border-t border-slate-100/80 pt-3 flex flex-wrap items-center justify-between gap-2">
							<div class="flex flex-wrap gap-1">
								{#each broadcasts as channel}
									<span class="rounded px-2 py-0.5 text-[9px] uppercase tracking-wider {getChannelBadgeClass(channel)}">
										{channel}
									</span>
								{/each}
							</div>
							
							<!-- Predictions Section -->
							<div class="text-[10px] font-semibold text-slate-400">
								📺 Televisa en AR
							</div>
						</div>

						<!-- Prediction Percentage Bar -->
						<div class="border-t border-slate-100/80 mt-3 pt-3">
							{#if stats && stats.total > 0}
								<div class="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
									<span class="truncate max-w-[100px]">{match.teamA} ({stats.winA}%)</span>
									{#if match.stage === 'groups'}
										<span>Empate ({stats.draw}%)</span>
									{:else}
										<span>Gana ({stats.winA > stats.winB ? stats.winA : stats.winB}%)</span>
									{/if}
									<span class="truncate max-w-[100px]">{match.teamB} ({stats.winB}%)</span>
								</div>
								<div class="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
									<div class="bg-blue-500" style="width: {stats.winA}%" title="Gana {match.teamA}: {stats.winA}%"></div>
									{#if match.stage === 'groups'}
										<div class="bg-slate-400" style="width: {stats.draw}%" title="Empate: {stats.draw}%"></div>
									{/if}
									<div class="bg-emerald-500" style="width: {stats.winB}%" title="Gana {match.teamB}: {stats.winB}%"></div>
								</div>
								<div class="flex justify-between text-[9px] text-slate-400 mt-1">
									<span>Pronósticos cargados</span>
									<span>{stats.total} votos</span>
								</div>
							{:else}
								<div class="flex items-center justify-between text-[10px] text-slate-400">
									<span>Tendencias disponibles cuando el partido sea el próximo</span>
									<span>🔒</span>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm font-semibold bg-slate-50/30">
				No hay partidos programados para este día.
			</div>
		{/if}
	</div>


	<!-- La pizarra del DT -->
	{#if data.blogPosts?.length}
		<div id="blog" class="scroll-mt-24 space-y-4">
			<div class="flex items-center gap-3">
				<img src="/guru-futbol.svg" alt="Gurú Táctico" class="h-9 w-9" />
				<div>
					<h2 class="text-xl font-black tracking-tight text-slate-900">La Pizarra del DT</h2>
					<p class="text-xs text-slate-400">Últimos análisis tácticos del Mundial 2026</p>
				</div>
			</div>
			<div class="grid gap-4 md:grid-cols-2">
				{#each data.blogPosts as post}
					<a href="/blog/{post.slug}" class="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
						{#if post.imageUrl}
							<img src={post.imageUrl} alt={post.title} loading="lazy" decoding="async" class="h-40 w-full object-cover" />
						{/if}
						<div class="p-4">
							<h3 class="font-bold text-slate-800 group-hover:text-sky-600">{post.title}</h3>
							<p class="mt-1 line-clamp-2 text-sm text-slate-500">{post.excerpt}</p>
							<p class="mt-2 text-xs text-slate-400">
								{new Date(post.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
							</p>
						</div>
					</a>
				{/each}
			</div>
			{#if data.blogPagination?.totalPages > 1}
				<nav class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Paginación de artículos">
					<p class="text-xs font-semibold text-slate-400">
						Página {data.blogPagination.page} de {data.blogPagination.totalPages} · {data.blogPagination.total} columnas
					</p>
					<div class="flex flex-wrap gap-2">
						<a
							href={blogPageHref(Math.max(1, data.blogPagination.page - 1))}
							aria-disabled={data.blogPagination.page === 1}
							class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
						>
							Anterior
						</a>
						{#each blogPageNumbers as page}
							<a
								href={blogPageHref(page)}
								aria-current={page === data.blogPagination.page ? 'page' : undefined}
								class="rounded-lg border px-3 py-2 text-xs font-bold transition-colors {page === data.blogPagination.page ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}"
							>
								{page}
							</a>
						{/each}
						<a
							href={blogPageHref(Math.min(data.blogPagination.totalPages, data.blogPagination.page + 1))}
							aria-disabled={data.blogPagination.page === data.blogPagination.totalPages}
							class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
						>
							Siguiente
						</a>
					</div>
				</nav>
			{/if}
		</div>
	{/if}

	<!-- Tab navigation -->
	<div class="flex gap-2 rounded-xl bg-slate-100 p-1">
		{#each STAGE_TABS as tab}
			<button
				onclick={() => { activeTab = tab.key; }}
				class="flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all {activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
			>
				{tab.emoji} {tab.label}
				{#if tab.key === 'groups'}
					<span class="ml-1 text-xs font-normal text-slate-400">{data.groupMatches?.length ?? 0} partidos</span>
				{:else}
					<span class="ml-1 text-xs font-normal text-slate-400">{data.bracketMatches?.length ?? 0} partidos</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- GROUPS TAB -->
	{#if activeTab === 'groups'}
	<div>
		<h2 class="mb-4 text-2xl font-black tracking-tight text-slate-900">Fase de Grupos</h2>
		<div class="grid gap-5 lg:grid-cols-2">
			{#each Object.entries(data.groups) as [group, rows]}
				{@const groupMatches = data.groupMatches.filter((m: Match) => m.groupCode === group)}
				{@const gc = getGroupColor(group)}
				<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<!-- Colored group header -->
					<div class="flex items-center justify-between bg-gradient-to-r {gc.from} {gc.to} px-5 py-3">
						<h3 class="text-lg font-black text-white">Grupo {group}</h3>
						<span class="rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white/90">{groupMatches.length} partidos</span>
					</div>

					<!-- Standings table – white bg, readable -->
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
									<th class="px-4 py-2.5 text-left font-semibold">Equipo</th>
									<th class="w-10 py-2.5 text-center font-semibold">PJ</th>
									<th class="w-10 py-2.5 text-center font-semibold">G</th>
									<th class="w-10 py-2.5 text-center font-semibold">E</th>
									<th class="w-10 py-2.5 text-center font-semibold">P</th>
									<th class="w-10 py-2.5 text-center font-semibold">DG</th>
									<th class="w-12 py-2.5 text-center font-bold">PTS</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-50">
								{#each rows as row, idx}
									{@const third = idx === 2 ? thirdPlaceRank[group] : null}
									<tr class={idx < 2 || third?.advances ? 'bg-emerald-50/30' : idx === 2 ? 'bg-amber-50/30' : ''}>
										<td class="px-4 py-2.5">
											<div class="flex items-center gap-2.5">
												{#if idx < 2}
													<span class="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">✓</span>
												{:else if idx === 2}
													<span
														class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white {third?.advances ? 'bg-emerald-500' : 'bg-amber-400'}"
														title={third ? (third.advances ? `Clasifica como 3ro #${third.rank} de 8` : `3ro #${third.rank} — por ahora no clasifica`) : 'Tercero'}
													>{third?.rank ?? '•'}</span>
												{:else}
													<span class="h-5 w-5"></span>
												{/if}
												{#if getFlagUrl(row.team)}
													<img src={getFlagUrl(row.team, 40)} alt={row.team} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" />
												{/if}
												<span class="truncate font-semibold text-slate-800">{row.team}</span>
											</div>
										</td>
										<td class="py-2.5 text-center text-slate-600">{row.played}</td>
										<td class="py-2.5 text-center text-slate-600">{row.wins}</td>
										<td class="py-2.5 text-center text-slate-600">{row.draws}</td>
										<td class="py-2.5 text-center text-slate-600">{row.losses}</td>
										<td class="py-2.5 text-center text-slate-600">{row.goalDiff}</td>
										<td class="py-2.5 text-center text-base font-black text-emerald-700">{row.points}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Group matches – white bg -->
					<div class="border-t border-slate-100">
						{#each groupMatches as match, mIdx}
							<div class="border-b border-slate-50 px-4 py-3 last:border-b-0 {match.isClosed ? 'bg-slate-50/50' : ''}">
								<!-- Date / venue bar -->
								<div class="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
									<span>{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)} hs</span>
									<span>{venueCity(match.venue)}</span>
								</div>
								<!-- Teams + score row (6-col aligned grid) -->
								<div class="grid grid-cols-[1fr_1.75rem_2rem_2rem_1.75rem_1fr] items-center gap-x-2">
									<!-- Col 1: Team A name (right-aligned) -->
									<span class="truncate text-right text-xs sm:text-sm font-semibold text-slate-800" title={match.teamA}>{match.teamA}</span>
									<!-- Col 2: Team A flag -->
									<div class="flex justify-center">
										{#if getFlagUrl(match.teamA)}
											<img src={getFlagUrl(match.teamA, 40)} alt={match.teamA} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" />
										{/if}
									</div>
									<!-- Col 3: Score A -->
									<span class="inline-flex h-8 w-8 items-center justify-center rounded-lg {match.scoreA !== null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'} text-sm font-bold">
										{match.scoreA ?? '-'}
									</span>
									<!-- Col 4: Score B -->
									<span class="inline-flex h-8 w-8 items-center justify-center rounded-lg {match.scoreB !== null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'} text-sm font-bold">
										{match.scoreB ?? '-'}
									</span>
									<!-- Col 5: Team B flag -->
									<div class="flex justify-center">
										{#if getFlagUrl(match.teamB)}
											<img src={getFlagUrl(match.teamB, 40)} alt={match.teamB} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" />
										{/if}
									</div>
									<!-- Col 6: Team B name (left-aligned) -->
									<span class="truncate text-left text-xs sm:text-sm font-semibold text-slate-800" title={match.teamB}>{match.teamB}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
	{/if}

	<!-- BRACKET TAB -->
	{#if activeTab === 'bracket'}
	<div bind:this={bracketSection}>
		<h2 class="mb-4 text-2xl font-black tracking-tight text-slate-900">🏆 Llaves del Mundial</h2>
		<p class="mb-4 text-sm text-slate-500">
			Navegá con el dedo o mouse. Pinch o scroll para hacer zoom. Los partidos más cercanos están al frente, la final al fondo con niebla.
		</p>
		{#if data.bracketMatches?.length > 0}
			<BracketCanvas matches={data.matches} onAutoScroll={shouldAutoScroll} />
		{:else}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
				<p class="text-lg font-semibold text-slate-400">Las llaves se habilitarán cuando termine la fase de grupos.</p>
			</div>
		{/if}
	</div>
	{/if}
</section>
