<script lang="ts">
	import { Card, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell } from 'flowbite-svelte';
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.tournament.name} | Tabla</title>
</svelte:head>

<section class="space-y-6">
	<Card>
		<h1 class="text-3xl font-black tracking-tight">{data.tournament.name}</h1>
		<p class="text-sm text-slate-600">Tabla de participantes para este torneo.</p>
	</Card>

	<Card>
		<div class="overflow-x-auto">
			<Table hoverable>
				<TableHead>
					<TableHeadCell>#</TableHeadCell>
					<TableHeadCell>Jugador</TableHeadCell>
					<TableHeadCell>Puntos</TableHeadCell>
					<TableHeadCell>Exactos</TableHeadCell>
					<TableHeadCell>Signos</TableHeadCell>
				</TableHead>
				<TableBody class="divide-y">
					{#if data.leaderboard.length === 0}
						<TableBodyRow>
							<TableBodyCell colspan={5}>No hay participantes asignados.</TableBodyCell>
						</TableBodyRow>
					{:else}
						{#each data.leaderboard as row, index}
							<TableBodyRow>
								<TableBodyCell>{index + 1}</TableBodyCell>
								<TableBodyCell class="font-semibold">{row.nickname}</TableBodyCell>
								<TableBodyCell>{row.totalPoints}</TableBodyCell>
								<TableBodyCell>{row.exactHits}</TableBodyCell>
								<TableBodyCell>{row.outcomeHits}</TableBodyCell>
							</TableBodyRow>
						{/each}
					{/if}
				</TableBody>
			</Table>
		</div>
	</Card>
</section>
