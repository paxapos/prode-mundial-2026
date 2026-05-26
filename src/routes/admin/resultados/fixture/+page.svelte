<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import type { Match } from '$lib/types';
	import {
		GROUP_CODES,
		KNOCKOUT_STAGES,
		STAGE_LABELS,
		bracketOriginLabel,
		clearResultMessage,
		fixtureStatusClass,
		fixtureStatusLabel,
		formatDate,
		formatTime,
		hasLoadedResult,
		matchNumber,
		sortMatchesByNumber
	} from '$lib/admin/matches';

	let { data } = $props();
	let fixtureListEl = $state<HTMLDivElement | null>(null);
	let lastLoadedFixtureEl = $state<HTMLSpanElement | null>(null);

	const matchStats = $derived({
		total: data.matches.length,
		closed: data.matches.filter((match: Match) => match.isClosed).length,
		pending: data.matches.filter((match: Match) => !match.isClosed).length
	});
	const fixtureMatches = $derived(sortMatchesByNumber(data.matches));
	const lastLoadedMatchId = $derived.by(() => {
		const loaded = fixtureMatches.filter(hasLoadedResult);
		return loaded.length ? loaded[loaded.length - 1].id : null;
	});
	const groupFixtureSections = $derived(
		GROUP_CODES.map((group) => ({
			group,
			matches: fixtureMatches.filter((match: Match) => match.stage === 'groups' && match.groupCode === group)
		})).filter((section) => section.matches.length > 0)
	);
	const knockoutFixtureSections = $derived(
		KNOCKOUT_STAGES.map((stage) => ({
			stage,
			matches: fixtureMatches.filter((match: Match) => match.stage === stage)
		})).filter((section) => section.matches.length > 0)
	);

	$effect(() => {
		if (!lastLoadedMatchId || !fixtureListEl || !lastLoadedFixtureEl) return;

		tick().then(() => {
			if (!fixtureListEl || !lastLoadedFixtureEl) return;
			const containerRect = fixtureListEl.getBoundingClientRect();
			const targetRect = lastLoadedFixtureEl.getBoundingClientRect();
			const nextTop = fixtureListEl.scrollTop + targetRect.top - containerRect.top - fixtureListEl.clientHeight / 2 + targetRect.height / 2;
			fixtureListEl.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
		});
	});

	function confirmClearResult(event: SubmitEvent, match: Match) {
		if (!confirm(clearResultMessage(match))) event.preventDefault();
	}
</script>

<div class="space-y-6">
	<div class="grid grid-cols-3 gap-3">
		<div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
			<p class="text-2xl font-black text-slate-800">{matchStats.total}</p>
			<p class="text-xs text-slate-400">Partidos</p>
		</div>
		<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center shadow-sm">
			<p class="text-2xl font-black text-emerald-700">{matchStats.closed}</p>
			<p class="text-xs text-emerald-600">Cargados</p>
		</div>
		<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center shadow-sm">
			<p class="text-2xl font-black text-amber-700">{matchStats.pending}</p>
			<p class="text-xs text-amber-600">Pendientes</p>
		</div>
	</div>

	<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h2 class="text-lg font-black text-slate-800">Fixture completo</h2>
				<p class="mt-0.5 text-xs text-slate-400">Los 104 partidos: grupos primero y llave hasta final por tercer puesto y final. Horarios en Argentina.</p>
			</div>
			<div class="flex flex-wrap gap-2 text-xs font-bold">
				<span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">{fixtureMatches.length} partidos</span>
				{#if lastLoadedMatchId}
					<span class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">Último cargado: M{matchNumber(fixtureMatches.find((match: Match) => match.id === lastLoadedMatchId)!)}</span>
				{:else}
					<span class="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">Sin resultados cargados</span>
				{/if}
			</div>
		</div>

		<div bind:this={fixtureListEl} class="mt-4 max-h-[34rem] space-y-5 overflow-y-auto scroll-smooth rounded-xl border border-slate-100 bg-slate-50/60 p-3">
			<div class="space-y-4">
				<h3 class="sticky top-0 z-10 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-sky-700 shadow-sm">Fase de grupos</h3>
				{#each groupFixtureSections as section}
					<div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
						<div class="mb-2 flex items-center justify-between gap-2">
							<h4 class="text-sm font-black text-slate-800">Grupo {section.group}</h4>
							<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">{section.matches.length} partidos</span>
						</div>
						<div class="divide-y divide-slate-100">
							{#each section.matches as match}
								{@const origin = bracketOriginLabel(match)}
								{#if lastLoadedMatchId === match.id}<span bind:this={lastLoadedFixtureEl}></span>{/if}
								<div class="grid gap-2 py-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
									<div class="flex items-center gap-2 text-xs font-black text-slate-400">
										<span>M{matchNumber(match)}</span>
										<span class="font-semibold">{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)} hs</span>
									</div>
									<div class="min-w-0 text-sm font-bold text-slate-800">
										<span>{match.teamA}</span>
										<span class="px-1.5 text-xs text-slate-300">vs</span>
										<span>{match.teamB}</span>
										{#if origin}<p class="mt-1 text-xs font-semibold text-violet-600">Origen: {origin}</p>{/if}
									</div>
									<div class="flex flex-wrap items-center gap-2 sm:justify-end">
										{#if hasLoadedResult(match)}
											<span class="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">{match.scoreA} - {match.scoreB}</span>
											<form method="POST" action="?/clearResult" use:enhance onsubmit={(event) => confirmClearResult(event, match)}>
												<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
												<input type="hidden" name="matchId" value={match.id} />
												<button type="submit" class="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black text-red-700 hover:bg-red-100">Eliminar</button>
											</form>
										{/if}
										<span class="rounded-full border px-2 py-0.5 text-[10px] font-bold {fixtureStatusClass(match)}">{fixtureStatusLabel(match)}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div class="space-y-4">
				<h3 class="sticky top-0 z-10 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-violet-700 shadow-sm">Eliminación directa</h3>
				{#each knockoutFixtureSections as section}
					<div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
						<div class="mb-2 flex items-center justify-between gap-2">
							<h4 class="text-sm font-black text-slate-800">{STAGE_LABELS[section.stage]}</h4>
							<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">{section.matches.length} partidos</span>
						</div>
						<div class="divide-y divide-slate-100">
							{#each section.matches as match}
								{@const origin = bracketOriginLabel(match)}
								{#if lastLoadedMatchId === match.id}<span bind:this={lastLoadedFixtureEl}></span>{/if}
								<div class="grid gap-2 py-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
									<div class="flex items-center gap-2 text-xs font-black text-slate-400">
										<span>M{matchNumber(match)}</span>
										<span class="font-semibold">{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)} hs</span>
									</div>
									<div class="min-w-0 text-sm font-bold text-slate-800">
										<span>{match.teamA}</span>
										<span class="px-1.5 text-xs text-slate-300">vs</span>
										<span>{match.teamB}</span>
										{#if origin}<p class="mt-1 text-xs font-semibold text-violet-600">Origen: {origin}</p>{/if}
									</div>
									<div class="flex flex-wrap items-center gap-2 sm:justify-end">
										{#if hasLoadedResult(match)}
											<span class="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">{match.scoreA} - {match.scoreB}</span>
											<form method="POST" action="?/clearResult" use:enhance onsubmit={(event) => confirmClearResult(event, match)}>
												<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
												<input type="hidden" name="matchId" value={match.id} />
												<button type="submit" class="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black text-red-700 hover:bg-red-100">Eliminar</button>
											</form>
										{/if}
										<span class="rounded-full border px-2 py-0.5 text-[10px] font-bold {fixtureStatusClass(match)}">{fixtureStatusLabel(match)}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<details class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<summary class="cursor-pointer px-5 py-4 text-sm font-bold text-slate-500 hover:text-slate-700">➕ Agregar partido manualmente</summary>
		<div class="border-t border-slate-100 p-5">
			<form method="POST" action="?/addMatch" use:enhance class="space-y-4">
				<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
				<div class="grid gap-4 md:grid-cols-3">
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Fase</span>
						<select name="stage" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
							<option value="groups">Grupos</option>
							<option value="round32">16avos</option>
							<option value="round16">Octavos</option>
							<option value="quarterfinal">Cuartos</option>
							<option value="semifinal">Semifinal</option>
							<option value="thirdplace">Final por tercer puesto</option>
							<option value="final">Final</option>
						</select>
					</div>
					<div><span class="mb-1 block text-xs font-bold text-slate-500">Grupo</span><input name="groupCode" placeholder="A" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /></div>
					<div><span class="mb-1 block text-xs font-bold text-slate-500">Fecha y hora</span><input name="kickoffAt" type="datetime-local" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /></div>
					<div><span class="mb-1 block text-xs font-bold text-slate-500">Equipo A</span><input name="teamA" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /></div>
					<div><span class="mb-1 block text-xs font-bold text-slate-500">Equipo B</span><input name="teamB" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /></div>
					<div class="flex items-end"><button type="submit" class="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800">➕ Agregar</button></div>
				</div>
			</form>
		</div>
	</details>
</div>