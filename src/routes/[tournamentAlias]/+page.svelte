<script lang="ts">
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

<section class="space-y-8">
	<div>
		<h1 class="text-4xl font-black tracking-tight text-slate-900">{data.tournament.name}</h1>
		<p class="mt-1 text-base text-slate-500">Tabla de participantes para este torneo.</p>
	</div>

	<div class="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
					<th class="px-6 py-4 font-semibold">#</th>
					<th class="px-6 py-4 font-semibold">Jugador</th>
					<th class="px-6 py-4 text-center font-semibold">Puntos</th>
					<th class="px-6 py-4 text-center font-semibold">R. Exactos</th>
					<th class="px-6 py-4 text-center font-semibold">Resultados</th>
					<th class="px-6 py-4 text-center font-semibold">Bracket</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.leaderboard.length === 0}
					<tr>
						<td colspan={6} class="px-6 py-8 text-center text-slate-400">No hay participantes asignados.</td>
					</tr>
				{:else}
					{#each data.leaderboard as row, index}
						<tr class="transition-colors hover:bg-slate-50/70">
							<td class="px-6 py-4">
								{#if index === 0}
									<span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-sm font-black text-white shadow-sm">1</span>
								{:else if index === 1}
									<span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-sm font-black text-white shadow-sm">2</span>
								{:else if index === 2}
									<span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-sm font-black text-white shadow-sm">3</span>
								{:else}
									<span class="inline-flex h-8 w-8 items-center justify-center text-sm font-semibold text-slate-400">{index + 1}</span>
								{/if}
							</td>
							<td class="px-6 py-4 text-base font-semibold">
								<a href="/{data.tournament.alias}/prode/{row.nickname}" class="text-blue-600 hover:text-blue-800 hover:underline">{row.nickname}</a>
							</td>
							<td class="px-6 py-4 text-center">
								<span class="inline-flex min-w-[2.5rem] items-center justify-center rounded-xl bg-emerald-50 px-3 py-1 text-base font-black text-emerald-700">{row.totalPoints}</span>
							</td>
							<td class="px-6 py-4 text-center text-sm text-slate-600">{row.exactHits}</td>
							<td class="px-6 py-4 text-center text-sm text-slate-600">{row.outcomeHits}</td>
							<td class="px-6 py-4 text-center text-sm text-slate-600">{row.bracketPoints}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Scoring config info -->
	{#if data.tournament.scoringConfig}
		<div class="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
			<h2 class="mb-5 text-xl font-black text-slate-800">Reglas de puntuación</h2>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
							<th class="pb-3 pr-4 text-left font-semibold">Fase</th>
							<th class="pb-3 px-4 text-center font-semibold">Resultado</th>
							<th class="pb-3 px-4 text-center font-semibold">R. Exacto</th>
							<th class="pb-3 px-4 text-center font-semibold">Eq. en llave</th>
							<th class="pb-3 pl-4 text-center font-semibold">Eq. lado incorrecto</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each STAGES as stage}
							{@const sc = data.tournament.scoringConfig.stages[stage]}
							{#if sc}
								<tr class="transition-colors hover:bg-slate-50/70">
									<td class="py-3 pr-4 text-sm font-bold text-slate-700">{STAGE_LABELS[stage]}</td>
									<td class="py-3 px-4 text-center text-base font-semibold text-blue-600">{sc.outcome}</td>
									<td class="py-3 px-4 text-center text-base font-semibold text-emerald-600">{sc.exact}</td>
									<td class="py-3 px-4 text-center text-base font-semibold text-violet-600">{sc.bracketTeam}</td>
									<td class="py-3 pl-4 text-center text-base font-semibold text-orange-600">{sc.bracketTeamWrongSide}</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
			{#if data.tournament.scoringConfig.bonusChampion || data.tournament.scoringConfig.bonusRunnerUp || data.tournament.scoringConfig.bonusThird}
				<div class="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
					<span class="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-700">🥇 Campeón: +{data.tournament.scoringConfig.bonusChampion} pts</span>
					<span class="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-600">🥈 Sub: +{data.tournament.scoringConfig.bonusRunnerUp} pts</span>
					<span class="rounded-full bg-orange-100 px-4 py-1.5 text-sm font-bold text-orange-700">🥉 3ro: +{data.tournament.scoringConfig.bonusThird} pts</span>
				</div>
			{/if}
		</div>
	{/if}
</section>
