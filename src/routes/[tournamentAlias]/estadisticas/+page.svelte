<script lang="ts">
	import { page } from '$app/stores';

	let { data } = $props();

	// Some animations classes for staggered entrance
	const slideIn = "animate-in slide-in-from-bottom-4 fade-in duration-500 fill-mode-both";
</script>

<svelte:head>
	<title>Estadísticas | {data.tournament.name}</title>
</svelte:head>

<section class="space-y-8 pb-12">
	<!-- Header -->
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<a href="/{data.tournament.alias}" class="inline-flex items-center gap-2 mb-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
				&larr; Volver a la liga
			</a>
			<h1 class="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600">
				Estadísticas y Curiosidades
			</h1>
			<p class="mt-2 text-lg text-slate-500">¿Qué predijeron los {data.totalParticipants} participantes de {data.tournament.name}?</p>
		</div>
	</div>

	{#if data.totalParticipants === 0}
		<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
			Aún no hay participantes en esta liga para mostrar estadísticas.
		</div>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			
			<!-- Datos Rápidos de la Liga -->
			<div class="col-span-full grid gap-4 grid-cols-2 lg:grid-cols-4">
				<!-- Tarjeta 1: Score más común -->
				<div class="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] {slideIn}" style="animation-delay: 50ms">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl">🎯</span>
						<div class="min-w-0">
							<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score Más Común</p>
							<p class="text-lg font-black text-slate-900 truncate">
								{data.stats.mostCommonScore?.score ?? 'N/A'}
							</p>
						</div>
					</div>
					{#if data.stats.mostCommonScore}
						<p class="mt-2 text-xs text-slate-500">Representa el {data.stats.mostCommonScore.percentage}% de los pronósticos.</p>
					{/if}
				</div>

				<!-- Tarjeta 2: Promedio de Goles -->
				<div class="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] {slideIn}" style="animation-delay: 100ms">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">⚽</span>
						<div>
							<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Goles por Partido</p>
							<p class="text-lg font-black text-slate-900">{data.stats.averageGoalsPerMatch}</p>
						</div>
					</div>
					<p class="mt-2 text-xs text-slate-500">
						{#if data.stats.averageGoalsPerMatch === 0}
							Sin pronósticos todavía.
						{:else if data.stats.averageGoalsPerMatch >= 3}
							¡La liga espera lluvia de goles!
						{:else}
							Expectativa de partidos cerrados.
						{/if}
					</p>
				</div>

				<!-- Tarjeta 3: Partido con más goles -->
				<div class="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] {slideIn}" style="animation-delay: 150ms">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-xl">🔥</span>
						<div class="min-w-0 flex-1">
							<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Partido Más Goleador</p>
							{#if data.stats.matchWithMostGoals}
								<p class="text-sm font-black text-slate-900 truncate" title="{data.stats.matchWithMostGoals.teamA} vs {data.stats.matchWithMostGoals.teamB}">
									{data.stats.matchWithMostGoals.teamA} - {data.stats.matchWithMostGoals.teamB}
								</p>
							{:else}
								<p class="text-lg font-black text-slate-900">N/A</p>
							{/if}
						</div>
					</div>
					{#if data.stats.matchWithMostGoals}
						<p class="mt-2 text-xs text-slate-500">Promedio de {data.stats.matchWithMostGoals.avgGoals} goles esperados.</p>
					{/if}
				</div>

				<!-- Tarjeta 4: Completado Promedio -->
				<div class="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] {slideIn}" style="animation-delay: 200ms">
					<div class="flex items-center gap-3">
						<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl">📈</span>
						<div>
							<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Progreso Promedio</p>
							<p class="text-lg font-black text-slate-900">{data.stats.averageCompletionPercentage}%</p>
						</div>
					</div>
					<p class="mt-2 text-xs text-slate-500">Porcentaje de prode completado por usuario.</p>
				</div>
			</div>

			<!-- Campeones Elegidos -->
			<div class="col-span-full rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] {slideIn}" style="animation-delay: 300ms">
				<h2 class="mb-6 text-2xl font-black text-slate-800">🏆 Favoritos para Campeón</h2>
				
				{#if data.champions.length === 0}
					<p class="text-slate-500">Nadie ha completado su bracket hasta la final todavía.</p>
				{:else}
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each data.champions as champ, i}
							<div class="relative overflow-hidden rounded-2xl bg-gradient-to-br {i === 0 ? 'from-amber-100 to-orange-50 border-amber-200' : i === 1 ? 'from-slate-100 to-gray-50 border-slate-200' : i === 2 ? 'from-orange-100 to-rose-50 border-orange-200' : 'from-blue-50 to-indigo-50 border-blue-100'} border p-6 transition-transform hover:-translate-y-1">
								{#if i === 0}
									<div class="absolute -right-4 -top-4 text-6xl opacity-20">🥇</div>
								{:else if i === 1}
									<div class="absolute -right-4 -top-4 text-6xl opacity-20">🥈</div>
								{:else if i === 2}
									<div class="absolute -right-4 -top-4 text-6xl opacity-20">🥉</div>
								{/if}
								
								<div class="relative z-10 flex flex-col h-full justify-between gap-4">
									<div>
										<span class="text-xs font-bold uppercase tracking-wider text-slate-500">#{i + 1} Más elegido</span>
										<h3 class="mt-1 text-2xl font-black text-slate-900">{champ.team}</h3>
									</div>
									<div class="flex items-end gap-2">
										<span class="text-4xl font-black {i === 0 ? 'text-amber-600' : i === 1 ? 'text-slate-600' : i === 2 ? 'text-orange-600' : 'text-blue-600'}">{champ.percentage}%</span>
										<span class="mb-1 text-sm font-semibold text-slate-500">de la liga</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Partido Inaugural Curiosidad -->
			<div class="col-span-full md:col-span-1 rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] {slideIn}" style="animation-delay: 400ms">
				<h2 class="mb-2 text-xl font-black text-emerald-900">🇲🇽 México vs 🇿🇦 Sudáfrica</h2>
				<p class="mb-6 text-sm font-medium text-emerald-700">El partido inaugural del mundial. ¿Qué opina la liga?</p>
				
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="font-bold text-slate-700">Gana México</span>
						<span class="font-black text-emerald-600">{data.mexicoVsSudafrica.mexico}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-white">
						<div class="h-full bg-emerald-500 transition-all duration-1000" style="width: {data.mexicoVsSudafrica.mexico}%"></div>
					</div>
					
					<div class="flex items-center justify-between pt-2">
						<span class="font-bold text-slate-700">Empate</span>
						<span class="font-black text-slate-500">{data.mexicoVsSudafrica.draw}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-white">
						<div class="h-full bg-slate-400 transition-all duration-1000" style="width: {data.mexicoVsSudafrica.draw}%"></div>
					</div>

					<div class="flex items-center justify-between pt-2">
						<span class="font-bold text-slate-700">Gana Sudáfrica</span>
						<span class="font-black text-rose-600">{data.mexicoVsSudafrica.sudafrica}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-white">
						<div class="h-full bg-rose-500 transition-all duration-1000" style="width: {data.mexicoVsSudafrica.sudafrica}%"></div>
					</div>
				</div>
			</div>

			<!-- Probabilidades Historicas -->
			<div class="col-span-full md:col-span-2 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] {slideIn}" style="animation-delay: 500ms">
				<h2 class="mb-2 text-xl font-black text-slate-800">📚 Historia y Probabilidades Reales</h2>
				<p class="mb-6 text-sm text-slate-500">¿Qué dicen las estadísticas de todos los mundiales sobre quién podría ganar en 2026?</p>

				<div class="grid gap-4 sm:grid-cols-2">
					{#each data.historicalProbs as prob}
						<div class="group relative flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-100/50">
							<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-blue-600 shadow-sm">
								{prob.prob}%
							</div>
							<div>
								<h3 class="font-bold text-slate-900">{prob.team}</h3>
								<p class="mt-1 text-xs leading-relaxed text-slate-600">{prob.reason}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>

		</div>
	{/if}
</section>
