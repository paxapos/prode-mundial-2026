<script lang="ts">
	import { onMount } from 'svelte';
	import { getFlagUrl, VENUES } from '$lib/teams';
	import type { Match } from '$lib/types';
	import BracketCanvas from '$lib/components/BracketCanvas.svelte';

	let { data } = $props();

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

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
	}

	function formatTime(iso: string) {
		return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
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
					<p class="mt-2 text-sm text-white/70">Fixture completo · Grupos · Llaves · Tabla de posiciones</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Leaderboard -->
	{#if data.user}
	<div>
		<h2 class="mb-4 text-2xl font-black tracking-tight text-slate-900">Tabla de Posiciones</h2>
		{#if data.leaderboard.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
				<img src="/copacup.svg" alt="Copa" class="mx-auto mb-3 h-16 w-16 opacity-30" />
				<p class="text-sm text-slate-400">No hay participantes todavía.</p>
			</div>
		{:else}
			<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
							<th class="w-14 py-3 text-center">#</th>
							<th class="py-3 pl-4 text-left">Jugador</th>
							<th class="w-20 py-3 text-center">Pts</th>
							<th class="w-20 py-3 text-center">R. Exactos</th>
							<th class="w-20 py-3 text-center">Resultados</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-50">
						{#each data.leaderboard as row, index}
							{@const pos = index + 1}
							<tr class={pos <= 3 ? 'bg-amber-50/40' : ''}>
								<td class="py-3 text-center">
									{#if pos === 1}
										<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-white shadow-sm">1</span>
									{:else if pos === 2}
										<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-400 text-xs font-black text-white shadow-sm">2</span>
									{:else if pos === 3}
										<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-700 text-xs font-black text-white shadow-sm">3</span>
									{:else}
										<span class="text-sm font-semibold text-slate-400">{pos}</span>
									{/if}
								</td>
								<td class="py-3 pl-4">
									<span class="font-semibold text-slate-800">{row.nickname}</span>
								</td>
								<td class="py-3 text-center">
									<span class="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-emerald-100 px-2 py-0.5 text-sm font-black text-emerald-700">{row.totalPoints}</span>
								</td>
								<td class="py-3 text-center text-slate-600">{row.exactHits}</td>
								<td class="py-3 text-center text-slate-600">{row.outcomeHits}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
	{:else}
		<div class="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
			<img src="/copacup.svg" alt="Copa" class="mx-auto mb-3 h-12 w-12 opacity-40" />
			<p class="text-sm text-slate-500">Iniciá sesión para ver la tabla de posiciones y cargar tus pronósticos.</p>
			<a href="/login" class="mt-3 inline-block rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700">Ingresar</a>
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
									<tr class={idx < 2 ? 'bg-emerald-50/30' : ''}>
										<td class="px-4 py-2.5">
											<div class="flex items-center gap-2.5">
												{#if idx < 2}
													<span class="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">✓</span>
												{:else if idx === 2}
													<span class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white">•</span>
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
								<!-- Teams + score row -->
								<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
									<!-- Team A (right-aligned) -->
									<div class="flex items-center justify-end gap-2">
										<span class="truncate text-sm font-semibold text-slate-800">{match.teamA}</span>
										{#if getFlagUrl(match.teamA)}
											<img src={getFlagUrl(match.teamA, 40)} alt={match.teamA} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" />
										{/if}
									</div>

									<!-- Score -->
									<div class="flex items-center gap-1.5">
										<span class="inline-flex h-8 w-8 items-center justify-center rounded-lg {match.scoreA !== null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'} text-sm font-bold">
											{match.scoreA ?? '-'}
										</span>
										<span class="text-xs text-slate-300">:</span>
										<span class="inline-flex h-8 w-8 items-center justify-center rounded-lg {match.scoreB !== null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'} text-sm font-bold">
											{match.scoreB ?? '-'}
										</span>
									</div>

									<!-- Team B (left-aligned) -->
									<div class="flex items-center gap-2">
										{#if getFlagUrl(match.teamB)}
											<img src={getFlagUrl(match.teamB, 40)} alt={match.teamB} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" />
										{/if}
										<span class="truncate text-sm font-semibold text-slate-800">{match.teamB}</span>
									</div>
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
		<h2 class="mb-4 text-2xl font-black tracking-tight text-slate-900">🏆 Llaves del Torneo</h2>
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
