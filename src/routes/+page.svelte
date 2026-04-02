<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import { getFlagUrl, VENUES } from '$lib/teams';
	import type { Match } from '$lib/types';

	let { data } = $props();

	const stageNames: Record<string, string> = {
		round32: 'Ronda de 32',
		round16: 'Octavos de final',
		quarterfinal: 'Cuartos de final',
		semifinal: 'Semifinal',
		final: 'Final'
	};

	const stageOrder = ['round32', 'round16', 'quarterfinal', 'semifinal', 'final'];

	/** 12 distinct gradient pairs using real Tailwind palette colors */
	const groupColors: Record<string, { from: string; to: string; score: string }> = {
		A: { from: 'from-rose-700', to: 'to-rose-900', score: 'text-rose-800' },
		B: { from: 'from-sky-600', to: 'to-sky-800', score: 'text-sky-800' },
		C: { from: 'from-emerald-600', to: 'to-emerald-800', score: 'text-emerald-800' },
		D: { from: 'from-violet-600', to: 'to-violet-800', score: 'text-violet-800' },
		E: { from: 'from-amber-600', to: 'to-amber-800', score: 'text-amber-800' },
		F: { from: 'from-cyan-600', to: 'to-cyan-800', score: 'text-cyan-800' },
		G: { from: 'from-fuchsia-600', to: 'to-fuchsia-800', score: 'text-fuchsia-800' },
		H: { from: 'from-teal-600', to: 'to-teal-800', score: 'text-teal-800' },
		I: { from: 'from-indigo-600', to: 'to-indigo-800', score: 'text-indigo-800' },
		J: { from: 'from-blue-600', to: 'to-blue-800', score: 'text-blue-800' },
		K: { from: 'from-orange-600', to: 'to-orange-800', score: 'text-orange-800' },
		L: { from: 'from-slate-600', to: 'to-slate-800', score: 'text-slate-800' }
	};

	function getGroupColor(group: string) {
		return groupColors[group] ?? { from: 'from-slate-600', to: 'to-slate-800', score: 'text-slate-800' };
	}

	function groupMatchesByGroup(matches: Match[]) {
		const map: Record<string, Match[]> = {};
		for (const m of matches) {
			const g = m.groupCode ?? '?';
			if (!map[g]) map[g] = [];
			map[g].push(m);
		}
		return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
	}

	function groupBracketByStage(matches: Match[]) {
		const map: Record<string, Match[]> = {};
		for (const m of matches) {
			if (!map[m.stage]) map[m.stage] = [];
			map[m.stage].push(m);
		}
		return stageOrder.filter((s) => map[s]).map((s) => [s, map[s]] as const);
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

	<!-- Groups: Standings + Matches -->
	<div>
		<h2 class="mb-4 text-2xl font-black tracking-tight text-slate-900">Fase de Grupos</h2>
		<div class="grid gap-5 lg:grid-cols-2">
			{#each Object.entries(data.groups) as [group, rows]}
				{@const groupMatches = data.groupMatches.filter((m) => m.groupCode === group)}
				{@const gc = getGroupColor(group)}
				<div class="overflow-hidden rounded-2xl bg-gradient-to-br {gc.from} {gc.to} shadow-lg">
					<!-- Group header -->
					<div class="flex items-center justify-between px-5 py-3">
						<h3 class="text-lg font-black text-white">Grupo {group}</h3>
						<span class="rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-white/80">{groupMatches.length} partidos</span>
					</div>

					<!-- Standings mini-table -->
					<div class="mx-3 mb-3 overflow-hidden rounded-xl bg-white/10">
						<table class="w-full text-sm text-white">
							<thead>
								<tr class="border-b border-white/10 text-xs uppercase text-white/60">
									<th class="px-3 py-2 text-left">Equipo</th>
									<th class="w-10 py-2 text-center">PJ</th>
									<th class="w-10 py-2 text-center">G</th>
									<th class="w-10 py-2 text-center">E</th>
									<th class="w-10 py-2 text-center">P</th>
									<th class="w-10 py-2 text-center">DG</th>
									<th class="w-10 py-2 text-center font-bold">Pts</th>
								</tr>
							</thead>
							<tbody>
								{#each rows as row}
									<tr class="border-b border-white/5">
										<td class="px-3 py-2">
											<div class="flex items-center gap-2">
												{#if getFlagUrl(row.team)}
													<img src={getFlagUrl(row.team, 40)} alt={row.team} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow" />
												{/if}
												<span class="truncate font-medium">{row.team}</span>
											</div>
										</td>
										<td class="py-2 text-center">{row.played}</td>
										<td class="py-2 text-center">{row.wins}</td>
										<td class="py-2 text-center">{row.draws}</td>
										<td class="py-2 text-center">{row.losses}</td>
										<td class="py-2 text-center">{row.goalDiff}</td>
										<td class="py-2 text-center font-bold">{row.points}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Group matches -->
					<div class="space-y-1.5 px-3 pb-3">
						{#each groupMatches as match}
							<div class="rounded-lg bg-white/10">
								<!-- Date / venue bar -->
								<div class="flex items-center justify-between px-3 pt-1.5 text-[10px] text-white/50">
									<span>{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)} hs</span>
									<span>{venueCity(match.venue)}</span>
								</div>
								<!-- Teams + score row -->
								<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2">
									<!-- Team A (right-aligned) -->
									<div class="flex items-center justify-end gap-2">
										<span class="truncate text-sm font-medium text-white">{match.teamA}</span>
										{#if getFlagUrl(match.teamA)}
											<img src={getFlagUrl(match.teamA, 40)} alt={match.teamA} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow" />
										{/if}
									</div>

									<!-- Score -->
									<div class="flex items-center gap-1">
										<span class="inline-flex h-7 w-7 items-center justify-center rounded bg-white text-sm font-bold {gc.score}">
											{match.scoreA ?? '-'}
										</span>
										<span class="text-xs text-white/40">-</span>
										<span class="inline-flex h-7 w-7 items-center justify-center rounded bg-white text-sm font-bold {gc.score}">
											{match.scoreB ?? '-'}
										</span>
									</div>

									<!-- Team B (left-aligned) -->
									<div class="flex items-center gap-2">
										{#if getFlagUrl(match.teamB)}
											<img src={getFlagUrl(match.teamB, 40)} alt={match.teamB} class="h-5 w-7 shrink-0 rounded-sm object-cover shadow" />
										{/if}
										<span class="truncate text-sm font-medium text-white">{match.teamB}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Knockout bracket -->
	<div>
		<h2 class="mb-4 text-2xl font-black tracking-tight text-slate-900">Llaves</h2>
		{#each groupBracketByStage(data.bracketMatches) as [stage, matches]}
			<div class="mb-6">
				<h3 class="mb-3 text-lg font-bold text-slate-800">{stageNames[stage] ?? stage}</h3>
				<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each matches as match}
						<div class="overflow-hidden rounded-xl bg-gradient-to-br from-[#1e293b] to-[#334155] shadow">
							<div class="flex items-center justify-between px-3 py-1.5 text-xs text-slate-400">
								<span>{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)} hs</span>
								<span class="text-[10px]">{venueCity(match.venue)}</span>
							</div>
							<div class="space-y-1 px-3 pb-3">
								<!-- Team A row -->
								<div class="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2">
									<div class="flex items-center gap-2">
										{#if getFlagUrl(match.teamA)}
											<img src={getFlagUrl(match.teamA, 40)} alt={match.teamA} class="h-5 w-7 rounded-sm object-cover shadow" />
										{/if}
										<span class="text-sm font-medium text-white">{match.teamA}</span>
									</div>
									<span class="inline-flex h-7 w-7 items-center justify-center rounded bg-white text-sm font-bold text-slate-800">
										{match.scoreA ?? '-'}
									</span>
								</div>
								<!-- Team B row -->
								<div class="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2">
									<div class="flex items-center gap-2">
										{#if getFlagUrl(match.teamB)}
											<img src={getFlagUrl(match.teamB, 40)} alt={match.teamB} class="h-5 w-7 rounded-sm object-cover shadow" />
										{/if}
										<span class="text-sm font-medium text-white">{match.teamB}</span>
									</div>
									<span class="inline-flex h-7 w-7 items-center justify-center rounded bg-white text-sm font-bold text-slate-800">
										{match.scoreB ?? '-'}
									</span>
								</div>
								{#if match.penaltyWinner}
									<p class="mt-1 text-center text-xs font-semibold text-amber-300">Penales: gana {match.penaltyWinner === 'A' ? match.teamA : match.teamB}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</section>
