<script lang="ts">
	import { Alert, Badge, Button, Input, Label, Select } from 'flowbite-svelte';
	import { getFlagUrl } from '$lib/teams';

	let { data, form } = $props();

	const stageNames: Record<string, string> = {
		groups: 'Fase de Grupos',
		round32: 'Ronda de 32',
		round16: 'Octavos de final',
		quarterfinal: 'Cuartos de final',
		semifinal: 'Semifinal',
		final: 'Final'
	};

	const stageOrder = ['groups', 'round32', 'round16', 'quarterfinal', 'semifinal', 'final'];

	function groupMatchesByStage(matches: typeof data.matches) {
		const map: Record<string, typeof data.matches> = {};
		for (const m of matches) {
			(map[m.stage] ??= []).push(m);
		}
		return stageOrder.filter((s) => map[s]).map((s) => [s, map[s]] as const);
	}
</script>

<svelte:head>
	<title>Mi Prode | Prode Mundial 2026</title>
</svelte:head>

<section class="space-y-6">
	<!-- Header -->
	<div class="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e293b] to-[#334155] p-6 text-white shadow-lg">
		<h1 class="text-3xl font-black tracking-tight">Mi Prode</h1>
		<p class="mt-1 text-sm text-white/60">{data.selectedTournament?.name ?? 'Sin torneo'} · Completá tus pronósticos antes del inicio</p>
		{#if data.settings}
			<Badge color={data.settings.state === 'open_predictions' ? 'green' : 'yellow'} class="mt-3">
				{data.settings.state === 'open_predictions' ? 'Pronósticos abiertos' : data.settings.state}
			</Badge>
		{/if}
	</div>

	{#if data.message}
		<Alert color="yellow">{data.message}</Alert>
	{/if}

	{#if form?.message}
		<Alert color="red">{form.message}</Alert>
	{/if}

	<!-- Tournament selector -->
	{#if data.tournaments.length > 1}
		<div class="flex flex-wrap gap-2">
			{#each data.tournaments as tournament}
				<a
					class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors {tournament.alias === data.selectedTournament?.alias ? 'border-[#991b1b] bg-[#991b1b] text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}"
					href={`/prode?t=${tournament.alias}`}
				>
					{tournament.name}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Matches grouped by stage -->
	{#each groupMatchesByStage(data.matches) as [stage, matches]}
		<div>
			<h2 class="mb-3 text-xl font-bold text-slate-900">{stageNames[stage] ?? stage}</h2>
			<div class="grid gap-3 md:grid-cols-2">
				{#each matches as match}
					{@const pred = data.predictions.find((p) => p.matchId === match.id)}
					<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
						<form method="POST" action="?/save">
							<input type="hidden" name="tournamentId" value={data.selectedTournament?.id ?? ''} />
							<input type="hidden" name="matchId" value={match.id} />

							<!-- Match header bar -->
							<div class="flex items-center justify-between bg-slate-50 px-4 py-2">
								<span class="text-xs font-medium text-slate-500">
									{#if match.groupCode}Grupo {match.groupCode} · {/if}{new Date(match.kickoffAt).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
								</span>
								{#if match.isClosed}
									<Badge color="dark" class="text-xs">Cerrado</Badge>
								{/if}
							</div>

							<div class="p-4">
								<!-- Teams and score inputs -->
								<div class="flex items-center justify-between gap-2">
									<!-- Team A -->
									<div class="flex flex-1 items-center gap-2">
										{#if getFlagUrl(match.teamA)}
											<img src={getFlagUrl(match.teamA, 48)} alt={match.teamA} class="h-6 w-8 rounded-sm object-cover shadow" />
										{/if}
										<span class="text-sm font-semibold text-slate-800">{match.teamA}</span>
									</div>

									<!-- Score inputs -->
									<div class="flex items-center gap-1">
										<input
											name="predA"
											type="number"
											min="0"
											required
											value={pred?.predA ?? ''}
											class="h-9 w-12 rounded-lg border border-slate-300 text-center text-sm font-bold focus:border-[#991b1b] focus:ring-[#991b1b]"
										/>
										<span class="text-slate-400">-</span>
										<input
											name="predB"
											type="number"
											min="0"
											required
											value={pred?.predB ?? ''}
											class="h-9 w-12 rounded-lg border border-slate-300 text-center text-sm font-bold focus:border-[#991b1b] focus:ring-[#991b1b]"
										/>
									</div>

									<!-- Team B -->
									<div class="flex flex-1 items-center justify-end gap-2">
										<span class="text-sm font-semibold text-slate-800">{match.teamB}</span>
										{#if getFlagUrl(match.teamB)}
											<img src={getFlagUrl(match.teamB, 48)} alt={match.teamB} class="h-6 w-8 rounded-sm object-cover shadow" />
										{/if}
									</div>
								</div>

								<!-- Real result (if available) -->
								{#if match.scoreA !== null && match.scoreB !== null}
									<p class="mt-2 text-center text-xs text-slate-500">
										Resultado real: <span class="font-bold">{match.scoreA} - {match.scoreB}</span>
										{#if match.penaltyWinner}
											<span class="text-amber-600"> (Pen: {match.penaltyWinner === 'A' ? match.teamA : match.teamB})</span>
										{/if}
									</p>
								{/if}

								<!-- Penalty selector for knockout -->
								{#if stage !== 'groups'}
									<div class="mt-3">
										<label class="mb-1 block text-xs font-medium text-slate-500">Si empatan, ¿quién gana por penales?</label>
										<select
											name="predPenaltyWinner"
											class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#991b1b] focus:ring-[#991b1b]"
										>
											<option value="" selected={!pred?.predPenaltyWinner}>Sin definir</option>
											<option value="A" selected={pred?.predPenaltyWinner === 'A'}>{match.teamA}</option>
											<option value="B" selected={pred?.predPenaltyWinner === 'B'}>{match.teamB}</option>
										</select>
									</div>
								{/if}

								<button
									type="submit"
									class="mt-3 w-full rounded-lg bg-[#991b1b] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7f1d1d]"
								>
									Guardar
								</button>
							</div>
						</form>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</section>
