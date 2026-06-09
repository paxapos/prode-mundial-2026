<script lang="ts">
	import { enhance } from '$app/forms';
	import { SCORING_STAGES, STAGE_LABELS, defaultScoringConfig } from '$lib/scoring-config';
	import type { MatchStage, ScoringConfig } from '$lib/types';

	let { data } = $props();
	let scoringConfig: ScoringConfig = $state(defaultScoringConfig());
	$effect(() => {
		scoringConfig = data.rules ? structuredClone(data.rules) : defaultScoringConfig();
	});
	const STAGES: readonly MatchStage[] = SCORING_STAGES;
</script>

<div class="space-y-6">
	<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<h2 class="mb-1 text-lg font-black text-slate-800">Reglas de puntuación por fase</h2>
		<p class="mb-4 text-xs text-slate-400">Torneo: {data.selectedTournament?.name ?? '—'}</p>

		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead><tr class="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400"><th class="py-2 text-left">Fase</th><th class="py-2 text-center">Resultado</th><th class="py-2 text-center">R. Exacto</th><th class="py-2 text-center">Equipo que avanza</th></tr></thead>
				<tbody class="divide-y divide-slate-100">
					{#each STAGES as stage}
						<tr class="hover:bg-slate-50/50"><td class="py-2 text-xs font-bold text-slate-700">{STAGE_LABELS[stage]}</td><td class="py-2 text-center"><input type="number" min="0" bind:value={scoringConfig.stages[stage].outcome} class="w-14 rounded border border-slate-200 bg-slate-50 px-1 py-1 text-center text-sm font-bold focus:border-sky-400" /></td><td class="py-2 text-center"><input type="number" min="0" bind:value={scoringConfig.stages[stage].exact} class="w-14 rounded border border-slate-200 bg-slate-50 px-1 py-1 text-center text-sm font-bold focus:border-sky-400" /></td><td class="py-2 text-center"><input type="number" min="0" bind:value={scoringConfig.stages[stage].bracketTeam} class="w-14 rounded border border-slate-200 bg-slate-50 px-1 py-1 text-center text-sm font-bold focus:border-sky-400" disabled={stage === 'groups'} /></td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		<form method="POST" action="?/updateRules" use:enhance class="mt-4">
			<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
			<input type="hidden" name="scoringConfigJson" value={JSON.stringify(scoringConfig)} />
			<button type="submit" class="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-700">💾 Guardar configuración de puntuación</button>
		</form>
	</div>

	<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<h2 class="mb-1 text-lg font-black text-slate-800">Bloqueo de la competición</h2>
		<p class="mb-4 text-xs text-slate-400">Bloqueá o desbloqueá los pronósticos manualmente. Los partidos ya comenzados nunca admiten cambios.</p>
		{#if data.settings?.state === 'locked'}
			<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3"><p class="text-xs font-bold text-red-700">🔒 Competición actualmente bloqueada</p>{#if data.settings.lockReason}<p class="mt-1 text-xs text-red-600">Motivo: {data.settings.lockReason}</p>{/if}</div>
			<form method="POST" action="?/unlock" use:enhance class="mb-4">
				<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
				<button type="submit" class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">🔓 Desbloquear pronósticos</button>
			</form>
		{/if}
		{#if data.settings?.state !== 'locked'}
			<form method="POST" action="?/lock" use:enhance class="space-y-3">
				<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
				<div><span class="mb-1 block text-xs font-bold text-slate-500">Motivo del bloqueo</span><input name="reason" placeholder="Comenzó el Mundial" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20" /></div>
				<button type="submit" class="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700">🔒 Bloquear pronósticos</button>
			</form>
		{/if}
	</div>
</div>