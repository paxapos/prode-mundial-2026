<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();

	const isLiga = $derived(!!data.selectedTournament?.parentTournamentId);
	const competitions = $derived(data.tournaments.filter((t) => !t.parentTournamentId));
	const ligas = $derived(data.tournaments.filter((t) => !!t.parentTournamentId));
	const memberIds = $derived(new Set(data.tournamentMembers.map((user) => user.id)));
	const nonMembers = $derived(data.users.filter((user) => !memberIds.has(user.id)));

	function adminLigaHref(alias: string) {
		return `/admin/ligas?t=${alias}`;
	}
</script>

<div class="space-y-6">
	{#if isLiga && data.parentTournament}
		<div class="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm">
			<a href={adminLigaHref(data.parentTournament.alias)} class="font-semibold text-sky-700 hover:underline">🏆 {data.parentTournament.name}</a>
			<span class="text-sky-300">›</span>
			<span class="font-bold text-slate-800">🏅 {data.selectedTournament?.name}</span>
		</div>
	{/if}

	{#if !isLiga}
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="mb-3 text-lg font-black text-slate-800">Competiciones y Ligas</h2>
			<div class="space-y-3">
				<div class="flex flex-wrap gap-2">
					{#each competitions as tournament}
						<a href={adminLigaHref(tournament.alias)} class="flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all {data.selectedTournament?.id === tournament.id ? 'border-sky-400 bg-sky-50 text-sky-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}">
							<span>🏆</span> {tournament.name}
						</a>
					{/each}
				</div>
				{#if ligas.length > 0}
					<div class="border-t border-slate-100 pt-3">
						<p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ligas</p>
						<div class="flex flex-wrap gap-2">
							{#each ligas as liga}
								<a href={adminLigaHref(liga.alias)} class="flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all {data.selectedTournament?.id === liga.id ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}">
									<span>🏅</span> {liga.name}
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if data.selectedTournament && !isLiga}
		<div class="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
			<h2 class="mb-1 text-lg font-black text-slate-800">Crear nueva Liga</h2>
			<p class="mb-4 text-xs text-slate-500">Una liga es un grupo de amigos que compiten entre sí dentro de <strong>{data.selectedTournament.name}</strong>.</p>
			<form method="POST" action="?/createLiga" use:enhance class="space-y-4">
				<input type="hidden" name="parentTournamentId" value={data.selectedTournament.id} />
				<div class="grid gap-4 md:grid-cols-3">
					<div class="md:col-span-2"><span class="mb-1 block text-xs font-bold text-slate-500">Nombre de la liga</span><input name="name" required placeholder="Ej: Liga del Trabajo" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20" /></div>
					<div><span class="mb-1 block text-xs font-bold text-slate-500">Alias URL</span><input name="alias" placeholder="liga-trabajo" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20" /></div>
				</div>
				<button type="submit" class="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700">🏅 Crear liga</button>
			</form>
		</div>

		{#if data.ligas.length > 0}
			<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 class="mb-4 text-lg font-black text-slate-800">Ligas de {data.selectedTournament.name}</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each data.ligas as liga}
						<div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 transition-shadow hover:shadow-md">
							<div class="flex items-center gap-3"><div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-lg">🏅</div><div><p class="text-sm font-bold text-slate-800">{liga.name}</p><p class="text-xs text-slate-400">/{liga.alias}</p></div></div>
							<div class="flex items-center gap-2"><a href={adminLigaHref(liga.alias)} class="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-200">⚙️ Gestionar</a><a href={`/${liga.alias}`} class="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-200">👁️ Ver</a></div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p class="text-3xl">🏅</p><p class="mt-2 text-sm font-medium text-slate-500">Aún no creaste ninguna liga.</p></div>
		{/if}
	{:else if data.selectedTournament && isLiga}
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<div class="mb-4 flex items-center justify-between">
				<div><h2 class="text-lg font-black text-slate-800">Participantes de {data.selectedTournament.name}</h2><p class="text-xs text-slate-400">Inscribí jugadores a esta liga para que compitan entre sí.</p></div>
				<span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{data.tournamentMembers.length}</span>
			</div>

			{#if nonMembers.length > 0}
				<form method="POST" action="?/addToTournament" use:enhance class="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-3">
					<input type="hidden" name="tournamentId" value={data.selectedTournament.id} />
					<div class="flex-1"><span class="mb-1 block text-xs font-bold text-slate-500">Agregar participante</span><select name="userId" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{#each nonMembers as user}<option value={user.id}>{user.nickname} ({user.email})</option>{/each}</select></div>
					<button type="submit" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">➕ Agregar</button>
				</form>
			{:else}
				<p class="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">Todos los usuarios registrados ya están inscriptos en esta liga.</p>
			{/if}

			{#if data.tournamentMembers.length > 0}
				<div class="overflow-x-auto rounded-lg border border-slate-100">
					<table class="w-full text-sm">
						<thead><tr class="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><th class="py-2.5 pl-4 text-left">Participante</th><th class="py-2.5 text-left">Email</th><th class="py-2.5 pr-4 text-right">Acciones</th></tr></thead>
						<tbody class="divide-y divide-slate-50">
							{#each data.tournamentMembers as member}
								<tr class="hover:bg-slate-50/50"><td class="py-2.5 pl-4"><div class="flex items-center gap-2"><span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{member.nickname.charAt(0).toUpperCase()}</span><span class="font-semibold text-slate-800">{member.nickname}</span>{#if member.role === 'admin'}<span class="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">ADMIN</span>{/if}</div></td><td class="py-2.5 text-slate-500">{member.email}</td><td class="py-2.5 pr-4 text-right"><form method="POST" action="?/removeFromTournament" use:enhance class="inline"><input type="hidden" name="userId" value={member.id} /><input type="hidden" name="tournamentId" value={data.selectedTournament?.id} /><button type="submit" class="rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100">✕ Quitar</button></form></td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="rounded-lg border border-dashed border-slate-200 py-6 text-center"><p class="text-sm text-slate-400">No hay participantes aún.</p></div>
			{/if}
		</div>
	{/if}

	{#if !isLiga}
		<details class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<summary class="cursor-pointer px-5 py-4 text-sm font-bold text-slate-500 hover:text-slate-700">➕ Crear nueva competición</summary>
			<div class="border-t border-slate-100 p-5">
				<form method="POST" action="?/createTournament" use:enhance class="space-y-4">
					<div class="grid gap-4 md:grid-cols-2">
						<div><span class="mb-1 block text-xs font-bold text-slate-500">Nombre</span><input name="name" required placeholder="Copa del Barrio 2026" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" /></div>
						<div><span class="mb-1 block text-xs font-bold text-slate-500">Alias URL</span><input name="alias" placeholder="copa-barrio" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" /></div>
						<div><span class="mb-1 block text-xs font-bold text-slate-500">Imagen Header</span><input name="headerImageUrl" placeholder="https://..." class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" /></div>
						<div><span class="mb-1 block text-xs font-bold text-slate-500">Fecha de inicio</span><input name="startAt" type="datetime-local" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" /></div>
					</div>
					<button type="submit" class="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">🏆 Crear competición</button>
				</form>
			</div>
		</details>
	{/if}
</div>