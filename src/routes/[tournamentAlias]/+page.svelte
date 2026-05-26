<script lang="ts">
	import { page } from '$app/stores';
	import { SCORING_STAGES, STAGE_LABELS } from '$lib/scoring-config';
	import type { MatchStage } from '$lib/types';
	import UserAvatar from '$lib/components/UserAvatar.svelte';
	let { data } = $props();
	const ogImage = $derived(`${$page.url.origin}/og-image.jpg`);

	const STAGES: readonly MatchStage[] = SCORING_STAGES;

	let inviteMsg = $state('');
	async function copyInviteLink() {
		const url = $page.url.href;
		const text = `Unite a la liga "${data.tournament.name}" en el Prode Mundial 2026! ${url}`;
		try {
			if (navigator.share) {
				await navigator.share({ title: `Liga ${data.tournament.name}`, text, url });
			} else {
				await navigator.clipboard.writeText(text);
				inviteMsg = '¡Link copiado!';
				setTimeout(() => { inviteMsg = ''; }, 2500);
			}
		} catch { /* user cancelled share */ }
	}
</script>

<svelte:head>
	<title>{data.tournament.name} | Tabla</title>
	<meta name="description" content="Tabla de posiciones de la liga {data.tournament.name}. Prode para los amigos, Mundial 2026." />
	<meta property="og:title" content="{data.tournament.name} | Tabla de posiciones ⚽" />
	<meta property="og:description" content="Tabla de posiciones de la liga {data.tournament.name}. Prode para los amigos, Mundial 2026." />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:type" content="image/jpeg" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={$page.url.href} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="{data.tournament.name} | Tabla de posiciones ⚽" />
	<meta name="twitter:description" content="Tabla de posiciones de la liga {data.tournament.name}. Prode para los amigos, Mundial 2026." />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<section class="space-y-8">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-4xl font-black tracking-tight text-slate-900">{data.tournament.name}</h1>
			<p class="mt-1 text-base text-slate-500">Tabla de posiciones de la liga.</p>
		</div>
		<button
			onclick={copyInviteLink}
			class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
		>
			📤 Invitar amigos
		</button>
		{#if inviteMsg}
			<span class="text-xs font-bold text-emerald-600">{inviteMsg}</span>
		{/if}
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
								<a href="/{data.tournament.alias}/prode/{row.nickname}" class="flex items-center gap-2.5 text-blue-600 hover:text-blue-800 hover:underline">
									<UserAvatar nickname={row.nickname} avatarUrl={row.avatarUrl} size="sm" />
									{row.nickname}
								</a>
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
							<th class="pb-3 pl-4 text-center font-semibold">Equipo que avanza</th>
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
									<td class="py-3 pl-4 text-center text-base font-semibold text-violet-600">{sc.bracketTeam}</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- La Pizarra del DT (blog) -->
	{#if data.blogPosts?.length}
		<div class="space-y-4">
			<div class="flex items-center gap-3">
				<img src="/guru-futbol.svg" alt="Gurú Táctico" class="h-8 w-8" />
				<h2 class="text-lg font-black tracking-tight text-slate-900">La Pizarra del DT</h2>
			</div>
			<div class="grid gap-4 md:grid-cols-3">
				{#each data.blogPosts as post}
					<a href="/blog/{post.slug}" class="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
						{#if post.imageUrl}
							<img src={post.imageUrl} alt={post.title} loading="lazy" decoding="async" class="h-32 w-full object-cover" />
						{/if}
						<div class="p-3">
							<h3 class="text-sm font-bold text-slate-800 group-hover:text-sky-600">{post.title}</h3>
							<p class="mt-1 line-clamp-2 text-xs text-slate-500">{post.excerpt}</p>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</section>
