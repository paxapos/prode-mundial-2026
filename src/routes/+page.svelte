<script lang="ts">
	import { onMount } from 'svelte';
	import { rankThirdPlacedGroups } from '$lib/bracket-rules';
	import { formatMatchDate as formatDate, formatMatchTime as formatTime } from '$lib/match-datetime';
	import { getFlagUrl, VENUES } from '$lib/teams';
	import type { Match } from '$lib/types';
	import BracketCanvas from '$lib/components/BracketCanvas.svelte';

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

	onMount(() => {
		if (shouldAutoScroll && bracketSection) {
			setTimeout(() => {
				bracketSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 400);
		}
	});

	// Stage tabs navigation
	const STAGE_TABS = [
		{ key: 'groups', label: 'Grupos', emoji: '⚽' },
		{ key: 'bracket', label: 'Llaves', emoji: '🏆' }
	] as const;
	let activeTab = $state<'groups' | 'bracket'>(shouldAutoScroll ? 'bracket' : 'groups');
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
								<div class="grid grid-cols-[1fr_28px_32px_32px_28px_1fr] items-center gap-x-2">
									<!-- Col 1: Team A name (right-aligned) -->
									<span class="truncate text-right text-sm font-semibold text-slate-800">{match.teamA}</span>
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
									<span class="truncate text-left text-sm font-semibold text-slate-800">{match.teamB}</span>
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
