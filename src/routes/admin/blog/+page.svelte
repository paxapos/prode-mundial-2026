<script lang="ts">
	import { enhance } from '$app/forms';
	import type { BlogPost } from '$lib/types';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';

	let { data } = $props();
	let editingPostId = $state<string | null>(null);
	let editTitle = $state('');
	let editExcerpt = $state('');
	let editBody = $state('');
	let editRemoveImage = $state(false);
	let newBody = $state('');

	function startEditPost(post: BlogPost) {
		editingPostId = post.id;
		editTitle = post.title;
		editExcerpt = post.excerpt;
		editBody = post.body;
		editRemoveImage = false;
	}

	function resetEditPostEditor() {
		editingPostId = null;
		editTitle = '';
		editExcerpt = '';
		editBody = '';
		editRemoveImage = false;
	}
</script>

<div class="space-y-6">
	<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<h2 class="mb-1 text-lg font-black text-slate-800">✍️ Escribir nueva columna</h2>
		<p class="mb-4 text-xs text-slate-400">Título, descripción corta, imagen principal y contenido. Podés pegar HTML básico si necesitás formato.</p>

		<form method="POST" action="?/createPost" enctype="multipart/form-data" use:enhance={() => { return async ({ update, result }) => { await update(); if (result.type === 'success') newBody = ''; }; }} class="space-y-4">
			<div>
				<label for="post-title" class="mb-1 block text-xs font-bold text-slate-500">Título</label>
				<input id="post-title" name="title" type="text" required placeholder="Ej: Por qué Scaloni es un genio táctico" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
			</div>
			<div>
				<label for="post-excerpt" class="mb-1 block text-xs font-bold text-slate-500">Descripción corta</label>
				<input id="post-excerpt" name="excerpt" type="text" required placeholder="Una o dos oraciones que resuman la columna" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
			</div>
			<div>
				<label for="post-image" class="mb-1 block text-xs font-bold text-slate-500">Imagen principal</label>
				<input id="post-image" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-sky-700 hover:file:bg-sky-200" />
				<p class="mt-1 text-[11px] text-slate-400">JPG, PNG, WebP o GIF hasta 20 MB.</p>
			</div>
			<div>
				<label for="post-body" class="mb-1 block text-xs font-bold text-slate-500">Contenido de la columna</label>
				<RichTextEditor name="body" bind:value={newBody} placeholder="Escribí acá tu columna..." />
			</div>
			<button type="submit" class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">📤 Publicar columna</button>
		</form>
	</div>

	<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<h2 class="mb-4 text-lg font-black text-slate-800">Columnas publicadas</h2>
		{#if data.blogPosts?.length}
			<div class="space-y-3">
				{#each data.blogPosts as post}
					{#if editingPostId === post.id}
						<form method="POST" action="?/editPost" enctype="multipart/form-data" use:enhance={() => { return async ({ update }) => { await update(); resetEditPostEditor(); }; }} class="space-y-4 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
							<input type="hidden" name="postId" value={post.id} />
							<div class="grid gap-3 md:grid-cols-2">
								<div>
									<label for={`edit-post-title-${post.id}`} class="mb-1 block text-xs font-bold text-slate-500">Título</label>
									<input id={`edit-post-title-${post.id}`} name="title" bind:value={editTitle} required class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
								</div>
								<div>
									<label for={`edit-post-excerpt-${post.id}`} class="mb-1 block text-xs font-bold text-slate-500">Descripción corta</label>
									<input id={`edit-post-excerpt-${post.id}`} name="excerpt" bind:value={editExcerpt} required class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
								</div>
							</div>
							<div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
								<div>
									<label for={`edit-post-image-${post.id}`} class="mb-1 block text-xs font-bold text-slate-500">Reemplazar imagen principal</label>
									<input id={`edit-post-image-${post.id}`} name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-sky-700 hover:file:bg-sky-200" />
								</div>
								{#if post.imageUrl}
									<label class="flex items-center gap-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-600"><input type="checkbox" name="removeImage" bind:checked={editRemoveImage} class="rounded border-red-200 text-red-600 focus:ring-red-500" /> Quitar imagen</label>
								{/if}
							</div>
							{#if post.imageUrl && !editRemoveImage}<img src={post.imageUrl} alt={post.title} loading="lazy" decoding="async" class="h-28 w-full rounded-lg object-cover shadow-sm" />{/if}
							<div>
								<label for={`edit-post-body-${post.id}`} class="mb-1 block text-xs font-bold text-slate-500">Contenido</label>
								<RichTextEditor name="body" bind:value={editBody} placeholder="Escribí acá tu columna..." />
							</div>
							<div class="flex flex-wrap justify-end gap-2">
								<button type="button" onclick={resetEditPostEditor} class="rounded-lg bg-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-300">Cancelar</button>
								<button type="submit" class="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">Guardar cambios</button>
							</div>
						</form>
					{:else}
						<div class="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
							<div class="min-w-0 flex-1">
								<h3 class="truncate font-bold text-slate-800">{post.title}</h3>
								<p class="mt-0.5 text-xs text-slate-400">Por {post.authorNickname} · {new Date(post.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
								<p class="mt-1 line-clamp-2 text-sm text-slate-500">{post.excerpt}</p>
							</div>
							<div class="flex shrink-0 gap-2">
								<button type="button" onclick={() => startEditPost(post)} class="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100">✏️</button>
								<form method="POST" action="?/deletePost" use:enhance={() => { return async ({ update }) => { if (confirm('¿Eliminar esta columna?')) await update(); }; }}>
									<input type="hidden" name="postId" value={post.id} />
									<button type="submit" class="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">🗑️</button>
								</form>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<p class="text-center text-sm text-slate-400">No hay columnas publicadas todavía.</p>
		{/if}
	</div>
</div>