<script lang="ts">
	import { enhance } from '$app/forms';
	import { flip } from 'svelte/animate';
	import { compareThirdPlaceMetrics, hasUnresolvedGroupBoundaryTie, rankThirdPlacedGroups } from '$lib/bracket-rules';
	import { canonicalTeamName, getFlagUrl, getTeamId } from '$lib/teams';
	import type { Match } from '$lib/types';
	import {
		STAGE_LABELS,
		bracketOriginLabel,
		clearResultMessage,
		formatDate,
		formatTime,
		hasLoadedResult,
		stageOptions,
		venueCity
	} from '$lib/admin/matches';

	let { data } = $props();
	let matchStageFilter = $state<string>('all');
	let matchSearch = $state('');
	let showOnlyPending = $state(true);

	const filteredMatches = $derived(
		data.matches.filter((match: Match) => {
			if (matchStageFilter !== 'all' && match.stage !== matchStageFilter) return false;
			if (showOnlyPending && match.isClosed) return false;
			if (matchSearch) {
				const q = matchSearch.toLowerCase();
				if (!match.teamA.toLowerCase().includes(q) && !match.teamB.toLowerCase().includes(q) && !(match.groupCode ?? '').toLowerCase().includes(q)) return false;
			}
			return true;
		})
	);
	const matchStats = $derived({
		total: data.matches.length,
		closed: data.matches.filter((match: Match) => match.isClosed).length,
		pending: data.matches.filter((match: Match) => !match.isClosed).length
	});
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
	const teamOptions = $derived<string[]>(data.teamOptions ?? []);

	function teamIsValid(team: string) {
		return teamOptions.includes(canonicalTeamName(team));
	}
	function confirmClearResult(event: SubmitEvent, match: Match) {
		if (!confirm(clearResultMessage(match))) event.preventDefault();
	}
</script>

<div class="space-y-6">
	<div class="grid grid-cols-3 gap-3">
		<div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm"><p class="text-2xl font-black text-slate-800">{matchStats.total}</p><p class="text-xs text-slate-400">Partidos</p></div>
		<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center shadow-sm"><p class="text-2xl font-black text-emerald-700">{matchStats.closed}</p><p class="text-xs text-emerald-600">Cargados</p></div>
		<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center shadow-sm"><p class="text-2xl font-black text-amber-700">{matchStats.pending}</p><p class="text-xs text-amber-600">Pendientes</p></div>
	</div>

	<div class="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
		<div class="flex-1">
			<input type="text" placeholder="Buscar equipo..." bind:value={matchSearch} class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
		</div>
		<select bind:value={matchStageFilter} class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
			{#each stageOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
		</select>
		<button onclick={() => (showOnlyPending = !showOnlyPending)} class="rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all {showOnlyPending ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}">
			{showOnlyPending ? '📋 Solo pendientes' : '📋 Todos'}
		</button>
	</div>

	{#if pendingBracketTies.length > 0}
		<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
			<p class="font-bold">La llave se completó parcialmente: faltan desempates manuales.</p>
			<p class="mt-1 text-xs text-amber-700">Asigná puntos de desempate en la subpágina Desempates para estos cruces y los 16avos se sincronizan automáticamente.</p>
			<div class="mt-3 flex flex-wrap gap-2">
				{#each pendingBracketTies as tie}<span class="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">{tie}</span>{/each}
			</div>
		</div>
	{/if}

	{#if filteredMatches.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
			<p class="text-3xl">🎉</p>
			<p class="mt-2 text-sm font-medium text-slate-500">{showOnlyPending ? 'No hay partidos pendientes con estos filtros.' : 'No hay partidos que coincidan.'}</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each filteredMatches as match (match.id)}
				{@const teamAIsValid = teamIsValid(match.teamA)}
				{@const teamBIsValid = teamIsValid(match.teamB)}
				{@const origin = bracketOriginLabel(match)}
				<div animate:flip={{ duration: 180 }} class="overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md {match.isClosed ? 'border-emerald-200' : 'border-slate-200'}">
					<div class="flex items-center justify-between px-4 py-2 {match.isClosed ? 'bg-emerald-50' : 'bg-slate-50'}">
						<div class="flex items-center gap-2">
							<span class="inline-flex h-6 items-center rounded-md px-2 text-[10px] font-bold uppercase tracking-wider {match.stage === 'groups' ? 'bg-sky-100 text-sky-700' : match.stage === 'thirdplace' ? 'bg-orange-100 text-orange-700' : match.stage === 'final' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}">
								{STAGE_LABELS[match.stage] ?? match.stage}{#if match.groupCode} {match.groupCode}{/if}
							</span>
							<span class="text-xs text-slate-400">{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)} hs</span>
							{#if match.venue}<span class="hidden text-xs text-slate-400 sm:inline">· {venueCity(match.venue)}</span>{/if}
						</div>
						{#if match.isClosed}<span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Cargado</span>{/if}
					</div>

					<div class="p-4">
						<div class="grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_3.75rem_3.75rem_minmax(0,1fr)] sm:gap-3">
							<div class="flex min-w-0 items-center justify-end gap-2">
								<span class="truncate text-right text-sm font-bold text-slate-800">{match.teamA}</span>
								{#if getFlagUrl(match.teamA)}<img src={getFlagUrl(match.teamA, 48)} alt={match.teamA} class="h-7 w-10 shrink-0 rounded object-cover shadow-sm" />{/if}
							</div>
							<span class="inline-flex h-9 w-full items-center justify-center rounded-lg {match.scoreA !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-300'} text-base font-black">{match.scoreA ?? '-'}</span>
							<span class="inline-flex h-9 w-full items-center justify-center rounded-lg {match.scoreB !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-300'} text-base font-black">{match.scoreB ?? '-'}</span>
							<div class="flex min-w-0 items-center gap-2">
								{#if getFlagUrl(match.teamB)}<img src={getFlagUrl(match.teamB, 48)} alt={match.teamB} class="h-7 w-10 shrink-0 rounded object-cover shadow-sm" />{/if}
								<span class="truncate text-sm font-bold text-slate-800">{match.teamB}</span>
							</div>
						</div>

						{#if origin}<p class="mt-3 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-center text-xs font-bold text-violet-700">Origen del cruce: {origin}</p>{/if}
						{#if match.penaltyWinner}<p class="mt-2 text-center text-xs font-semibold text-amber-600">⚡ Penales: gana {match.penaltyWinner === 'A' ? match.teamA : match.teamB}</p>{/if}

						<details class="mt-3 rounded-xl border border-slate-200 transition-colors duration-200 focus-within:border-sky-200 focus-within:bg-sky-50/40" open={!match.isClosed}>
							<summary class="cursor-pointer px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:text-slate-700">{match.isClosed ? 'Editar resultado' : 'Cargar resultado'}</summary>
							<div class="border-t border-slate-100 p-3">
								<form method="POST" action="?/saveResult" use:enhance class="space-y-3">
									<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
									<input type="hidden" name="matchId" value={match.id} />
									<div class="grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_3.75rem_3.75rem_minmax(0,1fr)] sm:gap-3">
										<label for={`score-a-${match.id}`} class="min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-right transition-colors duration-200 hover:border-sky-200 hover:bg-sky-50/50 sm:px-3">
											<span class="block text-[10px] font-bold uppercase text-slate-400">Equipo A</span>
											<span class="mt-1 flex min-w-0 items-center justify-end gap-2">
												<span class="truncate text-sm font-bold text-slate-800">{match.teamA}</span>
												{#if getFlagUrl(match.teamA)}<img src={getFlagUrl(match.teamA, 48)} alt={match.teamA} class="h-6 w-9 shrink-0 rounded object-cover shadow-sm" />{/if}
											</span>
										</label>
										<input id={`score-a-${match.id}`} name="scoreA" type="number" min="0" inputmode="numeric" required value={match.scoreA ?? ''} aria-label={`Goles de ${match.teamA}`} class="h-14 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-center text-xl font-black text-slate-900 shadow-inner shadow-slate-200/40 transition-all duration-200 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-400/20" />
										<input id={`score-b-${match.id}`} name="scoreB" type="number" min="0" inputmode="numeric" required value={match.scoreB ?? ''} aria-label={`Goles de ${match.teamB}`} class="h-14 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-center text-xl font-black text-slate-900 shadow-inner shadow-slate-200/40 transition-all duration-200 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-400/20" />
										<label for={`score-b-${match.id}`} class="min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 transition-colors duration-200 hover:border-sky-200 hover:bg-sky-50/50 sm:px-3">
											<span class="block text-[10px] font-bold uppercase text-slate-400">Equipo B</span>
											<span class="mt-1 flex min-w-0 items-center gap-2">
												{#if getFlagUrl(match.teamB)}<img src={getFlagUrl(match.teamB, 48)} alt={match.teamB} class="h-6 w-9 shrink-0 rounded object-cover shadow-sm" />{/if}
												<span class="truncate text-sm font-bold text-slate-800">{match.teamB}</span>
											</span>
										</label>
									</div>
									{#if match.stage !== 'groups'}
										<div>
											<span class="mb-1 block text-xs font-medium text-slate-500">Penales (si empatan)</span>
											<select name="penaltyWinner" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all duration-200 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-400/20">
												<option value="" selected={!match.penaltyWinner}>Sin penales</option>
												<option value="A" selected={match.penaltyWinner === 'A'}>{match.teamA}</option>
												<option value="B" selected={match.penaltyWinner === 'B'}>{match.teamB}</option>
											</select>
										</div>
									{/if}
									<button type="submit" class="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-slate-900/20">Guardar y seguir</button>
								</form>
								{#if hasLoadedResult(match)}
									<form method="POST" action="?/clearResult" use:enhance onsubmit={(event) => confirmClearResult(event, match)} class="mt-2">
										<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
										<input type="hidden" name="matchId" value={match.id} />
										<button type="submit" class="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition-all duration-200 hover:border-red-300 hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-400/20">Eliminar resultado</button>
									</form>
								{/if}
							</div>
						</details>

						{#if match.stage !== 'groups'}
							<details class="mt-2 rounded-lg border border-slate-200">
								<summary class="cursor-pointer px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600">🔄 Editar equipos (llave)</summary>
								<div class="border-t border-slate-100 p-3">
									{#if hasLoadedResult(match)}<p class="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Cambiar equipos borra este resultado y los cruces siguientes para recalcular la llave.</p>{/if}
									<form method="POST" action="?/updateMatch" use:enhance class="flex flex-wrap items-end gap-2">
										<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
										<input type="hidden" name="matchId" value={match.id} />
										<div class="flex-1"><span class="mb-1 block text-[10px] font-medium text-slate-400">Equipo A</span><select name="teamA" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{#if !teamAIsValid}<option value="" selected>Seleccionar equipo...</option>{/if}{#each teamOptions as team}<option value={getTeamId(team)} selected={getTeamId(team) === getTeamId(match.teamA)}>{team}</option>{/each}</select></div>
										<div class="flex-1"><span class="mb-1 block text-[10px] font-medium text-slate-400">Equipo B</span><select name="teamB" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{#if !teamBIsValid}<option value="" selected>Seleccionar equipo...</option>{/if}{#each teamOptions as team}<option value={getTeamId(team)} selected={getTeamId(team) === getTeamId(match.teamB)}>{team}</option>{/each}</select></div>
										<button type="submit" class="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300">Actualizar</button>
									</form>
								</div>
							</details>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>