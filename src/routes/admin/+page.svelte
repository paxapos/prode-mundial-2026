<script lang="ts">
	import { Alert, Badge, Button, Input, Label, Select } from 'flowbite-svelte';
	import { getFlagUrl, VENUES } from '$lib/teams';

	let { data, form } = $props();

	const stageNames: Record<string, string> = {
		groups: 'Fase de Grupos',
		round32: 'Ronda de 32',
		round16: 'Octavos de final',
		quarterfinal: 'Cuartos de final',
		semifinal: 'Semifinal',
		final: 'Final'
	};

	/* ─── Tabs ─── */
	type AdminTab = 'torneos' | 'usuarios' | 'resultados' | 'config';
	let activeTab = $state<AdminTab>('resultados');

	const tabItems: { id: AdminTab; label: string; icon: string }[] = [
		{ id: 'resultados', label: 'Resultados', icon: '⚽' },
		{ id: 'torneos', label: 'Torneos', icon: '🏆' },
		{ id: 'usuarios', label: 'Usuarios', icon: '👥' },
		{ id: 'config', label: 'Config', icon: '⚙️' }
	];

	/* ─── Match filtering ─── */
	let matchStageFilter = $state<string>('all');
	let matchSearch = $state('');
	let showOnlyPending = $state(true);

	const stageOptions = [
		{ value: 'all', label: 'Todas las fases' },
		{ value: 'groups', label: 'Grupos' },
		{ value: 'round32', label: 'Ronda de 32' },
		{ value: 'round16', label: 'Octavos' },
		{ value: 'quarterfinal', label: 'Cuartos' },
		{ value: 'semifinal', label: 'Semifinales' },
		{ value: 'final', label: 'Final' }
	];

	const filteredMatches = $derived(
		data.matches.filter((m) => {
			if (matchStageFilter !== 'all' && m.stage !== matchStageFilter) return false;
			if (showOnlyPending && m.isClosed) return false;
			if (matchSearch) {
				const q = matchSearch.toLowerCase();
				if (!m.teamA.toLowerCase().includes(q) && !m.teamB.toLowerCase().includes(q) && !(m.groupCode ?? '').toLowerCase().includes(q)) return false;
			}
			return true;
		})
	);

	const matchStats = $derived({
		total: data.matches.length,
		closed: data.matches.filter((m) => m.isClosed).length,
		pending: data.matches.filter((m) => !m.isClosed).length
	});

	function formatDate(iso: string) {
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

	const stateTone: Record<string, 'green' | 'yellow' | 'red' | 'purple'> = {
		draft: 'yellow',
		open_predictions: 'green',
		locked: 'red',
		finished: 'purple'
	};
	const stateLabel: Record<string, string> = {
		draft: 'Borrador',
		open_predictions: 'Pronósticos abiertos',
		locked: 'Bloqueado',
		finished: 'Finalizado'
	};
</script>

<svelte:head>
	<title>Admin | Prode Mundial 2026</title>
</svelte:head>

<section class="space-y-6">
	<!-- ═══ HEADER ═══ -->
	<div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
		<div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-500/10 blur-2xl"></div>
		<div class="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl"></div>
		<div class="relative flex flex-wrap items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl backdrop-blur">⚙️</div>
				<div>
					<h1 class="text-2xl font-black tracking-tight md:text-3xl">Panel de Administración</h1>
					<p class="text-sm text-white/50">
						{data.selectedTournament?.name ?? 'Sin torneo seleccionado'}
						{#if matchStats.total > 0}
							· {matchStats.closed}/{matchStats.total} partidos cargados
						{/if}
					</p>
				</div>
			</div>
			{#if data.settings}
				<Badge color={stateTone[data.settings.state] ?? 'yellow'} class="text-xs">
					{stateLabel[data.settings.state] ?? data.settings.state}
				</Badge>
			{/if}
		</div>

		<!-- Progress bar -->
		{#if matchStats.total > 0}
			<div class="relative mt-4">
				<div class="flex items-center justify-between text-[10px] text-white/40">
					<span>Progreso de carga de resultados</span>
					<span class="font-bold text-emerald-400">{Math.round((matchStats.closed / matchStats.total) * 100)}%</span>
				</div>
				<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
					<div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-700" style="width: {(matchStats.closed / matchStats.total) * 100}%"></div>
				</div>
			</div>
		{/if}
	</div>

	{#if form?.message}
		<Alert color="red" class="font-medium">{form.message}</Alert>
	{/if}
	{#if form?.ok}
		<Alert color="green" class="font-medium">Operación realizada con éxito.</Alert>
	{/if}

	<!-- ═══ TAB NAV ═══ -->
	<div class="sticky top-[4.5rem] z-10 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur">
		<div class="flex gap-1">
			{#each tabItems as tab}
				<button
					onclick={() => (activeTab = tab.id)}
					class="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all
					{activeTab === tab.id
						? 'bg-slate-900 text-white shadow-md'
						: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}"
				>
					<span class="text-base">{tab.icon}</span>
					<span>{tab.label}</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- TAB: RESULTADOS                                    -->
	<!-- ═══════════════════════════════════════════════════ -->
	{#if activeTab === 'resultados'}
		<!-- Stats cards -->
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

		<!-- Filters -->
		<div class="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
			<div class="flex-1">
				<input
					type="text"
					placeholder="Buscar equipo..."
					bind:value={matchSearch}
					class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
				/>
			</div>
			<select bind:value={matchStageFilter} class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
				{#each stageOptions as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
			<button
				onclick={() => (showOnlyPending = !showOnlyPending)}
				class="rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all
				{showOnlyPending
					? 'border-amber-400 bg-amber-50 text-amber-700'
					: 'border-slate-200 text-slate-500 hover:border-slate-300'}"
			>
				{showOnlyPending ? '📋 Solo pendientes' : '📋 Todos'}
			</button>
		</div>

		<!-- Match list -->
		{#if filteredMatches.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
				<p class="text-3xl">🎉</p>
				<p class="mt-2 text-sm font-medium text-slate-500">
					{showOnlyPending ? 'No hay partidos pendientes con estos filtros.' : 'No hay partidos que coincidan.'}
				</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each filteredMatches as match}
					<div class="overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md
						{match.isClosed ? 'border-emerald-200' : 'border-slate-200'}">
						<!-- Match header bar -->
						<div class="flex items-center justify-between px-4 py-2 {match.isClosed ? 'bg-emerald-50' : 'bg-slate-50'}">
							<div class="flex items-center gap-2">
								<span class="inline-flex h-6 items-center rounded-md px-2 text-[10px] font-bold uppercase tracking-wider
									{match.stage === 'groups' ? 'bg-sky-100 text-sky-700'
										: match.stage === 'final' ? 'bg-amber-100 text-amber-700'
										: 'bg-violet-100 text-violet-700'}">
									{stageNames[match.stage] ?? match.stage}
									{#if match.groupCode} {match.groupCode}{/if}
								</span>
								<span class="text-xs text-slate-400">
									{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)} hs
								</span>
								{#if match.venue}
									<span class="hidden text-xs text-slate-400 sm:inline">· {venueCity(match.venue)}</span>
								{/if}
							</div>
							{#if match.isClosed}
								<span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
									✓ Cargado
								</span>
							{/if}
						</div>

						<div class="p-4">
							<!-- Teams row -->
							<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
								<!-- Team A -->
								<div class="flex items-center justify-end gap-2">
									<span class="truncate text-right text-sm font-bold text-slate-800">{match.teamA}</span>
									{#if getFlagUrl(match.teamA)}
										<img src={getFlagUrl(match.teamA, 48)} alt={match.teamA} class="h-7 w-10 shrink-0 rounded object-cover shadow-sm" />
									{/if}
								</div>

								<!-- Score display -->
								<div class="flex items-center gap-1.5">
									{#if match.scoreA !== null}
										<span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-base font-black text-emerald-800">{match.scoreA}</span>
									{:else}
										<span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-base font-black text-slate-300">-</span>
									{/if}
									<span class="text-xs font-bold text-slate-300">:</span>
									{#if match.scoreB !== null}
										<span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-base font-black text-emerald-800">{match.scoreB}</span>
									{:else}
										<span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-base font-black text-slate-300">-</span>
									{/if}
								</div>

								<!-- Team B -->
								<div class="flex items-center gap-2">
									{#if getFlagUrl(match.teamB)}
										<img src={getFlagUrl(match.teamB, 48)} alt={match.teamB} class="h-7 w-10 shrink-0 rounded object-cover shadow-sm" />
									{/if}
									<span class="truncate text-sm font-bold text-slate-800">{match.teamB}</span>
								</div>
							</div>

							<!-- Penalty info -->
							{#if match.penaltyWinner}
								<p class="mt-2 text-center text-xs font-semibold text-amber-600">
									⚡ Penales: gana {match.penaltyWinner === 'A' ? match.teamA : match.teamB}
								</p>
							{/if}

							<!-- Result form -->
							<details class="mt-3 rounded-lg border border-slate-200" open={!match.isClosed}>
								<summary class="cursor-pointer px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">
									{match.isClosed ? '✏️ Editar resultado' : '📝 Cargar resultado'}
								</summary>
								<div class="border-t border-slate-100 p-3">
									<form method="POST" action="?/saveResult" class="space-y-3">
										<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
										<input type="hidden" name="matchId" value={match.id} />
										<div class="grid grid-cols-2 gap-3">
											<div>
												<span class="mb-1 block text-xs font-medium text-slate-500">{match.teamA}</span>
												<input
													name="scoreA"
													type="number"
													min="0"
													required
													value={match.scoreA ?? ''}
													class="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 py-2 text-center text-lg font-black focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
												/>
											</div>
											<div>
												<span class="mb-1 block text-xs font-medium text-slate-500">{match.teamB}</span>
												<input
													name="scoreB"
													type="number"
													min="0"
													required
													value={match.scoreB ?? ''}
													class="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-3 py-2 text-center text-lg font-black focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
												/>
											</div>
										</div>
										{#if match.stage !== 'groups'}
											<div>
												<span class="mb-1 block text-xs font-medium text-slate-500">Penales (si empatan)</span>
												<select name="penaltyWinner" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
													<option value="" selected={!match.penaltyWinner}>Sin penales</option>
													<option value="A" selected={match.penaltyWinner === 'A'}>{match.teamA}</option>
													<option value="B" selected={match.penaltyWinner === 'B'}>{match.teamB}</option>
												</select>
											</div>
										{/if}
										<button type="submit" class="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800">
											💾 Guardar resultado
										</button>
									</form>
								</div>
							</details>

							<!-- Edit teams (knockout) -->
							{#if match.stage !== 'groups'}
								<details class="mt-2 rounded-lg border border-slate-200">
									<summary class="cursor-pointer px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600">
										🔄 Editar equipos (llave)
									</summary>
									<div class="border-t border-slate-100 p-3">
										<form method="POST" action="?/updateMatch" class="flex flex-wrap items-end gap-2">
											<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
											<input type="hidden" name="matchId" value={match.id} />
											<div class="flex-1">
												<span class="mb-1 block text-[10px] font-medium text-slate-400">Equipo A</span>
												<input name="teamA" value={match.teamA} class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm" />
											</div>
											<div class="flex-1">
												<span class="mb-1 block text-[10px] font-medium text-slate-400">Equipo B</span>
												<input name="teamB" value={match.teamB} class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm" />
											</div>
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
	{/if}

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- TAB: TORNEOS                                       -->
	<!-- ═══════════════════════════════════════════════════ -->
	{#if activeTab === 'torneos'}
		<!-- Tournament selector -->
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="mb-4 text-lg font-black text-slate-800">Torneos existentes</h2>
			<div class="flex flex-wrap gap-2">
				{#each data.tournaments as tournament}
					<a
						href={`/admin?t=${tournament.alias}`}
						class="group flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all
						{data.selectedTournament?.id === tournament.id
							? 'border-sky-400 bg-sky-50 text-sky-700 shadow-sm'
							: 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}"
					>
						<span class="text-base">🏆</span>
						{tournament.name}
					</a>
				{/each}
			</div>
		</div>

		<!-- Create tournament -->
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="mb-1 text-lg font-black text-slate-800">Crear nuevo torneo</h2>
			<p class="mb-4 text-xs text-slate-400">Definí nombre, alias URL, fecha de inicio y reglas de puntuación.</p>
			<form method="POST" action="?/createTournament" class="space-y-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Nombre del torneo</span>
						<input name="name" required placeholder="Copa del Barrio 2026" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Alias URL</span>
						<input name="alias" placeholder="copa-barrio" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
						<p class="mt-1 text-[10px] text-slate-400">Se genera automáticamente si lo dejás vacío</p>
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Imagen Header (opcional)</span>
						<input name="headerImageUrl" placeholder="https://..." class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Fecha de inicio</span>
						<input name="startAt" type="datetime-local" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
					</div>
				</div>
				<div class="grid grid-cols-3 gap-3">
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Pts. Signo</span>
						<input type="number" min="0" name="pointsOutcome" value="1" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-bold focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Pts. Exacto</span>
						<input type="number" min="0" name="pointsExact" value="3" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-bold focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Pts. Llave</span>
						<input type="number" min="0" name="pointsBracket" value="3" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-bold focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
					</div>
				</div>
				<button type="submit" class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 md:w-auto md:px-8">
					🏆 Crear torneo
				</button>
			</form>
		</div>

		<!-- Add match -->
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="mb-1 text-lg font-black text-slate-800">Agregar partido</h2>
			<p class="mb-4 text-xs text-slate-400">Agregá partidos manualmente al torneo seleccionado.</p>
			<form method="POST" action="?/addMatch" class="space-y-4">
				<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
				<div class="grid gap-4 md:grid-cols-3">
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Fase</span>
						<select name="stage" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
							<option value="groups">Grupos</option>
							<option value="round32">Ronda de 32</option>
							<option value="round16">Octavos</option>
							<option value="quarterfinal">Cuartos</option>
							<option value="semifinal">Semifinal</option>
							<option value="final">Final</option>
						</select>
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Grupo (opcional)</span>
						<input name="groupCode" placeholder="A" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Fecha y hora</span>
						<input name="kickoffAt" type="datetime-local" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Equipo A</span>
						<input name="teamA" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Equipo B</span>
						<input name="teamB" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
					</div>
					<div class="flex items-end">
						<button type="submit" class="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800">
							➕ Agregar
						</button>
					</div>
				</div>
			</form>
		</div>
	{/if}

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- TAB: USUARIOS                                      -->
	<!-- ═══════════════════════════════════════════════════ -->
	{#if activeTab === 'usuarios'}
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Create user -->
			<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 class="mb-1 text-lg font-black text-slate-800">Crear usuario</h2>
				<p class="mb-4 text-xs text-slate-400">El usuario se asigna automáticamente al torneo activo.</p>
				<form method="POST" action="?/createUser" class="space-y-3">
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Email</span>
						<input name="email" type="email" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Contraseña</span>
						<input name="password" type="password" minlength={6} maxlength={72} required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Nickname</span>
						<input name="nickname" minlength={3} maxlength={20} placeholder="Opcional" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Rol</span>
						<select name="role" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
							<option value="player">Jugador</option>
							<option value="admin">Administrador</option>
						</select>
					</div>
					<button type="submit" class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
						👤 Crear usuario
					</button>
				</form>
			</div>

			<!-- Assign user to tournament -->
			<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 class="mb-1 text-lg font-black text-slate-800">Asignar a torneo</h2>
				<p class="mb-4 text-xs text-slate-400">Agregá un usuario existente a un torneo.</p>
				<form method="POST" action="?/assignUser" class="space-y-3">
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Usuario</span>
						<select name="userId" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
							{#each data.users as user}
								<option value={user.id}>{user.nickname} ({user.email})</option>
							{/each}
						</select>
					</div>
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Torneo</span>
						<select name="tournamentId" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
							{#each data.tournaments as tournament}
								<option value={tournament.id}>{tournament.name}</option>
							{/each}
						</select>
					</div>
					<button type="submit" class="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-700">
						🔗 Asignar a torneo
					</button>
				</form>
			</div>
		</div>

		<!-- User list -->
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-black text-slate-800">Usuarios registrados</h2>
				<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{data.users.length}</span>
			</div>
			<div class="overflow-hidden rounded-lg border border-slate-100">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
							<th class="py-3 pl-4 text-left">Usuario</th>
							<th class="py-3 text-left">Email</th>
							<th class="py-3 pr-4 text-center">Rol</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-50">
						{#each data.users as user}
							<tr class="hover:bg-slate-50/50">
								<td class="py-3 pl-4">
									<div class="flex items-center gap-2">
										<span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
											{user.nickname.charAt(0).toUpperCase()}
										</span>
										<span class="font-semibold text-slate-800">{user.nickname}</span>
									</div>
								</td>
								<td class="py-3 text-slate-500">{user.email}</td>
								<td class="py-3 pr-4 text-center">
									<span class="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase
										{user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'}">
										{user.role === 'admin' ? '👑 Admin' : '🎮 Player'}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- TAB: CONFIG                                        -->
	<!-- ═══════════════════════════════════════════════════ -->
	{#if activeTab === 'config'}
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Scoring rules -->
			<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 class="mb-1 text-lg font-black text-slate-800">Reglas de puntuación</h2>
				<p class="mb-4 text-xs text-slate-400">Torneo: {data.selectedTournament?.name ?? '—'}</p>
				<form method="POST" action="?/updateRules" class="space-y-4">
					<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
					<div class="grid grid-cols-3 gap-3">
						<div class="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
							<span class="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Signo</span>
							<input type="number" min="0" name="pointsOutcome" value={data.rules?.pointsOutcome ?? 1} required class="w-full rounded-lg border-2 border-slate-200 bg-white px-2 py-2 text-center text-xl font-black text-slate-800 focus:border-sky-400" />
							<p class="mt-1 text-[9px] text-slate-400">Acertar 1/X/2</p>
						</div>
						<div class="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
							<span class="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Exacto</span>
							<input type="number" min="0" name="pointsExact" value={data.rules?.pointsExact ?? 3} required class="w-full rounded-lg border-2 border-slate-200 bg-white px-2 py-2 text-center text-xl font-black text-slate-800 focus:border-sky-400" />
							<p class="mt-1 text-[9px] text-slate-400">Resultado exacto</p>
						</div>
						<div class="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
							<span class="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Llave</span>
							<input type="number" min="0" name="pointsBracket" value={data.rules?.pointsBracket ?? 3} required class="w-full rounded-lg border-2 border-slate-200 bg-white px-2 py-2 text-center text-xl font-black text-slate-800 focus:border-sky-400" />
							<p class="mt-1 text-[9px] text-slate-400">Bonus knockout</p>
						</div>
					</div>
					<button type="submit" class="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-700">
						💾 Actualizar reglas
					</button>
				</form>
			</div>

			<!-- Lock tournament -->
			<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 class="mb-1 text-lg font-black text-slate-800">Bloqueo del torneo</h2>
				<p class="mb-4 text-xs text-slate-400">Bloqueá los pronósticos manualmente. Esto impide que los jugadores editen sus predicciones.</p>
				{#if data.settings?.state === 'locked'}
					<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
						<p class="text-xs font-bold text-red-700">🔒 Torneo actualmente bloqueado</p>
						{#if data.settings.lockReason}
							<p class="mt-1 text-xs text-red-600">Motivo: {data.settings.lockReason}</p>
						{/if}
					</div>
				{/if}
				<form method="POST" action="?/lock" class="space-y-3">
					<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
					<div>
						<span class="mb-1 block text-xs font-bold text-slate-500">Motivo del bloqueo</span>
						<input name="reason" placeholder="Comenzó el Mundial" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20" />
					</div>
					<button type="submit" class="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700">
						🔒 Bloquear pronósticos
					</button>
				</form>
			</div>
		</div>
	{/if}
</section>
