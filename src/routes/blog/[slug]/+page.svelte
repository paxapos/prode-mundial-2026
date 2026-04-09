<script lang="ts">
	let { data } = $props();

	const IMAGE_URL_RE = /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg)(\?\S*)?$/i;

	function renderBody(body: string): string {
		const paragraphs = body.split(/\n\s*\n/);
		return paragraphs
			.map((p) => {
				const trimmed = p.trim();
				if (!trimmed) return '';
				if (IMAGE_URL_RE.test(trimmed)) {
					return `<figure class="my-4"><img src="${escapeHtml(trimmed)}" alt="" class="w-full rounded-lg shadow-sm" loading="lazy" /></figure>`;
				}
				const lines = trimmed.split('\n').map((l) => escapeHtml(l.trim())).join('<br>');
				return `<p class="mb-4 leading-relaxed text-slate-700">${lines}</p>`;
			})
			.join('');
	}

	function escapeHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('es-AR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'America/Argentina/Buenos_Aires'
		});
	}
</script>

<svelte:head>
	<title>{data.post.title} | La Pizarra del DT</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-6">
	<a href="/" class="inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700">
		← Volver al inicio
	</a>

	{#if data.post.imageUrl}
		<img src={data.post.imageUrl} alt={data.post.title} class="w-full rounded-2xl object-cover shadow-md" style="max-height: 400px;" />
	{/if}

	<div>
		<h1 class="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{data.post.title}</h1>
		<p class="mt-2 text-sm text-slate-400">
			Por <span class="font-semibold text-slate-600">{data.post.authorNickname}</span> · {formatDate(data.post.createdAt)}
		</p>
	</div>

	<div class="text-base">
		{@html renderBody(data.post.body)}
	</div>
</section>
