<script lang="ts">
	import { Card, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell } from 'flowbite-svelte';
	import { STAGE_LABELS } from '$lib/scoring-config';
	import type { MatchStage } from '$lib/types';
	let { data } = $props();

	const STAGES: MatchStage[] = ['groups', 'round32', 'round16', 'quarterfinal', 'semifinal', 'final'];
</script>

<svelte:head>
	<title>{data.tournament.name} | Tabla</title>
	<meta property="og:title" content="{data.tournament.name} | Tabla de posiciones" />
	<meta property="og:description" content="Mirá la tabla de posiciones del prode {data.tournament.name}." />
	<meta property="og:image" content="/mundial_2026.png" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="{data.tournament.name} | Tabla de posiciones" />
	<meta name="twitter:description" content="Mirá la tabla de posiciones del prode {data.tournament.name}." />
	<meta name="twitter:image" content="/mundial_2026.png" />
</svelte:head>

<section class="space-y-6">
	<Card>
		<h1 class="text-3xl font-black tracking-tight">{data.tournament.name}</h1>
		<p class="text-sm text-slate-600">Tabla de participantes para este torneo.</p>
	</Card>

	<Card>
		<div class="overflow-x-auto">
			<Table hoverable>
				<TableHead>
					<TableHeadCell>#</TableHeadCell>
					<TableHeadCell>Jugador</TableHeadCell>
					<TableHeadCell>Puntos</TableHeadCell>
					<TableHeadCell>R. Exactos</TableHeadCell>
					<TableHeadCell>Resultados</TableHeadCell>
					<TableHeadCell>Bracket</TableHeadCell>
				</TableHead>
				<TableBody class="divide-y">
					{#if data.leaderboard.length === 0}
						<TableBodyRow>
							<TableBodyCell colspan={6}>No hay participantes asignados.</TableBodyCell>
						</TableBodyRow>
					{:else}
						{#each data.leaderboard as row, index}
							<TableBodyRow>
								<TableBodyCell>
									{#if index === 0}
										<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-white">1</span>
									{:else if index === 1}
										<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-400 text-xs font-black text-white">2</span>
									{:else if index === 2}
										<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-700 text-xs font-black text-white">3</span>
									{:else}
										<span class="text-sm font-semibold text-slate-400">{index + 1}</span>
									{/if}
								</TableBodyCell>
								<TableBodyCell class="font-semibold">
									<a href="/{data.tournament.alias}/prode/{row.nickname}" class="text-blue-600 hover:underline">{row.nickname}</a>
								</TableBodyCell>
								<TableBodyCell>
									<span class="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-emerald-100 px-2 py-0.5 text-sm font-black text-emerald-700">{row.totalPoints}</span>
								</TableBodyCell>
								<TableBodyCell>{row.exactHits}</TableBodyCell>
								<TableBodyCell>{row.outcomeHits}</TableBodyCell>
								<TableBodyCell>{row.bracketPoints}</TableBodyCell>
							</TableBodyRow>
						{/each}
					{/if}
				</TableBody>
			</Table>
		</div>
	</Card>

	<!-- Scoring config info -->
	{#if data.tournament.scoringConfig}
		<Card>
			<h2 class="mb-3 text-lg font-black text-slate-800">Reglas de puntuación</h2>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400">
							<th class="py-2 text-left">Fase</th>
							<th class="py-2 text-center">Resultado</th>
							<th class="py-2 text-center">R. Exacto</th>
							<th class="py-2 text-center">Eq. en llave</th>
							<th class="py-2 text-center">Eq. lado incorrecto</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each STAGES as stage}
							{@const sc = data.tournament.scoringConfig.stages[stage]}
							{#if sc}
								<tr>
									<td class="py-2 text-xs font-bold text-slate-700">{STAGE_LABELS[stage]}</td>
									<td class="py-2 text-center font-semibold text-blue-600">{sc.outcome}</td>
									<td class="py-2 text-center font-semibold text-emerald-600">{sc.exact}</td>
									<td class="py-2 text-center font-semibold text-violet-600">{sc.bracketTeam}</td>
									<td class="py-2 text-center font-semibold text-orange-600">{sc.bracketTeamWrongSide}</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
			{#if data.tournament.scoringConfig.bonusChampion || data.tournament.scoringConfig.bonusRunnerUp || data.tournament.scoringConfig.bonusThird}
				<div class="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs">
					<span class="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-700">🥇 Campeón: +{data.tournament.scoringConfig.bonusChampion} pts</span>
					<span class="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">🥈 Sub: +{data.tournament.scoringConfig.bonusRunnerUp} pts</span>
					<span class="rounded-full bg-orange-100 px-3 py-1 font-bold text-orange-700">🥉 3ro: +{data.tournament.scoringConfig.bonusThird} pts</span>
				</div>
			{/if}
		</Card>
	{/if}
</section>
