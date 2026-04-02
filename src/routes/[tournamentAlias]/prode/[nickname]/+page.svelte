<script lang="ts">
	import { deserialize } from '$app/forms';
	import { page } from '$app/stores';
	import { Badge } from 'flowbite-svelte';
	import { getFlagUrl, GROUPS, VENUES } from '$lib/teams';
	import { calcStandings, buildBracket, type LivePred } from '$lib/bracket-engine';
	import { STAGE_LABELS } from '$lib/scoring-config';
	import type { Match, SideWinner } from '$lib/types';

	let { data } = $props();

	/* ─── State ─────────────────────────────────────────── */
	let activeTab = $state<string>('groups');
	let saveStatus: Record<string, 'idle' | 'saving' | 'saved' | 'error'> = $state({});
	let shareMsg = $state('');

	/* ─── Points summary ────────────────────────────────── */
	const myTotalPoints = $derived(
		(data.matchDetails ?? []).reduce((sum: number, d: { totalPoints: number }) => sum + d.totalPoints, 0)
	);
	const matchPointsMap = $derived<Record<string, { outcomePoints: number; exactPoints: number; bracketPoints: number; totalPoints: number; reason: string }>>(
		Object.fromEntries(
			(data.matchDetails ?? []).map((d: { matchId: string; outcomePoints: number; exactPoints: number; bracketPoints: number; totalPoints: number; reason: string }) => [
				d.matchId,
				{ outcomePoints: d.outcomePoints, exactPoints: d.exactPoints, bracketPoints: d.bracketPoints, totalPoints: d.totalPoints, reason: d.reason }
			])
		)
	);

	// Predictions keyed by matchId
	let preds: Record<string, LivePred> = $state(
		Object.fromEntries(
			data.predictions.map((p: { matchId: string; predA: number; predB: number; predPenaltyWinner: SideWinner }) => [
				p.matchId,
				{ predA: p.predA, predB: p.predB, predPenaltyWinner: p.predPenaltyWinner }
			])
		)
	);

	/* ─── Derived ───────────────────────────────────────── */
	const groupMatches = $derived(data.matches.filter((m: Match) => m.stage === 'groups'));
	const standings = $derived(calcStandings(groupMatches, preds));
	const bracket = $derived(buildBracket(data.matches, preds));

	const completedCount = $derived(
		Object.values(preds).filter((p) => p.predA !== null && p.predB !== null).length
	);
	const totalMatches = $derived(data.matches.length);
	const pct = $derived(totalMatches > 0 ? Math.round((completedCount / totalMatches) * 100) : 0);

	function stageCount(stage: string) {
		const all = data.matches.filter((m: Match) => m.stage === stage);
		const done = all.filter((m: Match) => {
			const p = preds[m.id];
			return p && p.predA !== null && p.predB !== null;
		}).length;
		return { done, total: all.length };
	}

	/* ─── Tabs ──────────────────────────────────────────── */
	const tabs = [
		{ id: 'groups', label: 'Grupos', icon: '⚽' },
		{ id: 'round32', label: '32avos', icon: '🏟️' },
		{ id: 'round16', label: 'Octavos', icon: '🔥' },
		{ id: 'quarterfinal', label: 'Cuartos', icon: '⚡' },
		{ id: 'semifinal', label: 'Semis', icon: '🏆' },
		{ id: 'final', label: 'Final', icon: '👑' }
	];

	/* ─── Group colors ──────────────────────────────────── */
	const GC: Record<string, { bg: string; border: string; text: string }> = {
		A: { bg: 'bg-rose-600', border: 'border-rose-400', text: 'text-rose-600' },
		B: { bg: 'bg-sky-600', border: 'border-sky-400', text: 'text-sky-600' },
		C: { bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-emerald-600' },
		D: { bg: 'bg-violet-600', border: 'border-violet-400', text: 'text-violet-600' },
		E: { bg: 'bg-amber-600', border: 'border-amber-400', text: 'text-amber-600' },
		F: { bg: 'bg-cyan-600', border: 'border-cyan-400', text: 'text-cyan-600' },
		G: { bg: 'bg-fuchsia-600', border: 'border-fuchsia-400', text: 'text-fuchsia-600' },
		H: { bg: 'bg-teal-600', border: 'border-teal-400', text: 'text-teal-600' },
		I: { bg: 'bg-indigo-600', border: 'border-indigo-400', text: 'text-indigo-600' },
		J: { bg: 'bg-blue-600', border: 'border-blue-400', text: 'text-blue-600' },
		K: { bg: 'bg-orange-600', border: 'border-orange-400', text: 'text-orange-600' },
		L: { bg: 'bg-slate-600', border: 'border-slate-400', text: 'text-slate-600' }
	};

	/* ─── Helpers ────────────────────────────────────────── */
	function formatDateShort(iso: string) {
		return new Date(iso).toLocaleDateString('es-AR', {
			day: 'numeric',
			month: 'short',
			timeZone: 'America/Argentina/Buenos_Aires'
		});
	}
	function formatTime(iso: string) {
		return new Date(iso).toLocaleTimeString('es-AR', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'America/Argentina/Buenos_Aires'
		});
	}
	function venueCity(v: string | null) {
		if (!v) return '';
		return VENUES[v]?.city ?? v;
	}

	function getPred(matchId: string): LivePred {
		return preds[matchId] ?? { predA: null, predB: null, predPenaltyWinner: null };
	}

	function updateScore(matchId: string, field: 'predA' | 'predB', value: string) {
		if (!data.canEdit) return;
		const num = value === '' ? null : parseInt(value, 10);
		if (num !== null && (isNaN(num) || num < 0)) return;
		const current = preds[matchId] ?? { predA: null, predB: null, predPenaltyWinner: null };
		preds[matchId] = { ...current, [field]: num };
	}

	function updatePenalty(matchId: string, value: string) {
		if (!data.canEdit) return;
		const current = preds[matchId] ?? { predA: null, predB: null, predPenaltyWinner: null };
		preds[matchId] = {
			...current,
			predPenaltyWinner: value === 'A' || value === 'B' ? value : null
		};
	}

	/* ─── Auto-save ─────────────────────────────────────── */
	async function autoSave(matchId: string) {
		if (!data.canEdit) return;
		const pred = preds[matchId];
		if (!pred || pred.predA === null || pred.predB === null) return;

		saveStatus[matchId] = 'saving';

		const fd = new FormData();
		fd.set('matchId', matchId);
		fd.set('predA', String(pred.predA));
		fd.set('predB', String(pred.predB));
		fd.set('predPenaltyWinner', pred.predPenaltyWinner ?? '');

		try {
			const res = await fetch('?/save', { method: 'POST', body: fd });
			const result = deserialize(await res.text());
			saveStatus[matchId] = result.type === 'failure' ? 'error' : 'saved';
		} catch {
			saveStatus[matchId] = 'error';
		}

		setTimeout(() => {
			saveStatus[matchId] = 'idle';
		}, 2500);
	}

	function handleBlur(matchId: string) {
		if (!data.canEdit) return;
		const pred = preds[matchId];
		if (pred && pred.predA !== null && pred.predB !== null) autoSave(matchId);
	}

	function needsPenalty(matchId: string, stage: string): boolean {
		if (stage === 'groups') return false;
		const p = preds[matchId];
		return !!p && p.predA !== null && p.predB !== null && p.predA === p.predB;
	}

	/* ─── Knockout match list for a given stage ─────────── */
	function knockoutMatches(stage: string) {
		return data.matches
			.filter((m: Match) => m.stage === stage)
			.sort((a: Match, b: Match) => a.kickoffAt.localeCompare(b.kickoffAt));
	}

	/* ─── Share ──────────────────────────────────────────── */
	async function shareProde() {
		const url = $page.url.href;
		const text = `Mirá el prode de ${data.profileUser.nickname} en ${data.tournament.name}`;
		if (navigator.share) {
			try {
				await navigator.share({ title: `Prode de ${data.profileUser.nickname}`, text, url });
			} catch { /* user cancelled */ }
		} else if (navigator.clipboard) {
			await navigator.clipboard.writeText(url);
			shareMsg = 'Link copiado!';
			setTimeout(() => { shareMsg = ''; }, 2500);
		}
	}

	const pageTitle = $derived(`Prode de ${data.profileUser.nickname} | ${data.tournament.name}`);
	const pageDescription = $derived(`Mirá los pronósticos de ${data.profileUser.nickname} para el ${data.tournament.name}. Prode Mundial 2026.`);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:image" content="/mundial_2026.png" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
	<meta name="twitter:image" content="/mundial_2026.png" />
</svelte:head>

<section class="space-y-6">
	<!-- ═══ HEADER ═══ -->
	<div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
		<div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/10 blur-2xl"></div>
		<div class="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl"></div>

		<div class="relative flex items-center gap-4">
			<img src="/copacup.svg" alt="Copa" class="h-14 w-14 drop-shadow-lg" />
			<div class="flex-1">
				<h1 class="text-3xl font-black tracking-tight">
					{#if data.isOwner}Mi Prode{:else}Prode de {data.profileUser.nickname}{/if}
				</h1>
				<p class="text-sm text-white/60">
					{data.tournament.name} · {completedCount}/{totalMatches} pronósticos
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if !data.canEdit}
					<Badge color="purple">Solo lectura</Badge>
				{/if}
				{#if data.settings}
					<Badge color={data.settings.state === 'open_predictions' ? 'green' : 'yellow'}>
						{data.settings.state === 'open_predictions' ? 'Abierto' : data.settings.state}
					</Badge>
				{/if}
			</div>
		</div>

		<!-- Progress bar -->
		<div class="relative mt-5">
			<div class="flex items-center justify-between text-xs text-white/50">
				<span>{completedCount} / {totalMatches} pronósticos</span>
				<span class="font-bold text-amber-400">{pct}%</span>
			</div>
			<div class="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
				<div
					class="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-700 ease-out"
					style="width: {pct}%"
				></div>
			</div>
		</div>

		<!-- Share button -->
		<div class="mt-4 flex items-center gap-3">
			<button
				onclick={shareProde}
				class="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
			>
				📤 Compartir prode
			</button>
			<a
				href="/{data.tournament.alias}"
				class="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
			>
				📊 Ver tabla
			</a>
			{#if shareMsg}
				<span class="text-xs font-bold text-emerald-400">{shareMsg}</span>
			{/if}
		</div>
	</div>

	<!-- ═══ POINTS SUMMARY ═══ -->
	{#if data.matchDetails && data.matchDetails.length > 0}
		{@const outcomeTotal = data.matchDetails.reduce((s: number, d: { outcomePoints: number }) => s + d.outcomePoints, 0)}
		{@const exactTotal = data.matchDetails.reduce((s: number, d: { exactPoints: number }) => s + d.exactPoints, 0)}
		{@const bracketTotal = data.matchDetails.reduce((s: number, d: { bracketPoints: number }) => s + d.bracketPoints, 0)}
		<div class="flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-4 shadow-sm">
			<div class="flex items-center gap-3">
				<div class="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500 text-2xl font-black text-white shadow-md">
					{myTotalPoints}
				</div>
				<div>
					<p class="text-sm font-bold text-slate-700">{data.isOwner ? 'Mis puntos' : 'Puntos'}</p>
					<p class="text-xs text-slate-500">Partidos con resultado: {data.matchDetails.length}</p>
				</div>
			</div>
			<div class="flex flex-1 flex-wrap justify-end gap-3 text-xs">
				{#if outcomeTotal > 0}
					<div class="rounded-lg bg-white/80 px-3 py-1.5 shadow-sm">
						<span class="font-bold text-blue-600">{outcomeTotal}</span>
						<span class="text-slate-500"> resultado</span>
					</div>
				{/if}
				{#if exactTotal > 0}
					<div class="rounded-lg bg-white/80 px-3 py-1.5 shadow-sm">
						<span class="font-bold text-emerald-600">{exactTotal}</span>
						<span class="text-slate-500"> r. exactos</span>
					</div>
				{/if}
				{#if bracketTotal > 0}
					<div class="rounded-lg bg-white/80 px-3 py-1.5 shadow-sm">
						<span class="font-bold text-violet-600">{bracketTotal}</span>
						<span class="text-slate-500"> bracket</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ═══ TAB BAR ═══ -->
	<div class="sticky top-[4.5rem] z-10 -mx-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/90 px-1 py-1.5 shadow-sm backdrop-blur">
		<div class="flex gap-1">
			{#each tabs as tab}
				{@const sc = stageCount(tab.id)}
				<button
					onclick={() => (activeTab = tab.id)}
					class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all
					{activeTab === tab.id
						? 'bg-slate-900 text-white shadow-md'
						: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
				>
					<span class="text-base">{tab.icon}</span>
					<span class="hidden sm:inline">{tab.label}</span>
					<span
						class="rounded-full px-1.5 py-0.5 text-[10px] font-bold
						{activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}"
					>
						{sc.done}/{sc.total}
					</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- ═══ GROUPS ═══ -->
	{#if activeTab === 'groups'}
		<div class="grid gap-6 lg:grid-cols-2">
			{#each GROUPS as group}
				{@const gc = GC[group] ?? GC.A}
				{@const groupStandings = standings[group] ?? []}
				{@const gMatches = groupMatches.filter((m: Match) => m.groupCode === group)}
				<div class="card-3d overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
					<!-- Group header -->
					<div class="{gc.bg} flex items-center justify-between px-5 py-3">
						<h3 class="text-lg font-black text-white">Grupo {group}</h3>
						<span class="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white">
							{stageCount('groups').done > 0 ? `${gMatches.filter((m: Match) => preds[m.id]?.predA !== null && preds[m.id]?.predA !== undefined).length}/6` : '0/6'}
						</span>
					</div>

					<!-- Live standings table -->
					<div class="border-b border-slate-100 px-4 py-3">
						<table class="w-full text-xs">
							<thead>
								<tr class="text-[10px] uppercase tracking-wider text-slate-400">
									<th class="pb-1 text-left">Equipo</th>
									<th class="w-8 pb-1 text-center">PJ</th>
									<th class="w-8 pb-1 text-center">G</th>
									<th class="w-8 pb-1 text-center">E</th>
									<th class="w-8 pb-1 text-center">P</th>
									<th class="w-8 pb-1 text-center">DG</th>
									<th class="w-10 pb-1 text-center font-bold">Pts</th>
								</tr>
							</thead>
							<tbody>
								{#each groupStandings as row, i}
									<tr class="border-t border-slate-50 {i < 2 ? 'bg-emerald-50/50' : i === 2 ? 'bg-amber-50/50' : ''}">
										<td class="py-1.5">
											<div class="flex items-center gap-1.5">
												{#if i < 2}
													<span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-black text-white">✓</span>
												{:else if i === 2}
													<span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-white">?</span>
												{:else}
													<span class="inline-flex h-4 w-4"></span>
												{/if}
												{#if getFlagUrl(row.team)}
													<img src={getFlagUrl(row.team, 40)} alt="" class="h-3.5 w-5 rounded-sm object-cover" />
												{/if}
												<span class="truncate font-medium text-slate-700">{row.team}</span>
											</div>
										</td>
										<td class="py-1.5 text-center text-slate-500">{row.played}</td>
										<td class="py-1.5 text-center text-slate-500">{row.wins}</td>
										<td class="py-1.5 text-center text-slate-500">{row.draws}</td>
										<td class="py-1.5 text-center text-slate-500">{row.losses}</td>
										<td class="py-1.5 text-center text-slate-500">{row.goalDiff > 0 ? '+' : ''}{row.goalDiff}</td>
										<td class="py-1.5 text-center font-bold {gc.text}">{row.points}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Matches -->
					<div class="space-y-0 divide-y divide-slate-100 px-4 py-2">
						{#each gMatches as match}
							{@const pred = getPred(match.id)}
							{@const status = saveStatus[match.id] ?? 'idle'}
							<div class="group relative py-2.5">
								<!-- Date / Venue -->
								<div class="mb-1.5 flex items-center justify-between text-[10px] text-slate-400">
									<span>{formatDateShort(match.kickoffAt)} · {formatTime(match.kickoffAt)}</span>
									<div class="flex items-center gap-1.5">
										{#if data.canEdit}
											{#if status === 'saving'}
												<span class="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
											{:else if status === 'saved'}
												<span class="text-emerald-500">✓</span>
											{:else if status === 'error'}
												<span class="text-rose-500">✗</span>
											{/if}
										{/if}
										<span>{venueCity(match.venue)}</span>
									</div>
								</div>

								<!-- Teams + Score -->
								<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
									<!-- Team A (right-aligned) -->
									<div class="flex items-center justify-end gap-1.5">
										<span class="truncate text-right text-sm font-semibold text-slate-800">{match.teamA}</span>
										{#if getFlagUrl(match.teamA)}
											<img src={getFlagUrl(match.teamA, 40)} alt="" class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" />
										{/if}
									</div>

									<!-- Scores -->
									<div class="flex items-center gap-1">
										{#if data.canEdit}
											<input
												type="number"
												min="0"
												inputmode="numeric"
												value={pred.predA ?? ''}
												oninput={(e) => updateScore(match.id, 'predA', e.currentTarget.value)}
												onblur={() => handleBlur(match.id)}
												class="score-input h-9 w-10 rounded-lg border-2 border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-800
												focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/30"
											/>
										{:else}
											<span class="flex h-9 w-10 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-sm font-black text-slate-800">
												{pred.predA ?? '-'}
											</span>
										{/if}
										<span class="text-xs font-bold text-slate-300">:</span>
										{#if data.canEdit}
											<input
												type="number"
												min="0"
												inputmode="numeric"
												value={pred.predB ?? ''}
												oninput={(e) => updateScore(match.id, 'predB', e.currentTarget.value)}
												onblur={() => handleBlur(match.id)}
												class="score-input h-9 w-10 rounded-lg border-2 border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-800
												focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/30"
											/>
										{:else}
											<span class="flex h-9 w-10 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-sm font-black text-slate-800">
												{pred.predB ?? '-'}
											</span>
										{/if}
									</div>

									<!-- Team B (left-aligned) -->
									<div class="flex items-center gap-1.5">
										{#if getFlagUrl(match.teamB)}
											<img src={getFlagUrl(match.teamB, 40)} alt="" class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" />
										{/if}
										<span class="truncate text-sm font-semibold text-slate-800">{match.teamB}</span>
									</div>
								</div>

								<!-- Real result + Points -->
								{#if match.scoreA !== null && match.scoreB !== null}
									<div class="mt-1 flex items-center justify-center gap-2 text-[10px]">
										<span class="text-slate-400">
											Real: <span class="font-bold text-slate-600">{match.scoreA} - {match.scoreB}</span>
										</span>
										{#if matchPointsMap[match.id]}
											{@const mp = matchPointsMap[match.id]}
											<span class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold
												{mp.totalPoints > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}">
												{mp.totalPoints > 0 ? `+${mp.totalPoints}` : '0'} pts
											</span>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- ═══ KNOCKOUT STAGES ═══ -->
	{#each ['round32', 'round16', 'quarterfinal', 'semifinal', 'final'] as stage}
		{#if activeTab === stage}
			{@const stageMatches = knockoutMatches(stage)}
			<div class="grid gap-4 md:grid-cols-2 {stage === 'final' ? 'lg:grid-cols-1 max-w-2xl mx-auto' : 'lg:grid-cols-2'}">
				{#each stageMatches as match}
					{@const pred = getPred(match.id)}
					{@const slot = bracket[match.id]}
					{@const teamA = slot?.teamA ?? match.teamA}
					{@const teamB = slot?.teamB ?? match.teamB}
					{@const isAuto = slot?.autoA || slot?.autoB}
					{@const status = saveStatus[match.id] ?? 'idle'}
					{@const isFinalMatch = match.id === 'final'}
					{@const is3rd = match.id === '3rd'}
					<div
						class="card-3d overflow-hidden rounded-2xl border shadow-lg transition-all duration-300
						{isFinalMatch
							? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white ring-2 ring-amber-200'
							: is3rd
								? 'border-orange-200 bg-gradient-to-br from-orange-50 to-white'
								: 'border-slate-200 bg-white hover:shadow-xl'}"
					>
						<!-- Match header -->
						<div class="flex items-center justify-between px-4 py-2.5 {isFinalMatch ? 'bg-amber-100/60' : is3rd ? 'bg-orange-100/60' : 'bg-slate-50'}">
							<div class="flex items-center gap-2">
								{#if isFinalMatch}
									<span class="text-lg">👑</span>
									<span class="text-xs font-bold text-amber-700">FINAL</span>
								{:else if is3rd}
									<span class="text-lg">🥉</span>
									<span class="text-xs font-bold text-orange-600">3er Puesto</span>
								{:else}
									<span class="text-xs font-medium text-slate-500">
										{formatDateShort(match.kickoffAt)} · {formatTime(match.kickoffAt)}
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-1.5">
								{#if data.canEdit}
									{#if status === 'saving'}
										<span class="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
									{:else if status === 'saved'}
										<span class="text-sm text-emerald-500">✓</span>
									{:else if status === 'error'}
										<span class="text-sm text-rose-500">✗</span>
									{/if}
								{/if}
								<span class="text-[10px] text-slate-400">{venueCity(match.venue)}</span>
							</div>
						</div>

						<div class="space-y-3 p-4">
							<!-- Team A -->
							<div class="flex items-center justify-between rounded-xl p-2.5 transition-colors {pred.predA !== null && pred.predB !== null && ((pred.predA > pred.predB) || (pred.predA === pred.predB && pred.predPenaltyWinner === 'A')) ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50'}">
								<div class="flex items-center gap-2.5">
									{#if getFlagUrl(teamA)}
										<img src={getFlagUrl(teamA, 48)} alt="" class="h-7 w-10 rounded object-cover shadow-sm" />
									{/if}
									<div>
										<span class="text-sm font-bold text-slate-800">{teamA}</span>
										{#if slot?.autoA}
											<span class="ml-1.5 rounded bg-sky-100 px-1 py-0.5 text-[8px] font-bold text-sky-600">AUTO</span>
										{/if}
									</div>
								</div>
								{#if data.canEdit}
									<input
										type="number"
										min="0"
										inputmode="numeric"
										value={pred.predA ?? ''}
										oninput={(e) => updateScore(match.id, 'predA', e.currentTarget.value)}
										onblur={() => handleBlur(match.id)}
										class="score-input h-10 w-12 rounded-lg border-2 border-slate-200 bg-white text-center text-base font-black
										focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
									/>
								{:else}
									<span class="flex h-10 w-12 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-base font-black text-slate-800">
										{pred.predA ?? '-'}
									</span>
								{/if}
							</div>

							<!-- VS divider -->
							<div class="flex items-center gap-2">
								<div class="h-px flex-1 bg-slate-200"></div>
								<span class="text-xs font-bold text-slate-300">VS</span>
								<div class="h-px flex-1 bg-slate-200"></div>
							</div>

							<!-- Team B -->
							<div class="flex items-center justify-between rounded-xl p-2.5 transition-colors {pred.predA !== null && pred.predB !== null && ((pred.predB > pred.predA) || (pred.predA === pred.predB && pred.predPenaltyWinner === 'B')) ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50'}">
								<div class="flex items-center gap-2.5">
									{#if getFlagUrl(teamB)}
										<img src={getFlagUrl(teamB, 48)} alt="" class="h-7 w-10 rounded object-cover shadow-sm" />
									{/if}
									<div>
										<span class="text-sm font-bold text-slate-800">{teamB}</span>
										{#if slot?.autoB}
											<span class="ml-1.5 rounded bg-sky-100 px-1 py-0.5 text-[8px] font-bold text-sky-600">AUTO</span>
										{/if}
									</div>
								</div>
								{#if data.canEdit}
									<input
										type="number"
										min="0"
										inputmode="numeric"
										value={pred.predB ?? ''}
										oninput={(e) => updateScore(match.id, 'predB', e.currentTarget.value)}
										onblur={() => handleBlur(match.id)}
										class="score-input h-10 w-12 rounded-lg border-2 border-slate-200 bg-white text-center text-base font-black
										focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
									/>
								{:else}
									<span class="flex h-10 w-12 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-base font-black text-slate-800">
										{pred.predB ?? '-'}
									</span>
								{/if}
							</div>

							<!-- Penalty selector (shows when draw in knockout) -->
							{#if needsPenalty(match.id, stage)}
								<div class="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 p-3">
									<p class="mb-2 text-xs font-bold text-amber-700">⚡ Empate — ¿Quién gana por penales?</p>
									{#if data.canEdit}
										<div class="grid grid-cols-2 gap-2">
											<button
												onclick={() => { updatePenalty(match.id, 'A'); autoSave(match.id); }}
												class="flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all
												{pred.predPenaltyWinner === 'A'
													? 'border-emerald-400 bg-emerald-100 text-emerald-700 shadow-sm'
													: 'border-slate-200 text-slate-600 hover:border-slate-300'}"
											>
												{#if getFlagUrl(teamA)}<img src={getFlagUrl(teamA, 24)} alt="" class="h-3 w-4 rounded-sm object-cover" />{/if}
												{teamA}
											</button>
											<button
												onclick={() => { updatePenalty(match.id, 'B'); autoSave(match.id); }}
												class="flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all
												{pred.predPenaltyWinner === 'B'
													? 'border-emerald-400 bg-emerald-100 text-emerald-700 shadow-sm'
													: 'border-slate-200 text-slate-600 hover:border-slate-300'}"
											>
												{#if getFlagUrl(teamB)}<img src={getFlagUrl(teamB, 24)} alt="" class="h-3 w-4 rounded-sm object-cover" />{/if}
												{teamB}
											</button>
										</div>
									{:else}
										<p class="text-xs text-amber-800">
											Penales: <span class="font-bold">{pred.predPenaltyWinner === 'A' ? teamA : pred.predPenaltyWinner === 'B' ? teamB : 'Sin definir'}</span>
										</p>
									{/if}
								</div>
							{/if}

							<!-- Real result + Points -->
							{#if match.scoreA !== null && match.scoreB !== null}
								<div class="flex items-center justify-center gap-2 text-[10px]">
									<span class="text-slate-400">
										Real: <span class="font-bold text-slate-600">{match.scoreA} - {match.scoreB}</span>
										{#if match.penaltyWinner}
											<span class="text-amber-600"> (Pen: {match.penaltyWinner === 'A' ? teamA : teamB})</span>
										{/if}
									</span>
									{#if matchPointsMap[match.id]}
										{@const mp = matchPointsMap[match.id]}
										<span class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold
											{mp.totalPoints > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}">
											{mp.totalPoints > 0 ? `+${mp.totalPoints}` : '0'} pts
										</span>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/each}
</section>

<style>
	.card-3d {
		transform-style: preserve-3d;
		transition:
			transform 0.5s cubic-bezier(0.23, 1, 0.32, 1),
			box-shadow 0.5s ease;
	}
	.card-3d:hover {
		transform: perspective(800px) rotateX(-1deg) rotateY(2deg) translateZ(4px);
		box-shadow:
			-6px 8px 25px rgb(0 0 0 / 0.1),
			0 0 0 1px rgb(0 0 0 / 0.03);
	}
	.score-input::-webkit-outer-spin-button,
	.score-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.score-input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
