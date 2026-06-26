<script lang="ts">
	let { data } = $props();

	let pageNumbers = $derived.by(() => {
		const total = data.pagination?.totalPages ?? 1;
		const current = data.pagination?.page ?? 1;
		const end = Math.min(total, Math.max(5, current + 2));
		const start = Math.max(1, Math.min(current - 2, end - 4));
		return Array.from({ length: end - start + 1 }, (_, index) => start + index);
	});

	function pageHref(page: number): string {
		return page === 1 ? '/blog' : `/blog?page=${page}`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>La Pizarra del DT | Prode Mundial 2026</title>
	<meta name="description" content="Análisis tácticos y columnas del Mundial 2026" />
</svelte:head>

<section class="space-y-6">
	<div class="flex items-center gap-3">
		<img src="/guru-futbol.svg" alt="Gurú Táctico" class="h-10 w-10" />
		<div>
			<h1 class="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">La Pizarra del DT</h1>
			<p class="text-xs text-slate-400">Análisis tácticos y columnas del Mundial 2026</p>
		</div>
	</div>

	{#if data.posts?.length}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each data.posts as post}
				<a href="/blog/{post.slug}" class="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
					{#if post.imageUrl}
						<img src={post.imageUrl} alt={post.title} loading="lazy" decoding="async" class="h-44 w-full object-cover" />
					{/if}
					<div class="flex flex-1 flex-col p-4">
						<h2 class="font-bold text-slate-800 group-hover:text-sky-600">{post.title}</h2>
						<p class="mt-1 line-clamp-3 flex-1 text-sm text-slate-500">{post.excerpt}</p>
						<p class="mt-3 text-xs text-slate-400">{formatDate(post.createdAt)}</p>
					</div>
				</a>
			{/each}
		</div>

		{#if data.pagination?.totalPages > 1}
			<nav class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Paginación de artículos">
				<p class="text-xs font-semibold text-slate-400">
					Página {data.pagination.page} de {data.pagination.totalPages} · {data.pagination.total} columnas
				</p>
				<div class="flex flex-wrap gap-2">
					<a
						href={pageHref(Math.max(1, data.pagination.page - 1))}
						aria-disabled={data.pagination.page === 1}
						class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
					>
						Anterior
					</a>
					{#each pageNumbers as page}
						<a
							href={pageHref(page)}
							aria-current={page === data.pagination.page ? 'page' : undefined}
							class="rounded-lg border px-3 py-2 text-xs font-bold transition-colors {page === data.pagination.page ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}"
						>
							{page}
						</a>
					{/each}
					<a
						href={pageHref(Math.min(data.pagination.totalPages, data.pagination.page + 1))}
						aria-disabled={data.pagination.page === data.pagination.totalPages}
						class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
					>
						Siguiente
					</a>
				</div>
			</nav>
		{/if}
	{:else}
		<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-12 text-center text-sm font-semibold text-slate-400">
			Todavía no hay columnas publicadas.
		</div>
	{/if}
</section>
