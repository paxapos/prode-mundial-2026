<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from 'flowbite-svelte';

	const STORAGE_KEY = 'yt_intro_seen';
	const VIDEO_ID = 'wU3WE_fhVEo';
	const MIN_SECONDS = 5;

	let visible = $state(false);
	let countdown = $state(MIN_SECONDS);
	let canSkip = $derived(countdown <= 0);
	let muted = $state(true);
	let timer: ReturnType<typeof setInterval> | null = null;
	let player: any = null;
	let playerContainer = $state<HTMLElement>();

	function loadYTApi(): Promise<void> {
		return new Promise((resolve) => {
			if ((window as any).YT?.Player) { resolve(); return; }
			const tag = document.createElement('script');
			tag.src = 'https://www.youtube.com/iframe_api';
			document.head.appendChild(tag);
			(window as any).onYouTubeIframeAPIReady = () => resolve();
		});
	}

	onMount(() => {
		if (typeof localStorage !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
			visible = true;

			loadYTApi().then(() => {
				if (!playerContainer) return;
				player = new (window as any).YT.Player(playerContainer, {
					videoId: VIDEO_ID,
					playerVars: {
						autoplay: 1,
						mute: 1,
						controls: 0,
						modestbranding: 1,
						showinfo: 0,
						rel: 0,
						disablekb: 1,
						fs: 0,
						iv_load_policy: 3,
						playsinline: 1
					},
					events: {
						onReady: () => {
							player.playVideo();
						}
					}
				});
			});

			timer = setInterval(() => {
				countdown--;
				if (countdown <= 0 && timer) {
					clearInterval(timer);
					timer = null;
				}
			}, 1000);
		}

		return () => {
			if (timer) clearInterval(timer);
			if (player?.destroy) player.destroy();
		};
	});

	function toggleMute() {
		if (!player) return;
		if (muted) {
			player.unMute();
			player.setVolume(100);
		} else {
			player.mute();
		}
		muted = !muted;
	}

	function dismiss() {
		visible = false;
		localStorage.setItem(STORAGE_KEY, '1');
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		if (player?.destroy) player.destroy();
	}
</script>

{#if visible}
	<!-- Backdrop -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
		<div class="relative mx-4 w-full max-w-2xl rounded-2xl bg-slate-900 p-4 shadow-2xl">
			<!-- Video -->
			<div class="relative aspect-video w-full overflow-hidden rounded-xl">
				<div bind:this={playerContainer} class="h-full w-full"></div>
				<!-- Invisible overlay to block YouTube hover UI -->
				<div class="absolute inset-0 z-10"></div>
				<!-- Mute toggle button -->
				<button
					onclick={toggleMute}
					class="absolute bottom-3 left-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
					aria-label={muted ? 'Activar sonido' : 'Silenciar'}
				>
					{#if muted}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
						</svg>
					{:else}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728" />
						</svg>
					{/if}
				</button>
			</div>

			<!-- Skip button area -->
			<div class="mt-4 flex items-center justify-between">
				<span class="text-xs italic text-slate-500">Sponsor oficial</span>
				{#if canSkip}
					<Button color="light" size="sm" onclick={dismiss}>
						Omitir ✕
					</Button>
				{:else}
					<span class="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300">
						Podés omitir en {countdown}s
					</span>
				{/if}
			</div>
		</div>
	</div>
{/if}
