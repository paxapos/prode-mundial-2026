<script lang="ts">
	/**
	 * Renders a user avatar: profile image if available,
	 * or a colored circle with initials if not.
	 */

	interface Props {
		nickname: string;
		avatarUrl?: string | null;
		size?: 'sm' | 'md' | 'lg';
	}

	let { nickname, avatarUrl = null, size = 'md' }: Props = $props();

	const sizes = {
		sm: 'h-7 w-7 text-[10px]',
		md: 'h-9 w-9 text-xs',
		lg: 'h-12 w-12 text-base'
	};

	/** Generate a deterministic pastel-ish color from a nickname */
	function nicknameColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		const hue = ((hash % 360) + 360) % 360;
		return `hsl(${hue}, 55%, 45%)`;
	}

	const initial = $derived(nickname.charAt(0).toUpperCase());
	const bgColor = $derived(nicknameColor(nickname));
	const sizeClass = $derived(sizes[size]);
</script>

{#if avatarUrl}
	<img
		src={avatarUrl}
		alt={nickname}
		class="shrink-0 rounded-full object-cover shadow-sm {sizeClass}"
		referrerpolicy="no-referrer"
	/>
{:else}
	<span
		class="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm {sizeClass}"
		style="background-color: {bgColor}"
	>
		{initial}
	</span>
{/if}
