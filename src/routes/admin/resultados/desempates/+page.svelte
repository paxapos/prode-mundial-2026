<script lang="ts">
	import { enhance } from '$app/forms';
	import { compareThirdPlaceMetrics, hasUnresolvedGroupBoundaryTie, rankThirdPlacedGroups } from '$lib/bracket-rules';
	import { getFlagUrl } from '$lib/teams';
	import type { Match } from '$lib/types';

	let { data } = $props();

	const groupStageComplete = $derived(
		data.matches.filter((match: Match) => match.stage === 'groups').every((match: Match) => match.scoreA !== null && match.scoreB !== null)
	);
	const pendingBracketTies = $derived.by(() => {
		if (!groupStageComplete) return [];

		const ties: string[] = [];
		for (const [group, rows] of Object.entries(data.groupStandings)) {
			if (rows.length < 4) continue;
			const groupMatches = data.matches.filter((match: Match) => match.stage === 'groups' && match.groupCode === group);
			const labels = ['1°/2°', '2°/3°', '3°/4°'];
			for (let index = 0; index < labels.length; index += 1) {
				if (!hasUnresolvedGroupBoundaryTie(rows, groupMatches, index)) continue;
				ties.push(`Grupo ${group}: ${rows[index].team} / ${rows[index + 1].team} (${labels[index]})`);
			}
		}

		const thirds = rankThirdPlacedGroups(data.groupStandings);
		if (thirds.length >= 12 && compareThirdPlaceMetrics(thirds[7].row, thirds[8].row) === 0) {
			ties.push(`Mejores terceros: grupo ${thirds[7].group} / grupo ${thirds[8].group}`);
		}

		return ties;
	});
</script>

<div class="space-y-6">
	{#if pendingBracketTies.length > 0}
		<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
			<p class="font-bold">Faltan desempates manuales para completar la llave.</p>
			<div class="mt-3 flex flex-wrap gap-2">
				{#each pendingBracketTies as tie}<span class="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">{tie}</span>{/each}
			</div>
		</div>
	{/if}

	{#if Object.keys(data.groupStandings).length > 0}
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="mb-1 text-lg font-black text-slate-800">⚖️ Desempate manual por grupo</h2>
			<p class="mb-4 text-xs text-slate-400">Asigná puntos de desempate para conducta del equipo y ranking FIFA/Coca-Cola cuando sigan empatados los criterios deportivos.</p>

			<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{#each Object.entries(data.groupStandings).sort(([a], [b]) => a.localeCompare(b)) as [group, rows]}
					<div class="rounded-lg border border-slate-100 bg-slate-50 p-3">
						<h3 class="mb-2 text-sm font-black text-slate-700">Grupo {group}</h3>
						<div class="space-y-2">
							{#each rows as row}
								{@const existing = data.groupAdjustments.find((adjustment) => adjustment.groupCode === group && adjustment.team === row.team)}
								<form method="POST" action="?/saveTiebreaker" use:enhance class="flex items-center gap-2">
									<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
									<input type="hidden" name="groupCode" value={group} />
									<input type="hidden" name="team" value={row.team} />
									<div class="flex min-w-0 flex-1 items-center gap-1.5">
										{#if getFlagUrl(row.team)}<img src={getFlagUrl(row.team, 24)} alt={row.team} class="h-4 w-6 shrink-0 rounded object-cover" />{/if}
										<span class="truncate text-xs font-semibold text-slate-700">{row.team}</span>
										<span class="text-[10px] text-slate-400">({row.points}pts {row.goalDiff > 0 ? '+' : ''}{row.goalDiff}dg)</span>
									</div>
									<input name="tiebreakerPoints" type="number" step="1" value={existing?.tiebreakerPoints ?? 0} class="w-16 rounded border border-slate-200 bg-white px-1.5 py-1 text-center text-xs font-bold focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20" />
									<input name="reason" type="text" placeholder="Fair play/ranking" value={existing?.reason ?? ''} class="w-24 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20" />
									<button type="submit" class="shrink-0 rounded bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-300">💾</button>
								</form>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
			<p class="text-3xl">⚖️</p>
			<p class="mt-2 text-sm font-medium text-slate-500">Todavía no hay tablas de grupos para desempatar.</p>
		</div>
	{/if}
</div>