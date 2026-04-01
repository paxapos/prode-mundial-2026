<script lang="ts">
	import {
		Alert,
		Badge,
		Button,
		Card,
		Input,
		Label,
		Select,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { getFlagUrl } from '$lib/teams';

	let { data, form } = $props();

	const stageNames: Record<string, string> = {
		groups: 'Fase de Grupos',
		round32: 'Ronda de 32',
		round16: 'Octavos de final',
		quarterfinal: 'Cuartos de final',
		semifinal: 'Semifinal',
		final: 'Final'
	};
</script>

<svelte:head>
	<title>Admin | Prode Mundial 2026</title>
</svelte:head>

<section class="space-y-6">
	<Card>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h1 class="text-3xl font-black tracking-tight text-slate-900">Panel de Administración</h1>
			{#if data.settings}
				<Badge color="yellow">Estado: {data.settings.state}</Badge>
			{/if}
		</div>
	</Card>

	{#if form?.message}
		<Alert color="red">{form.message}</Alert>
	{/if}

	<Card>
		<h2 class="mb-3 text-lg font-bold">Torneos</h2>
		<div class="mb-4 flex flex-wrap gap-2">
			{#each data.tournaments as tournament}
				<a class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100" href={`/admin?t=${tournament.alias}`}>
					{tournament.name}
				</a>
			{/each}
		</div>
		<form method="POST" action="?/createTournament" class="grid gap-3 md:grid-cols-2">
			<div>
				<Label class="mb-2">Nombre torneo</Label>
				<Input name="name" required />
			</div>
			<div>
				<Label class="mb-2">Alias URL</Label>
				<Input name="alias" placeholder="mundial-amigos" />
			</div>
			<div>
				<Label class="mb-2">Imagen Header (opcional)</Label>
				<Input name="headerImageUrl" placeholder="https://..." />
			</div>
			<div>
				<Label class="mb-2">Inicio torneo</Label>
				<Input name="startAt" type="datetime-local" required />
			</div>
			<div>
				<Label class="mb-2">X signo</Label>
				<Input type="number" min="0" name="pointsOutcome" value="1" required />
			</div>
			<div>
				<Label class="mb-2">Y exacto</Label>
				<Input type="number" min="0" name="pointsExact" value="3" required />
			</div>
			<div>
				<Label class="mb-2">Z llave</Label>
				<Input type="number" min="0" name="pointsBracket" value="3" required />
			</div>
			<div class="md:col-span-2">
				<Button type="submit" color="dark">Crear torneo</Button>
			</div>
		</form>
	</Card>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card>
			<h2 class="mb-3 text-lg font-bold">Crear usuario</h2>
			<form method="POST" action="?/createUser" class="space-y-3">
				<div>
					<Label class="mb-2">Mail</Label>
					<Input name="email" type="email" required />
				</div>
				<div>
					<Label class="mb-2">Clave</Label>
					<Input name="password" type="password" minlength={6} maxlength={72} required />
				</div>
				<div>
					<Label class="mb-2">Nickname</Label>
					<Input name="nickname" minlength={3} maxlength={20} placeholder="Opcional" />
				</div>
				<div>
					<Label class="mb-2">Rol</Label>
					<Select name="role">
						<option value="player">Jugador</option>
						<option value="admin">Administrador</option>
					</Select>
				</div>
				<Button type="submit" color="green">Crear usuario</Button>
			</form>
		</Card>

		<Card>
			{#if data.selectedTournament}
				<h2 class="mb-1 text-lg font-bold">Reglas de puntaje</h2>
				<p class="mb-3 text-sm text-slate-500">Torneo activo: {data.selectedTournament.name}</p>
			{/if}
			<form method="POST" action="?/updateRules" class="space-y-3">
				<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
				<div>
					<Label class="mb-2">Puntos por signo (X)</Label>
					<Input type="number" min="0" name="pointsOutcome" value={data.rules?.pointsOutcome ?? 1} required />
				</div>
				<div>
					<Label class="mb-2">Puntos por resultado exacto (Y)</Label>
					<Input type="number" min="0" name="pointsExact" value={data.rules?.pointsExact ?? 3} required />
				</div>
				<div>
					<Label class="mb-2">Puntos por llave acertada (Z)</Label>
					<Input type="number" min="0" name="pointsBracket" value={data.rules?.pointsBracket ?? 3} required />
				</div>
				<Button type="submit" color="blue">Actualizar reglas</Button>
			</form>

			<hr class="my-6 border-slate-200" />

			<h3 class="mb-2 text-base font-bold">Bloqueo global</h3>
			<form method="POST" action="?/lock" class="space-y-3">
				<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
				<div>
					<Label class="mb-2">Motivo</Label>
					<Input name="reason" placeholder="Comenzo el Mundial" />
				</div>
				<Button type="submit" color="yellow">Bloquear prode</Button>
			</form>
		</Card>
	</div>

	<Card>
		<h2 class="mb-4 text-lg font-bold">Usuarios</h2>
		<form method="POST" action="?/assignUser" class="mb-4 grid gap-3 md:grid-cols-3 md:items-end">
			<div>
				<Label class="mb-2">Usuario</Label>
				<Select name="userId">
					{#each data.users as user}
						<option value={user.id}>{user.nickname} ({user.email})</option>
					{/each}
				</Select>
			</div>
			<div>
				<Label class="mb-2">Torneo</Label>
				<Select name="tournamentId">
					{#each data.tournaments as tournament}
						<option value={tournament.id}>{tournament.name}</option>
					{/each}
				</Select>
			</div>
			<Button type="submit" color="green">Asignar a torneo</Button>
		</form>
		<div class="overflow-x-auto">
			<Table hoverable>
				<TableHead>
					<TableHeadCell>Mail</TableHeadCell>
					<TableHeadCell>Nickname</TableHeadCell>
					<TableHeadCell>Rol</TableHeadCell>
				</TableHead>
				<TableBody class="divide-y">
					{#each data.users as user}
						<TableBodyRow>
							<TableBodyCell>{user.email}</TableBodyCell>
							<TableBodyCell class="font-semibold">{user.nickname}</TableBodyCell>
							<TableBodyCell>{user.role}</TableBodyCell>
						</TableBodyRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	</Card>

	<Card>
		<h2 class="mb-4 text-lg font-bold">Agregar partido</h2>
		<form method="POST" action="?/addMatch" class="grid gap-3 md:grid-cols-3">
			<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
			<div>
				<Label class="mb-2">Fase</Label>
				<Select name="stage">
					<option value="groups">Grupos</option>
					<option value="round32">Ronda de 32</option>
					<option value="round16">Octavos</option>
					<option value="quarterfinal">Cuartos</option>
					<option value="semifinal">Semifinal</option>
					<option value="final">Final</option>
				</Select>
			</div>
			<div>
				<Label class="mb-2">Grupo (opcional)</Label>
				<Input name="groupCode" placeholder="A" />
			</div>
			<div>
				<Label class="mb-2">Equipo A</Label>
				<Input name="teamA" required />
			</div>
			<div>
				<Label class="mb-2">Equipo B</Label>
				<Input name="teamB" required />
			</div>
			<div>
				<Label class="mb-2">Fecha y hora</Label>
				<Input name="kickoffAt" type="datetime-local" required />
			</div>
			<div class="flex items-end">
				<Button type="submit" color="dark">Agregar</Button>
			</div>
		</form>
	</Card>

	<div class="grid gap-4">
		{#each data.matches as match}
			<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
				<!-- Match header -->
				<div class="flex items-center justify-between bg-slate-50 px-4 py-2">
					<span class="text-xs font-medium text-slate-500">
						{stageNames[match.stage] ?? match.stage}
						{#if match.groupCode} · Grupo {match.groupCode}{/if}
						 · {new Date(match.kickoffAt).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
					</span>
					{#if match.isClosed}
						<Badge color="dark" class="text-xs">Cerrado</Badge>
					{/if}
				</div>

				<div class="p-4 space-y-3">
					<!-- Team display with flags -->
					<div class="flex items-center justify-between gap-2">
						<div class="flex items-center gap-2">
							{#if getFlagUrl(match.teamA)}
								<img src={getFlagUrl(match.teamA, 48)} alt={match.teamA} class="h-6 w-8 rounded-sm object-cover shadow" />
							{/if}
							<span class="font-semibold text-slate-800">{match.teamA}</span>
						</div>
						<span class="text-lg font-bold text-slate-400">vs</span>
						<div class="flex items-center gap-2">
							<span class="font-semibold text-slate-800">{match.teamB}</span>
							{#if getFlagUrl(match.teamB)}
								<img src={getFlagUrl(match.teamB, 48)} alt={match.teamB} class="h-6 w-8 rounded-sm object-cover shadow" />
							{/if}
						</div>
					</div>

					<!-- Update team names (knockout only) -->
					{#if match.stage !== 'groups'}
						<details class="rounded-lg border border-slate-200 p-3">
							<summary class="cursor-pointer text-xs font-medium text-slate-500">Editar equipos (llave)</summary>
							<form method="POST" action="?/updateMatch" class="mt-2 grid gap-2 md:grid-cols-3 md:items-end">
								<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
								<input type="hidden" name="matchId" value={match.id} />
								<div>
									<Label class="mb-1 text-xs">Equipo A</Label>
									<Input name="teamA" value={match.teamA} size="sm" />
								</div>
								<div>
									<Label class="mb-1 text-xs">Equipo B</Label>
									<Input name="teamB" value={match.teamB} size="sm" />
								</div>
								<Button type="submit" size="xs" color="light">Actualizar equipos</Button>
							</form>
						</details>
					{/if}

					<!-- Set result -->
					<form method="POST" action="?/saveResult" class="space-y-3">
						<input type="hidden" name="tournamentId" value={data.selectedTournament?.id} />
						<input type="hidden" name="matchId" value={match.id} />
						<div class="grid gap-3 md:grid-cols-2">
							<div>
								<Label class="mb-2">Score {match.teamA}</Label>
								<Input name="scoreA" type="number" min="0" required value={match.scoreA ?? ''} />
							</div>
							<div>
								<Label class="mb-2">Score {match.teamB}</Label>
								<Input name="scoreB" type="number" min="0" required value={match.scoreB ?? ''} />
							</div>
						</div>

						{#if match.stage !== 'groups'}
							<div>
								<Label class="mb-2">Ganador por penales</Label>
								<Select name="penaltyWinner">
									<option value="" selected={!match.penaltyWinner}>Sin penales</option>
									<option value="A" selected={match.penaltyWinner === 'A'}>{match.teamA}</option>
									<option value="B" selected={match.penaltyWinner === 'B'}>{match.teamB}</option>
								</Select>
							</div>
						{/if}

						<Button type="submit" color="blue">Guardar resultado</Button>
					</form>
				</div>
			</div>
		{/each}
	</div>
</section>
