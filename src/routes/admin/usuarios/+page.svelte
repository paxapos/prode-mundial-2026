<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();
	let editingUserId = $state<string | null>(null);
	let editNickname = $state('');
	let editRole = $state<'player' | 'admin'>('player');

	function startEdit(user: { id: string; nickname: string; role: string }) {
		editingUserId = user.id;
		editNickname = user.nickname;
		editRole = user.role as 'player' | 'admin';
	}
	function cancelEdit() {
		editingUserId = null;
	}
</script>

<div class="space-y-6">
	{#if data.ligas.length > 0}
		<div class="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
			<p class="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600">Inscribir jugadores en ligas</p>
			<div class="flex flex-wrap gap-2">
				{#each data.ligas as liga}<a href={`/admin/ligas?t=${liga.alias}`} class="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-200">⚙️ {liga.name}</a>{/each}
			</div>
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-3">
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<h2 class="mb-1 text-base font-black text-slate-800">Crear usuario</h2>
			<form method="POST" action="?/createUser" use:enhance class="mt-3 space-y-3">
				<div><span class="mb-1 block text-xs font-bold text-slate-500">Email</span><input name="email" type="email" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" /></div>
				<div><span class="mb-1 block text-xs font-bold text-slate-500">Contraseña</span><input name="password" type="password" minlength={6} maxlength={72} required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" /></div>
				<div><span class="mb-1 block text-xs font-bold text-slate-500">Nickname</span><input name="nickname" minlength={3} maxlength={20} placeholder="Opcional" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" /></div>
				<div><span class="mb-1 block text-xs font-bold text-slate-500">Rol</span><select name="role" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><option value="player">Jugador</option><option value="admin">Administrador</option></select></div>
				<button type="submit" class="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">👤 Crear usuario</button>
			</form>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
			<div class="mb-4 flex items-center justify-between"><h2 class="text-base font-black text-slate-800">Usuarios registrados</h2><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{data.users.length}</span></div>
			<div class="overflow-x-auto rounded-lg border border-slate-100">
				<table class="w-full text-sm">
					<thead><tr class="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><th class="py-2.5 pl-4 text-left">Usuario</th><th class="py-2.5 text-left">Email</th><th class="py-2.5 text-center">Rol</th><th class="py-2.5 pr-4 text-right">Acciones</th></tr></thead>
					<tbody class="divide-y divide-slate-50">
						{#each data.users as user}
							{#if editingUserId === user.id}
								<tr class="bg-amber-50/50"><td class="py-2 pl-4" colspan="4"><form method="POST" action="?/editUser" class="flex flex-wrap items-center gap-3" use:enhance={() => { return async ({ update }) => { editingUserId = null; await update(); }; }}><input type="hidden" name="userId" value={user.id} /><div class="flex items-center gap-2"><span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-700">{user.nickname.charAt(0).toUpperCase()}</span><input name="nickname" bind:value={editNickname} minlength={3} maxlength={20} required class="w-36 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" /></div><select name="role" bind:value={editRole} class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold"><option value="player">🎮 Player</option><option value="admin">👑 Admin</option></select><div class="flex gap-2"><button type="submit" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">✓</button><button type="button" onclick={cancelEdit} class="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-300">✕</button></div></form></td></tr>
							{:else}
								<tr class="hover:bg-slate-50/50"><td class="py-2.5 pl-4"><div class="flex items-center gap-2"><span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{user.nickname.charAt(0).toUpperCase()}</span><span class="font-semibold text-slate-800">{user.nickname}</span></div></td><td class="py-2.5 text-xs text-slate-500">{user.email}</td><td class="py-2.5 text-center"><span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase {user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'}">{user.role === 'admin' ? '👑' : '🎮'} {user.role}</span></td><td class="py-2.5 pr-4 text-right"><button onclick={() => startEdit(user)} class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">✏️</button></td></tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>