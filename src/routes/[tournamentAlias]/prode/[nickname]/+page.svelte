<script lang="ts">
	import { untrack } from 'svelte';
	import { deserialize } from '$app/forms';
	import { page } from '$app/stores';
	import { Badge } from 'flowbite-svelte';
	const ogImage = $derived(`${$page.url.origin}/og-image.jpg`);
	import { getFlagUrl, GROUPS, VENUES, getTeamId } from '$lib/teams';
	import { calcStandings, buildBracket, calcGroupPositionAccuracy, type LivePred, type BracketSlot } from '$lib/bracket-engine';
	import { rankThirdPlacedGroups } from '$lib/bracket-rules';
	import { formatMatchDate as formatDateShort, formatMatchTime as formatTime } from '$lib/match-datetime';
	import { STAGE_LABELS } from '$lib/scoring-config';
	import type { Match, SideWinner } from '$lib/types';

	let { data } = $props();

	/* ─── State ─────────────────────────────────────────── */
	let activeTab = $state<string>('groups');
	let saveStatus: Record<string, 'idle' | 'saving' | 'saved' | 'error'> = $state({});
	let shareMsg = $state('');

	/* ─── Points summary ────────────────────────────────── */
	const myTotalPoints = $derived(
		(data.matchDetails ?? []).reduce((sum: number, d: { totalPoints: number }) => sum + d.totalPoints, 0) +
			(data.groupStageDetails?.totalPoints ?? 0)
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
			untrack(() => data).predictions.map((p: { matchId: string; predA: number; predB: number; predPenaltyWinner: SideWinner }) => [
				p.matchId,
				{ predA: p.predA, predB: p.predB, predPenaltyWinner: p.predPenaltyWinner }
			])
		)
	);

	/* ─── Derived ───────────────────────────────────────── */
	const groupMatches = $derived(data.matches.filter((m: Match) => m.stage === 'groups'));
	const standings = $derived(calcStandings(groupMatches, preds));
	const bracket = $derived(buildBracket(data.matches, preds));

	/* ─── Aciertos del bracket (pronóstico vs. equipos reales) ─── */
	const realTeamIds = $derived.by(() => {
		const set = new Set<string>();
		for (const m of data.matches) {
			if (m.stage !== 'groups') continue;
			set.add(getTeamId(m.teamA));
			set.add(getTeamId(m.teamB));
		}
		return set;
	});
	// Equipos eliminados de la realidad: no pueden ocupar ningún casillero futuro.
	const eliminatedSet = $derived(new Set((data.eliminatedTeams ?? []).map((t: string) => getTeamId(t))));

	type SideAccuracy = 'pending' | 'hit' | 'miss';
	interface BracketAccuracy {
		a: SideAccuracy;
		b: SideAccuracy;
		dead: boolean;
		realA?: string;
		realB?: string;
	}

	function realSlot(match: Match): { A?: string; B?: string } {
		if (match.stage === 'round32') return data.progressiveR32?.[match.id] ?? {};
		const out: { A?: string; B?: string } = {};
		if (realTeamIds.has(getTeamId(match.teamA))) out.A = match.teamA;
		if (realTeamIds.has(getTeamId(match.teamB))) out.B = match.teamB;
		return out;
	}

	function sideAccuracy(realTeam: string | undefined, predTeam: string | undefined, predResolved: boolean): SideAccuracy {
		if (!predResolved || !predTeam) return 'pending';
		if (realTeam) return getTeamId(predTeam) === getTeamId(realTeam) ? 'hit' : 'miss';
		if (eliminatedSet.has(getTeamId(predTeam))) return 'miss';
		return 'pending';
	}

	function bracketAccuracy(match: Match, slot: BracketSlot | undefined): BracketAccuracy {
		const real = realSlot(match);
		const a = sideAccuracy(real.A, slot?.teamA, !!slot?.autoA);
		const b = sideAccuracy(real.B, slot?.teamB, !!slot?.autoB);
		return { a, b, dead: a === 'miss' && b === 'miss', realA: real.A, realB: real.B };
	}

	// Resumen de aciertos de las llaves de 16avos (16 cruces, 32 clasificados).
	const bracketSummary = $derived.by(() => {
		const r32 = data.matches.filter((m: Match) => m.stage === 'round32');
		let slotsDecided = 0;
		let slotsHit = 0;
		let crossesPerfect = 0;
		let crossesDecided = 0;
		let dead = 0;
		for (const m of r32) {
			const acc = bracketAccuracy(m, bracket[m.id]);
			const aDecided = acc.a !== 'pending';
			const bDecided = acc.b !== 'pending';
			if (aDecided) { slotsDecided++; if (acc.a === 'hit') slotsHit++; }
			if (bDecided) { slotsDecided++; if (acc.b === 'hit') slotsHit++; }
			if (aDecided && bDecided) {
				crossesDecided++;
				if (acc.a === 'hit' && acc.b === 'hit') crossesPerfect++;
				if (acc.dead) dead++;
			}
		}
		return { total: r32.length, slotsDecided, slotsHit, crossesPerfect, crossesDecided, dead };
	});
	const accuracyOwnerLabel = $derived(data.isOwner ? 'Tus' : `${data.profileUser.nickname}:`);

	/* ─── Acierto de posiciones de grupos (pronóstico vs. realidad) ─── */
	const groupAccuracy = $derived(calcGroupPositionAccuracy(groupMatches, preds));
	const accuracyBanner = $derived.by(() => {
		const pct = groupAccuracy.pct;
		if (pct === null) return null; // todavía no hay grupos definidos para comparar
		const subject = data.isOwner ? 'Llevás' : `${data.profileUser.nickname} lleva`;
		const head = `${subject} ${pct}% de acierto en posiciones de grupos`;
		let mood: string;
		let tone: { wrap: string; emoji: string; pct: string };
		if (pct >= 75) {
			mood = '¡VAS MUY BIEN! En la fase de llaves la rompés 🔥';
			tone = {
				wrap: 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50',
				emoji: '🏆',
				pct: 'bg-emerald-500'
			};
		} else if (pct >= 50) {
			mood = 'Vas bien encaminado, seguí así 💪';
			tone = {
				wrap: 'border-sky-300 bg-gradient-to-r from-sky-50 to-cyan-50',
				emoji: '🎯',
				pct: 'bg-sky-500'
			};
		} else if (pct >= 25) {
			mood = 'Hay margen para mejorar, todavía estás a tiempo 👀';
			tone = {
				wrap: 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50',
				emoji: '⚠️',
				pct: 'bg-amber-500'
			};
		} else {
			mood = 'A remontar, que las llaves dan muchos puntos 🥶';
			tone = {
				wrap: 'border-rose-300 bg-gradient-to-r from-rose-50 to-red-50',
				emoji: '📉',
				pct: 'bg-rose-500'
			};
		}
		return { pct, head, mood, tone, decidedGroups: groupAccuracy.decidedGroups };
	});

	/* ─── Ranking de mejores terceros (los 8 mejores clasifican) ─── */
	const THIRDS_ADVANCE = 8;
	const thirdPlaceRank = $derived.by(() => {
		const ranking = rankThirdPlacedGroups(standings);
		const map: Record<string, { rank: number; advances: boolean }> = {};
		ranking.forEach((entry, index) => {
			map[entry.group] = { rank: index + 1, advances: index < THIRDS_ADVANCE };
		});
		return map;
	});

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
		{ id: 'round32', label: '16avos', icon: '🏟️' },
		{ id: 'round16', label: 'Octavos', icon: '🔥' },
		{ id: 'quarterfinal', label: 'Cuartos', icon: '⚡' },
		{ id: 'semifinal', label: 'Semis', icon: '🏆' },
		{ id: 'thirdplace', label: '3er puesto', icon: '🥉' },
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
	function venueCity(v: string | null) {
		if (!v) return '';
		return VENUES[v]?.city ?? v;
	}

	function getPred(matchId: string): LivePred {
		return preds[matchId] ?? { predA: null, predB: null, predPenaltyWinner: null };
	}

	function canEditMatch(match: Match): boolean {
		const tenMinutesBeforeKickoff = new Date(match.kickoffAt).getTime() - 10 * 60 * 1000;
		return data.canEditPredictions && !match.isClosed && Date.now() < tenMinutesBeforeKickoff;
	}

	function updateScore(matchId: string, field: 'predA' | 'predB', value: string) {
		const match = data.matches.find((item: Match) => item.id === matchId);
		if (!match || !canEditMatch(match)) return;
		const num = value === '' ? null : parseInt(value, 10);
		if (num !== null && (isNaN(num) || num < 0)) return;
		const current = preds[matchId] ?? { predA: null, predB: null, predPenaltyWinner: null };
		preds[matchId] = { ...current, [field]: num };
		// Guardado con debounce: garantiza persistir aunque el blur no se dispare
		// (p. ej. en mobile al cerrar el teclado o navegar a otra pestaña).
		scheduleAutoSave(matchId);
	}

	function updatePenalty(matchId: string, value: string) {
		const match = data.matches.find((item: Match) => item.id === matchId);
		if (!match || !canEditMatch(match)) return;
		const current = preds[matchId] ?? { predA: null, predB: null, predPenaltyWinner: null };
		preds[matchId] = {
			...current,
			predPenaltyWinner: value === 'A' || value === 'B' ? value : null
		};
	}

	/* ─── Auto-save ─────────────────────────────────────── */
	const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	function scheduleAutoSave(matchId: string) {
		const match = data.matches.find((item: Match) => item.id === matchId);
		if (!match || !canEditMatch(match)) return;
		if (saveTimers[matchId]) clearTimeout(saveTimers[matchId]);
		saveTimers[matchId] = setTimeout(() => {
			delete saveTimers[matchId];
			autoSave(matchId);
		}, 700);
	}

	async function autoSave(matchId: string) {
		const match = data.matches.find((item: Match) => item.id === matchId);
		if (!match || !canEditMatch(match)) return;
		if (saveTimers[matchId]) {
			clearTimeout(saveTimers[matchId]);
			delete saveTimers[matchId];
		}
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
		const match = data.matches.find((item: Match) => item.id === matchId);
		if (!match || !canEditMatch(match)) return;
		const pred = preds[matchId];
		if (pred && pred.predA !== null && pred.predB !== null) autoSave(matchId);
	}

	/**
	 * Respaldo de guardado: si la página se oculta (cambio de pestaña, minimizar
	 * la app en mobile, cerrar) con guardados pendientes, los enviamos con
	 * sendBeacon para que no se pierdan aunque el blur o el debounce no alcancen.
	 */
	function flushPending() {
		if (!data.canEditPredictions) return;
		for (const matchId of Object.keys(saveTimers)) {
			const match = data.matches.find((item: Match) => item.id === matchId);
			if (!match || !canEditMatch(match)) continue;
			clearTimeout(saveTimers[matchId]);
			delete saveTimers[matchId];
			const pred = preds[matchId];
			if (!pred || pred.predA === null || pred.predB === null) continue;
			const fd = new FormData();
			fd.set('matchId', matchId);
			fd.set('predA', String(pred.predA));
			fd.set('predB', String(pred.predB));
			fd.set('predPenaltyWinner', pred.predPenaltyWinner ?? '');
			navigator.sendBeacon?.('?/save', fd);
		}
	}

	$effect(() => {
		if (!data.canEditPredictions) return;
		const onHide = () => {
			if (document.visibilityState === 'hidden') flushPending();
		};
		document.addEventListener('visibilitychange', onHide);
		window.addEventListener('pagehide', flushPending);
		return () => {
			document.removeEventListener('visibilitychange', onHide);
			window.removeEventListener('pagehide', flushPending);
		};
	});

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

	const pageTitle = $derived(`Mirá el prode de ${data.profileUser.nickname} ⚽`);
	const pageDescription = $derived(`Mirá el prode de ${data.profileUser.nickname} para el ${data.tournament.name}. Prode para los amigos, Mundial 2026.`);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:type" content="image/jpeg" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={$page.url.href} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
	<meta name="twitter:image" content={ogImage} />
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

	<!-- ═══ PREDICTIONS HIDDEN BEFORE TOURNAMENT START ═══ -->
	{#if !data.canViewPredictions}
		<div class="relative">
			<!-- Blurred fixture preview -->
			<div class="pointer-events-none select-none blur-md" aria-hidden="true">
				<div class="grid gap-6 lg:grid-cols-2">
					{#each GROUPS.slice(0, 4) as group}
						{@const gc = GC[group] ?? GC.A}
						{@const gMatches = groupMatches.filter((m: Match) => m.groupCode === group)}
						<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
							<div class="{gc.bg} px-5 py-3">
								<h3 class="text-lg font-black text-white">Grupo {group}</h3>
							</div>
							<div class="space-y-0 divide-y divide-slate-100 px-4 py-2">
								{#each gMatches.slice(0, 3) as match}
									<div class="py-2.5">
										<div class="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_minmax(0,1fr)] items-center gap-1.5 sm:gap-2">
											<div class="flex min-w-0 items-center justify-end gap-1.5">
												<span class="truncate text-right text-xs sm:text-sm font-semibold text-slate-800" title={match.teamA}>{match.teamA}</span>
												{#if getFlagUrl(match.teamA)}
													<img src={getFlagUrl(match.teamA, 40)} alt="" class="h-5 w-7 shrink-0 rounded-sm object-cover" />
												{/if}
											</div>
											<span class="flex h-9 w-full items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-sm font-black text-slate-800">?</span>
											<span class="flex h-9 w-full items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-sm font-black text-slate-800">?</span>
											<div class="flex min-w-0 items-center gap-1.5">
												{#if getFlagUrl(match.teamB)}
													<img src={getFlagUrl(match.teamB, 40)} alt="" class="h-5 w-7 shrink-0 rounded-sm object-cover" />
												{/if}
												<span class="truncate text-xs sm:text-sm font-semibold text-slate-800" title={match.teamB}>{match.teamB}</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
			<!-- Overlay message -->
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="rounded-2xl border border-amber-200 bg-white/95 px-8 py-6 text-center shadow-xl backdrop-blur">
					<span class="text-4xl">🔒</span>
					<h2 class="mt-3 text-xl font-black text-slate-800">Pronósticos ocultos</h2>
					<p class="mt-2 max-w-sm text-sm text-slate-600">
						Hasta que no comience la competición no se pueden ver los pronósticos de otros usuarios.
					</p>
					<a
						href="/{data.tournament.alias}"
						class="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
					>
						📊 Ver tabla de posiciones
					</a>
				</div>
			</div>
		</div>
	{:else}

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
				{#if (data.groupStageDetails?.totalPoints ?? 0) > 0}
					<div class="rounded-lg bg-white/80 px-3 py-1.5 shadow-sm">
						<span class="font-bold text-amber-600">{data.groupStageDetails.totalPoints}</span>
						<span class="text-slate-500"> clasif. 16avos</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if (data.groupStageDetails?.totalPoints ?? 0) > 0}
		<div class="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
			<p class="mb-2 text-sm font-bold text-slate-700">Casilleros de 16avos acertados (+{data.groupStageDetails.totalPoints})</p>
			<div class="flex flex-wrap gap-2">
				{#each data.groupStageDetails.details.filter((d) => d.hit) as d (d.matchId + d.side)}
					<span class="rounded-lg bg-white px-3 py-1.5 text-xs shadow-sm">
						<span class="font-bold text-slate-700">{d.slotLabel}</span>
						<span class="text-slate-500"> · {d.predictedTeam}</span>
						<span class="font-bold text-amber-600"> +{d.points}</span>
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ═══ BRACKET ACCURACY SUMMARY (16avos) ═══ -->
	{#if bracketSummary.slotsDecided > 0}
		<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div class="mb-3 flex items-center gap-2">
				<span class="text-lg">🏟️</span>
				<h2 class="text-sm font-black uppercase tracking-wide text-slate-700">{accuracyOwnerLabel} aciertos en 16avos</h2>
			</div>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<div class="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
					<p class="text-2xl font-black text-emerald-700">{bracketSummary.slotsHit}<span class="text-base text-emerald-500">/{bracketSummary.slotsDecided}</span></p>
					<p class="mt-0.5 text-[11px] font-semibold text-slate-500">Clasificados acertados</p>
				</div>
				<div class="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-center">
					<p class="text-2xl font-black text-sky-700">{bracketSummary.crossesPerfect}<span class="text-base text-sky-500">/{bracketSummary.total}</span></p>
					<p class="mt-0.5 text-[11px] font-semibold text-slate-500">Cruces completos</p>
				</div>
				<div class="col-span-2 rounded-xl border p-3 text-center sm:col-span-1 {bracketSummary.dead > 0 ? 'border-rose-200 bg-rose-50/70' : 'border-slate-100 bg-slate-50/60'}">
					<p class="text-2xl font-black {bracketSummary.dead > 0 ? 'text-rose-600' : 'text-slate-400'}">{bracketSummary.dead > 0 ? '💀 ' : ''}{bracketSummary.dead}</p>
					<p class="mt-0.5 text-[11px] font-semibold text-slate-500">Llaves muertas</p>
				</div>
			</div>
			{#if bracketSummary.crossesDecided < bracketSummary.total}
				<p class="mt-3 text-[11px] text-slate-400">Se va completando a medida que se cierran los grupos y se definen los cruces reales.</p>
			{/if}
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
		<!-- Acierto de posiciones de grupos vs. la tabla real -->
		{#if accuracyBanner}
			<div class="mb-6 flex items-center gap-4 rounded-2xl border {accuracyBanner.tone.wrap} p-4 shadow-sm">
				<div class="flex flex-col items-center justify-center">
					<div class="flex h-16 w-16 items-center justify-center rounded-xl {accuracyBanner.tone.pct} text-xl font-black text-white shadow-md">
						{accuracyBanner.pct}%
					</div>
				</div>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-black text-slate-800 sm:text-base">
						{accuracyBanner.tone.emoji} {accuracyBanner.head}
					</p>
					<p class="mt-0.5 text-xs font-semibold text-slate-600 sm:text-sm">{accuracyBanner.mood}</p>
					<p class="mt-1 text-[11px] text-slate-400">
						Comparado con la tabla real · {accuracyBanner.decidedGroups}
						{accuracyBanner.decidedGroups === 1 ? 'grupo definido' : 'grupos definidos'}
					</p>
				</div>
			</div>
		{/if}

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
									{@const third = i === 2 ? thirdPlaceRank[group] : null}
									<tr class="border-t border-slate-50 {i < 2 ? 'bg-emerald-50/50' : i === 2 ? (third?.advances ? 'bg-emerald-50/50' : 'bg-amber-50/50') : ''}">
										<td class="py-1.5">
											<div class="flex items-center gap-1.5">
												{#if i < 2}
													<span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-black text-white">✓</span>
												{:else if i === 2}
													<span
														class="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black text-white {third?.advances ? 'bg-emerald-500' : 'bg-amber-400'}"
														title={third ? (third.advances ? `Clasifica como 3ro #${third.rank} de 8` : `3ro #${third.rank} — por ahora no clasifica`) : 'Tercero'}
													>{third?.rank ?? '?'}</span>
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
							{@const matchCanEdit = canEditMatch(match)}
							<div class="group relative py-2.5">
								<!-- Date / Venue -->
								<div class="mb-1.5 flex items-center justify-between text-[10px] text-slate-400">
									<div class="flex items-center gap-1.5">
										<span>{formatDateShort(match.kickoffAt)} · {formatTime(match.kickoffAt)}</span>
										{#if !matchCanEdit && data.canEditPredictions && !match.isClosed}
											{@const kickoffTime = new Date(match.kickoffAt).getTime()}
											{@const tenMinutesBefore = kickoffTime - 10 * 60 * 1000}
											{#if Date.now() >= tenMinutesBefore && Date.now() < kickoffTime}
												<span class="rounded bg-rose-100 px-1.5 py-0.5 text-[8px] font-bold text-rose-700">⏳ Bloqueado (Faltan menos de 10m)</span>
											{/if}
										{/if}
									</div>
									<div class="flex items-center gap-1.5">
										{#if matchCanEdit}
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
								<div class="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_minmax(0,1fr)] items-center gap-1.5 sm:gap-2">
									<!-- Team A (right-aligned) -->
									<div class="flex min-w-0 items-center justify-end gap-1.5">
										<span class="truncate text-right text-xs sm:text-sm font-semibold text-slate-800" title={match.teamA}>{match.teamA}</span>
										{#if getFlagUrl(match.teamA)}
											<img src={getFlagUrl(match.teamA, 40)} alt="" class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" />
										{/if}
									</div>

									<!-- Scores -->
									{#if matchCanEdit}
										<input
											type="number"
											min="0"
											inputmode="numeric"
											value={pred.predA ?? ''}
											oninput={(e) => updateScore(match.id, 'predA', e.currentTarget.value)}
											onblur={() => handleBlur(match.id)}
											aria-label={`Goles de ${match.teamA}`}
											class="score-input h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-800 transition-all duration-200
											focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
										/>
									{:else}
										<span class="flex h-9 w-full items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-sm font-black text-slate-800">
											{pred.predA ?? '-'}
										</span>
									{/if}
									{#if matchCanEdit}
										<input
											type="number"
											min="0"
											inputmode="numeric"
											value={pred.predB ?? ''}
											oninput={(e) => updateScore(match.id, 'predB', e.currentTarget.value)}
											onblur={() => handleBlur(match.id)}
											aria-label={`Goles de ${match.teamB}`}
											class="score-input h-9 w-full rounded-lg border-2 border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-800 transition-all duration-200
											focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
										/>
									{:else}
										<span class="flex h-9 w-full items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-sm font-black text-slate-800">
											{pred.predB ?? '-'}
										</span>
									{/if}

									<!-- Team B (left-aligned) -->
									<div class="flex min-w-0 items-center gap-1.5">
										{#if getFlagUrl(match.teamB)}
											<img src={getFlagUrl(match.teamB, 40)} alt="" class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" />
										{/if}
										<span class="truncate text-xs sm:text-sm font-semibold text-slate-800" title={match.teamB}>{match.teamB}</span>
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
	{#each ['round32', 'round16', 'quarterfinal', 'semifinal', 'thirdplace', 'final'] as stage}
		{#if activeTab === stage}
			{@const stageMatches = knockoutMatches(stage)}
			<div class="grid gap-4 md:grid-cols-2 {stage === 'final' || stage === 'thirdplace' ? 'lg:grid-cols-1 max-w-2xl mx-auto' : 'lg:grid-cols-2'}">
				{#each stageMatches as match}
					{@const pred = getPred(match.id)}
					{@const slot = bracket[match.id]}
					{@const teamA = slot?.teamA ?? match.teamA}
					{@const teamB = slot?.teamB ?? match.teamB}
					{@const isAuto = slot?.autoA || slot?.autoB}
					{@const status = saveStatus[match.id] ?? 'idle'}
					{@const matchCanEdit = canEditMatch(match)}
					{@const isFinalMatch = match.id === 'final'}
					{@const is3rd = match.id === '3rd'}
					{@const acc = bracketAccuracy(match, slot)}
					<div
						class="card-3d overflow-hidden rounded-2xl border shadow-lg transition-all duration-300
						{acc.dead
							? 'border-rose-300 bg-gradient-to-br from-rose-50 to-white ring-2 ring-rose-300'
							: isFinalMatch
								? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white ring-2 ring-amber-200'
								: is3rd
									? 'border-orange-200 bg-gradient-to-br from-orange-50 to-white'
									: 'border-slate-200 bg-white hover:shadow-xl'}"
					>
						{#if acc.dead}
							<div class="flex items-center gap-2 bg-rose-600 px-4 py-2 text-white">
								<span class="text-base">💀</span>
								<span class="text-[11px] font-black uppercase tracking-wide">Llave muerta — ningún equipo de este cruce sigue vivo, ya no suma puntos acá</span>
							</div>
						{/if}
						<!-- Match header -->
						<div class="flex items-center justify-between px-4 py-2.5 {isFinalMatch ? 'bg-amber-100/60' : is3rd ? 'bg-orange-100/60' : 'bg-slate-50'}">
							<div class="flex flex-wrap items-center gap-2">
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
								{#if !matchCanEdit && data.canEditPredictions && !match.isClosed}
									{@const kickoffTime = new Date(match.kickoffAt).getTime()}
									{@const tenMinutesBefore = kickoffTime - 10 * 60 * 1000}
									{#if Date.now() >= tenMinutesBefore && Date.now() < kickoffTime}
										<span class="rounded bg-rose-100 px-1.5 py-0.5 text-[8px] font-bold text-rose-700">⏳ Bloqueado (Faltan menos de 10m)</span>
									{/if}
								{/if}
							</div>
							<div class="flex items-center gap-1.5">
								{#if matchCanEdit}
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
							<div class="flex items-center justify-between rounded-xl p-2.5 transition-colors {acc.a === 'miss' ? 'bg-slate-100/70' : pred.predA !== null && pred.predB !== null && ((pred.predA > pred.predB) || (pred.predA === pred.predB && pred.predPenaltyWinner === 'A')) ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50'}">
								<div class="flex items-center gap-2.5 {acc.a === 'miss' ? 'opacity-60' : ''}">
									{#if getFlagUrl(teamA)}
										<img src={getFlagUrl(teamA, 48)} alt="" class="h-7 w-10 rounded object-cover shadow-sm {acc.a === 'miss' ? 'grayscale' : ''}" />
									{/if}
									<div>
										<div class="flex flex-wrap items-center gap-1.5">
											<span class="text-sm font-bold {acc.a === 'miss' ? 'text-slate-400 line-through' : 'text-slate-800'}">{teamA}</span>
											{#if slot?.autoA}
												<span class="rounded bg-sky-100 px-1 py-0.5 text-[8px] font-bold text-sky-600">AUTO</span>
											{/if}
											{#if acc.a === 'hit'}
												<span class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-black text-emerald-700">✓ acertó</span>
											{:else if acc.a === 'miss'}
												<span class="rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-black text-rose-700">✗ no pasó</span>
											{/if}
										</div>
										{#if acc.a === 'miss'}
											<p class="mt-0.5 text-[10px] font-semibold text-slate-500">{acc.realA ? `Pasó: ${acc.realA}` : 'Eliminado — no llega a esta fase'}</p>
										{/if}
									</div>
								</div>
								{#if matchCanEdit}
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
							<div class="flex items-center justify-between rounded-xl p-2.5 transition-colors {acc.b === 'miss' ? 'bg-slate-100/70' : pred.predA !== null && pred.predB !== null && ((pred.predB > pred.predA) || (pred.predA === pred.predB && pred.predPenaltyWinner === 'B')) ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50'}">
								<div class="flex items-center gap-2.5 {acc.b === 'miss' ? 'opacity-60' : ''}">
									{#if getFlagUrl(teamB)}
										<img src={getFlagUrl(teamB, 48)} alt="" class="h-7 w-10 rounded object-cover shadow-sm {acc.b === 'miss' ? 'grayscale' : ''}" />
									{/if}
									<div>
										<div class="flex flex-wrap items-center gap-1.5">
											<span class="text-sm font-bold {acc.b === 'miss' ? 'text-slate-400 line-through' : 'text-slate-800'}">{teamB}</span>
											{#if slot?.autoB}
												<span class="rounded bg-sky-100 px-1 py-0.5 text-[8px] font-bold text-sky-600">AUTO</span>
											{/if}
											{#if acc.b === 'hit'}
												<span class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-black text-emerald-700">✓ acertó</span>
											{:else if acc.b === 'miss'}
												<span class="rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-black text-rose-700">✗ no pasó</span>
											{/if}
										</div>
										{#if acc.b === 'miss'}
											<p class="mt-0.5 text-[10px] font-semibold text-slate-500">{acc.realB ? `Pasó: ${acc.realB}` : 'Eliminado — no llega a esta fase'}</p>
										{/if}
									</div>
								</div>
								{#if matchCanEdit}
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
									{#if matchCanEdit}
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
	{/if}
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
