<script lang="ts">
	import { page } from '$app/stores';
	import { Alert, Badge } from 'flowbite-svelte';

	let { data, children } = $props();

	const navItems = [
		{ href: '/admin/resultados/carga', label: 'Resultados', icon: '⚽', startsWith: '/admin/resultados' },
		{ href: '/admin/resultados/fixture', label: 'Fixture', icon: '📅', startsWith: '/admin/resultados/fixture' },
		{ href: '/admin/ligas', label: 'Ligas', icon: '🏆', startsWith: '/admin/ligas' },
		{ href: '/admin/usuarios', label: 'Usuarios', icon: '👥', startsWith: '/admin/usuarios' },
		{ href: '/admin/blog', label: 'Blog', icon: '📝', startsWith: '/admin/blog' },
		{ href: '/admin/config', label: 'Config', icon: '⚙️', startsWith: '/admin/config' }
	] as const;

	const resultsItems = [
		{ href: '/admin/resultados/fixture', label: 'Fixture completo' },
		{ href: '/admin/resultados/carga', label: 'Resultados' },
		{ href: '/admin/resultados/desempates', label: 'Desempates' }
	] as const;

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

	function withTournament(href: string) {
		const alias = data.selectedTournament?.alias;
		return alias ? `${href}?t=${alias}` : href;
	}
</script>

<svelte:head>
	<title>Admin | Prode Mundial 2026</title>
</svelte:head>

<section class="space-y-6">
	<div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
		<div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-500/10 blur-2xl"></div>
		<div class="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl"></div>
		<div class="relative flex flex-wrap items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl backdrop-blur">⚙️</div>
				<div>
					<h1 class="text-2xl font-black tracking-tight md:text-3xl">Panel de Administración</h1>
					<p class="text-sm text-white/50">{data.selectedTournament?.name ?? 'Sin competición seleccionada'}</p>
				</div>
			</div>
			{#if data.settings}
				<Badge color={stateTone[data.settings.state] ?? 'yellow'} class="text-xs">
					{stateLabel[data.settings.state] ?? data.settings.state}
				</Badge>
			{/if}
		</div>
	</div>

	{#if $page.form?.message}
		<Alert color="red" class="font-medium">{$page.form.message}</Alert>
	{/if}
	{#if $page.form?.ok}
		<Alert color="green" class="font-medium">Operación realizada con éxito.</Alert>
	{/if}

	<div class="sticky top-[4.5rem] z-10 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur">
		<div class="flex gap-1">
			{#each navItems as item}
				{@const isActive = item.startsWith === '/admin/resultados' ? $page.url.pathname.startsWith('/admin/resultados') : $page.url.pathname.startsWith(item.startsWith)}
				<a
					href={withTournament(item.href)}
					class="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all {isActive ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}"
				>
					<span class="text-base">{item.icon}</span>
					<span>{item.label}</span>
				</a>
			{/each}
		</div>
	</div>

	{#if $page.url.pathname.startsWith('/admin/resultados')}
		<div class="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
			{#each resultsItems as item}
				<a
					href={withTournament(item.href)}
					class="rounded-lg px-3 py-2 text-xs font-bold transition-all {$page.url.pathname === item.href ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}"
				>
					{item.label}
				</a>
			{/each}
		</div>
	{/if}

	{@render children()}
</section>