<script lang="ts">
	import { Badge, Card, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell } from 'flowbite-svelte';
	import { getFlagUrl } from '$lib/teams';

	let { data } = $props();

	const stageNames: Record<string, string> = {
		round32: 'Ronda de 32',
		round16: 'Octavos de final',
		quarterfinal: 'Cuartos de final',
		semifinal: 'Semifinal',
		final: 'Final'
	};

	const stageOrder = ['round32', 'round16', 'quarterfinal', 'semifinal', 'final'];

	function groupMatchesByGroup(matches: typeof data.groupMatches) {
		const map: Record<string, typeof data.groupMatches> = {};
		for (const m of matches) {
			const g = m.groupCode ?? '?';
			(map[g] ??= []).push(m);
		}
		return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
	}

	function groupBracketByStage(matches: typeof data.bracketMatches) {
		const map: Record<string, typeof data.bracketMatches> = {};
		for (const m of matches) {
			(map[m.stage] ??= []).push(m);
		}
		return stageOrder.filter((s) => map[s]).map((s) => [s, map[s]] as const);
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
	}

	function formatTime(iso: string) {
		return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Home | Prode Mundial 2026</title>
</svelte:head>

<section class="space-y-8">
	<!-- Hero -->
	{#if data.tournament}
		<div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7f1d1d] to-[#991b1b] p-6 text-white shadow-lg md:p-10">
			<div class="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5"></div>
			<div class="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/5"></div>
			<h1 class="relative text-4xl font-black tracking-tight md:text-5xl">{data.tournament.name}</h1>
			<p class="relative mt-2 text-sm text-white/70">Fixture completo · Grupos · Llaves · Tabla de posiciones</p>
		</div>
	{/if}

	<!-- Leaderboard -->
	<div>
		<h2 class="mb-4 text-2xl font-black tracking-tight text-slate-900">Tabla de Posiciones</h2>
		<Card>
			<div class="overflow-x-auto">
				<Table hoverable>
					<TableHead>
						<TableHeadCell class="w-12">#</TableHeadCell>
						<TableHeadCell>Jugador</TableHeadCell>
						<TableHeadCell class="text-center">Pts</TableHeadCell>
						<TableHeadCell class="text-center">Exactos</TableHeadCell>
						<TableHeadCell class="text-center">Signos</TableHeadCell>
					</TableHead>
					<TableBody class="divide-y">
						{#if data.leaderboard.length === 0}
							<TableBodyRow>
								<TableBodyCell colspan={5} class="text-center text-slate-400">No hay participantes todavía.</TableBodyCell>
							</TableBodyRow>
						{:else}
							{#each data.leaderboard as row, index}
								<TableBodyRow>
									<TableBodyCell class="font-bold text-slate-500">{index + 1}</TableBodyCell>
									<TableBodyCell class="font-semibold">{row.nickname}</TableBodyCell>
									<TableBodyCell class="text-center font-bold text-[#991b1b]">{row.totalPoints}</TableBodyCell>
									<TableBodyCell class="text-center">{row.exactHits}</TableBodyCell>
									<TableBodyCell class="text-center">{row.outcomeHits}</TableBodyCell>
								</TableBodyRow>
							{/each}
						{/if}
					</TableBody>
				</Table>
			</div>
		</Card>
	</div>

	<!-- Groups: Standings + Matches -->
	<div>
		<h2 class="mb-4 text-2xl font-black tracking-tight text-slate-900">Fase de Grupos</h2>
		<div class="grid gap-5 lg:grid-cols-2">
			{#each Object.entries(data.groups) as [group, rows]}
				{@const groupMatches = data.groupMatches.filter((m) => m.groupCode === group)}
				<div class="overflow-hidden rounded-2xl bg-gradient-to-br from-[#7f1d1d] to-[#991b1b] shadow-lg">
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
									<th class="px-2 py-2 text-center">PJ</th>
									<th class="px-2 py-2 text-center">G</th>
									<th class="px-2 py-2 text-center">E</th>
									<th class="px-2 py-2 text-center">P</th>
									<th class="px-2 py-2 text-center">DG</th>
									<th class="px-2 py-2 text-center font-bold">Pts</th>
								</tr>
							</thead>
							<tbody>
								{#each rows as row}
									<tr class="border-b border-white/5">
										<td class="flex items-center gap-2 px-3 py-2">
											{#if getFlagUrl(row.team)}
												<img src={getFlagUrl(row.team, 40)} alt={row.team} class="h-5 w-7 rounded-sm object-cover shadow" />
											{/if}
											<span class="font-medium">{row.team}</span>
										</td>
										<td class="px-2 py-2 text-center">{row.played}</td>
										<td class="px-2 py-2 text-center">{row.wins}</td>
										<td class="px-2 py-2 text-center">{row.draws}</td>
										<td class="px-2 py-2 text-center">{row.losses}</td>
										<td class="px-2 py-2 text-center">{row.goalDiff}</td>
										<td class="px-2 py-2 text-center font-bold">{row.points}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Group matches -->
					<div class="space-y-1 px-3 pb-3">
						{#each groupMatches as match}
							<div class="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2">
								<!-- Team A -->
								<div class="flex items-center gap-2">
									{#if getFlagUrl(match.teamA)}
										<img src={getFlagUrl(match.teamA, 40)} alt={match.teamA} class="h-5 w-7 rounded-sm object-cover shadow" />
									{/if}
									<span class="text-sm font-medium text-white">{match.teamA}</span>
								</div>

								<!-- Score -->
								<div class="flex items-center gap-1">
									<span class="inline-flex h-7 w-7 items-center justify-center rounded bg-white text-sm font-bold text-[#7f1d1d]">
										{match.scoreA ?? '-'}
									</span>
									<span class="text-xs text-white/40">-</span>
									<span class="inline-flex h-7 w-7 items-center justify-center rounded bg-white text-sm font-bold text-[#7f1d1d]">
										{match.scoreB ?? '-'}
									</span>
								</div>

								<!-- Team B -->
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-white">{match.teamB}</span>
									{#if getFlagUrl(match.teamB)}
										<img src={getFlagUrl(match.teamB, 40)} alt={match.teamB} class="h-5 w-7 rounded-sm object-cover shadow" />
									{/if}
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
							<div class="px-3 py-1.5 text-xs text-slate-400">
								{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)}
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
