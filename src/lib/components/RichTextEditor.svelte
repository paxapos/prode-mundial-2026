<script lang="ts">
	interface Props {
		value: string;
		name: string;
		placeholder?: string;
	}

	let { value = $bindable(''), name, placeholder = 'Escribí acá...' }: Props = $props();

	let editorElement = $state<HTMLDivElement>();

	// Synchronize external value changes to editor (e.g. when loading an existing post or resetting)
	$effect(() => {
		if (editorElement && editorElement.innerHTML !== value) {
			editorRefValueUpdate(value);
		}
	});

	function editorRefValueUpdate(val: string) {
		if (editorElement) {
			editorElement.innerHTML = val || '';
		}
	}

	function handleInput() {
		if (editorElement) {
			value = editorElement.innerHTML;
		}
	}

	function execCommand(command: string, val: string = '') {
		document.execCommand(command, false, val);
		handleInput();
		if (editorElement) {
			editorElement.focus();
		}
	}

	function linkPrompt() {
		const url = prompt('Ingresá la URL del enlace:');
		if (url) {
			const cleanUrl = url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`;
			execCommand('createLink', cleanUrl);
		}
	}

	function youtubePrompt() {
		const input = prompt('Ingresá la URL de YouTube o el código de inserción (iframe):');
		if (!input) return;
		const id = extractYoutubeId(input);
		if (id) {
			const iframeHtml = `<iframe src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe>`;
			execCommand('insertHTML', iframeHtml);
		} else {
			alert('No se pudo reconocer un enlace o código de YouTube válido.');
		}
	}

	function extractYoutubeId(url: string): string | null {
		if (url.includes('<iframe')) {
			const match = url.match(/src=["']([^"']+)["']/);
			if (match) url = match[1];
		}
		const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
		if (shortsMatch) return shortsMatch[1];
		
		const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
		const match = url.match(regExp);
		return (match && match[2].length === 11) ? match[2] : null;
	}
</script>

<div class="border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20">
	<!-- Toolbar -->
	<div class="flex flex-wrap items-center gap-1 bg-slate-50 p-2 border-b border-slate-200">
		<button type="button" onclick={() => execCommand('bold')} class="p-1.5 rounded hover:bg-slate-200 text-slate-700 font-bold" title="Negrita">B</button>
		<button type="button" onclick={() => execCommand('italic')} class="p-1.5 rounded hover:bg-slate-200 text-slate-700 italic" title="Itálica">I</button>
		<button type="button" onclick={() => execCommand('underline')} class="p-1.5 rounded hover:bg-slate-200 text-slate-700 underline" title="Subrayado">U</button>
		<div class="h-6 w-[1px] bg-slate-200 mx-1"></div>
		<button type="button" onclick={() => execCommand('formatBlock', 'h2')} class="p-1.5 rounded hover:bg-slate-200 text-slate-700 text-xs font-bold" title="Título grande">H2</button>
		<button type="button" onclick={() => execCommand('formatBlock', 'h3')} class="p-1.5 rounded hover:bg-slate-200 text-slate-700 text-xs font-bold" title="Título mediano">H3</button>
		<button type="button" onclick={() => execCommand('formatBlock', 'p')} class="p-1.5 rounded hover:bg-slate-200 text-slate-700 text-xs" title="Párrafo">P</button>
		<div class="h-6 w-[1px] bg-slate-200 mx-1"></div>
		<button type="button" onclick={() => execCommand('insertUnorderedList')} class="p-1.5 rounded hover:bg-slate-200 text-slate-700" title="Lista con viñetas">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16M4 6h.01M4 12h.01M4 18h.01"></path></svg>
		</button>
		<button type="button" onclick={() => execCommand('insertOrderedList')} class="p-1.5 rounded hover:bg-slate-200 text-slate-700" title="Lista numerada">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16M4 6h.01M4 12h.01M4 18h.01"></path></svg>
		</button>
		<div class="h-6 w-[1px] bg-slate-200 mx-1"></div>
		<button type="button" onclick={linkPrompt} class="p-1.5 rounded hover:bg-slate-200 text-slate-700" title="Insertar enlace">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
		</button>
		<button type="button" onclick={youtubePrompt} class="p-1.5 rounded hover:bg-slate-200 text-red-600" title="Insertar Video de YouTube">
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
		</button>
	</div>

	<!-- Editor area -->
	<div
		bind:this={editorElement}
		contenteditable="true"
		oninput={handleInput}
		class="p-4 min-h-[300px] outline-none prose max-w-none focus:outline-none"
		placeholder={placeholder}
	></div>

	<!-- Hidden input to submit via standard form -->
	<input type="hidden" {name} value={value} />
</div>

<style>
	[contenteditable]:empty::before {
		content: attr(placeholder);
		color: #94a3b8;
		pointer-events: none;
		display: block;
	}
	/* Add some basic editor styling */
	[contenteditable] {
		outline: none;
	}
	[contenteditable] :global(iframe) {
		max-width: 100%;
		aspect-ratio: 16 / 9;
		display: block;
		margin: 1rem 0;
	}
</style>
