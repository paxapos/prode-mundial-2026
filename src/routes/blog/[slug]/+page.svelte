<script lang="ts">
	let { data } = $props();

	const IMAGE_URL_RE = /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg)(\?\S*)?$/i;
	const RICH_BODY_RE = /<\/?(p|h2|h3|ul|ol|li|blockquote|strong|em|u|s|a|br)\b/i;

	let showModal = $state(false);
	let scale = $state(1);
	let translateX = $state(0);
	let translateY = $state(0);
	let startDistance = $state(0);
	let startScale = $state(1);
	let isPanning = $state(false);
	let panStartX = $state(0);
	let panStartY = $state(0);
	let startTranslateX = $state(0);
	let startTranslateY = $state(0);

	function openModal() {
		showModal = true;
		scale = 1;
		translateX = 0;
		translateY = 0;
		document.body.style.overflow = 'hidden';
	}

	function closeModal() {
		showModal = false;
		document.body.style.overflow = '';
	}

	function handleModalClick(e: MouseEvent) {
		if (scale > 1) {
			scale = 1;
			translateX = 0;
			translateY = 0;
		} else {
			closeModal();
		}
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length === 2) {
			e.preventDefault();
			startDistance = getDistance(e.touches[0], e.touches[1]);
			startScale = scale;
		} else if (e.touches.length === 1 && scale > 1) {
			isPanning = true;
			panStartX = e.touches[0].clientX;
			panStartY = e.touches[0].clientY;
			startTranslateX = translateX;
			startTranslateY = translateY;
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.touches.length === 2) {
			e.preventDefault();
			const dist = getDistance(e.touches[0], e.touches[1]);
			const newScale = Math.min(Math.max(startScale * (dist / startDistance), 1), 5);
			scale = newScale;
			if (newScale === 1) {
				translateX = 0;
				translateY = 0;
			}
		} else if (e.touches.length === 1 && isPanning && scale > 1) {
			e.preventDefault();
			translateX = startTranslateX + (e.touches[0].clientX - panStartX);
			translateY = startTranslateY + (e.touches[0].clientY - panStartY);
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		isPanning = false;
		if (e.touches.length < 2) {
			startDistance = 0;
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		const newScale = Math.min(Math.max(scale * delta, 1), 5);
		scale = newScale;
		if (newScale === 1) {
			translateX = 0;
			translateY = 0;
		}
	}

	function getDistance(t1: Touch, t2: Touch): number {
		return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (showModal && e.key === 'Escape') closeModal();
	}

	function renderBody(body: string): string {
		if (RICH_BODY_RE.test(body)) return body;

		const paragraphs = body.split(/\n\s*\n/);
		return paragraphs
			.map((p) => {
				const trimmed = p.trim();
				if (!trimmed) return '';
				if (IMAGE_URL_RE.test(trimmed)) {
					return `<figure class="my-4"><img src="${escapeHtml(trimmed)}" alt="" class="h-auto w-full rounded-lg shadow-sm" loading="lazy" /></figure>`;
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

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{data.post.title} | La Pizarra del DT</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-6">
	<a href="/" class="inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700">
		← Volver al inicio
	</a>

	{#if data.post.imageUrl}
		<button type="button" onclick={openModal} class="group w-full cursor-zoom-in overflow-hidden rounded-2xl shadow-md transition-shadow hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-sky-300/50">
			<img src={data.post.imageUrl} alt={data.post.title} decoding="async" class="h-auto w-full rounded-2xl transition-transform duration-300 group-hover:scale-[1.02]" />
		</button>
	{/if}

	<div>
		<h1 class="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{data.post.title}</h1>
		<p class="mt-2 text-sm text-slate-400">
			{formatDate(data.post.createdAt)}
		</p>
	</div>

	<div class="space-y-4 text-base leading-relaxed text-slate-700 [&_a]:font-semibold [&_a]:text-sky-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-900 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
		{@html renderBody(data.post.body)}
	</div>
</section>

{#if showModal && data.post.imageUrl}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-300"
		class:opacity-100={showModal}
		onclick={handleModalClick}
		onkeydown={(e) => { if (e.key === 'Escape') closeModal(); }}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		onwheel={handleWheel}
		role="dialog"
		aria-modal="true"
		aria-label="Imagen ampliada"
		tabindex="-1"
	>
		<button type="button" onclick={closeModal} class="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20" aria-label="Cerrar">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
		<p class="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50 select-none">Pellizcar para zoom · Click para cerrar</p>
		<img
			src={data.post.imageUrl}
			alt={data.post.title}
			class="max-h-[90vh] max-w-[95vw] rounded-lg object-contain transition-transform duration-200 ease-out select-none"
			style="transform: scale({scale}) translate({translateX / scale}px, {translateY / scale}px)"
			draggable="false"
		/>
	</div>
{/if}
