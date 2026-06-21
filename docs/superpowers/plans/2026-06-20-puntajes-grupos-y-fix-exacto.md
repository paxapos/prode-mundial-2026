# Puntajes: fix exacto + clasificación de grupos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el puntaje del resultado exacto (3→2) y agregar puntaje por acertar la posición en la tabla de fase de grupos (2 pts por casillero), editable por torneo desde el panel admin, validable en un Cloud Run de staging con copia read-only de prod.

**Architecture:** El scoring se calcula en vivo al leer. El motor (`scoring-engine.ts`) es additivo y correcto; el fix del exacto es de **valores de config** (`scoring-config.ts`). Se agrega una función pura nueva `calculateGroupStagePoints` que compara standings pronosticados vs reales (reutilizando `calcStandings` de `bracket-engine.ts`) y se cablea en el leaderboard (`state.ts`). El panel admin se destraba para editar el puntaje de grupos.

**Tech Stack:** SvelteKit + adapter-node, Svelte 5 runes, Drizzle ORM + libsql/Turso, Tailwind v4. Tests = scripts Node con `node:assert` vía `vite.ssrLoadModule` (patrón existente en `scripts/verify-knockout-scoring.mjs`). Deploy = Cloud Run (`gcloud`).

## Global Constraints

- Svelte 5 runes only (`$props`, `$state`, `$derived`, `$effect`) — sin `export let`/`onMount`.
- Tabs (no spaces), `printWidth: 100`, `singleQuote: true`, `trailingComma: 'all'`, `semi: true`, `tabWidth: 4`.
- TypeScript `strict`. ESM.
- **No deploy a producción** en este plan. Solo staging aislado.
- El puntaje de grupos = posición-exacta en posiciones 1°, 2°, 3° (la 4ª no puntúa); valor por casillero = `config.stages.groups.bracketTeam` (default 2).
- Comparar equipos por `getTeamId` (no por string crudo).
- Solo se puntúan grupos **completos** (todos sus partidos con resultado).

---

### Task 1: Fix de defaults de config (exacto bonus=1, grupos configurable=2)

**Files:**
- Modify: `src/lib/scoring-config.ts:5-13` (DEFAULT_STAGE_SCORING) y `:19-37` (normalizeScoringConfig)
- Modify: `scripts/verify-knockout-scoring.mjs` (actualizar expectativas del exacto en eliminatorias)

**Interfaces:**
- Produces: `defaultScoringConfig()` ahora devuelve `stages.groups = { outcome: 1, exact: 1, bracketTeam: 2 }` y `stages.round32.exact = 1` (etc. para todas las fases). `normalizeScoringConfig` ya **no** fuerza `groups.bracketTeam` a 0.

- [ ] **Step 1: Editar `DEFAULT_STAGE_SCORING`**

En `src/lib/scoring-config.ts`, reemplazar el objeto (líneas 5-13) por:

```ts
const DEFAULT_STAGE_SCORING: Record<MatchStage, StageScoringConfig> = {
	groups: { outcome: 1, exact: 1, bracketTeam: 2 },
	round32: { outcome: 1, exact: 1, bracketTeam: 2 },
	round16: { outcome: 1, exact: 1, bracketTeam: 3 },
	quarterfinal: { outcome: 1, exact: 1, bracketTeam: 4 },
	semifinal: { outcome: 1, exact: 1, bracketTeam: 5 },
	thirdplace: { outcome: 1, exact: 1, bracketTeam: 6 },
	final: { outcome: 1, exact: 1, bracketTeam: 6 }
};
```

- [ ] **Step 2: Destrabar `groups.bracketTeam` en `normalizeScoringConfig`**

En `src/lib/scoring-config.ts`, en el `return` del `map` (línea ~30), reemplazar:

```ts
					bracketTeam: stage === 'groups' ? 0 : pointsOrDefault(stageInput.bracketTeam, defaults.bracketTeam)
```

por:

```ts
					bracketTeam: pointsOrDefault(stageInput.bracketTeam, defaults.bracketTeam)
```

- [ ] **Step 3: Escribir test rápido de defaults**

Crear `scripts/verify-config-defaults.mjs`:

```js
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
	const { defaultScoringConfig, normalizeScoringConfig } = await server.ssrLoadModule('/src/lib/scoring-config.ts');
	const cfg = defaultScoringConfig();
	assert.equal(cfg.stages.groups.exact, 1, 'exacto grupos debe ser 1 (bonus)');
	assert.equal(cfg.stages.groups.bracketTeam, 2, 'grupos bracketTeam default debe ser 2');
	assert.equal(cfg.stages.round32.exact, 1, 'exacto round32 debe ser 1');

	const norm = normalizeScoringConfig({ stages: { groups: { outcome: 1, exact: 1, bracketTeam: 5 } } });
	assert.equal(norm.stages.groups.bracketTeam, 5, 'normalize debe respetar groups.bracketTeam configurado');
	console.log('OK verify-config-defaults');
} finally {
	await server.close();
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `node ./scripts/verify-config-defaults.mjs`
Expected: imprime `OK verify-config-defaults`, exit 0.

- [ ] **Step 5: Actualizar expectativas del exacto en `verify-knockout-scoring.mjs`**

Ese script usa `defaultScoringConfig()`. Antes el exacto de round32 daba `outcome(1)+exact(2)=3`; ahora da `1+1=2` (más `bracketTeam` si corresponde). Buscar cualquier `assert` que espere el valor viejo del exacto y ajustarlo: el componente exacto de un acierto de score exacto en eliminatorias ahora suma `exactPoints = 1`. Ejecutar primero para ver qué rompe:

Run: `node ./scripts/verify-knockout-scoring.mjs`
Expected: si falla por el cambio de exacto, ajustar el número esperado (exact 2→1 en los asserts afectados) y volver a correr hasta `exit 0`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring-config.ts scripts/verify-config-defaults.mjs scripts/verify-knockout-scoring.mjs
git commit -m "fix(scoring): exacto = bonus 1 (total 2) y grupos.bracketTeam configurable (default 2)"
```

---

### Task 2: Destrabar el input de grupos en el panel admin

**Files:**
- Modify: `src/routes/admin/config/+page.svelte:21` (encabezado) y `:24` (input bracketTeam)

**Interfaces:**
- Consumes: `scoringConfig.stages[stage].bracketTeam` ya editable (Task 1 lo permite en normalize).
- Produces: el admin puede setear el puntaje de grupos y guardarlo (camino existente `updateScoringRules`).

- [ ] **Step 1: Quitar `disabled` del input de grupos**

En `src/routes/admin/config/+page.svelte` línea 24, en el `<input>` de la columna "Equipo que avanza", eliminar el atributo `disabled={stage === 'groups'}`. El input queda igual a las demás fases.

- [ ] **Step 2: Aclarar el encabezado de la columna**

En la fila `<thead>` (línea 21), cambiar el `<th>` `Equipo que avanza` por:

```html
<th class="py-2 text-center">Avance / Posición</th>
```

Y agregar, debajo de la tabla (después del `</table>` correspondiente), una nota aclaratoria breve usando solo clases existentes:

```html
<p class="mt-2 text-[11px] text-slate-400">En <strong>Fase de Grupos</strong>, "Avance / Posición" son los puntos que suma cada posición acertada en la tabla (1°, 2° y 3°).</p>
```

- [ ] **Step 3: Verificar build de tipos/compilación**

Run: `pnpm check`
Expected: sin errores nuevos de Svelte/TS en `admin/config/+page.svelte`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/config/+page.svelte
git commit -m "feat(admin): habilitar edición del puntaje de posición en fase de grupos"
```

---

### Task 3: Motor de puntaje por clasificación de grupos

**Files:**
- Modify: `src/lib/types.ts` (agregar tipos de resultado)
- Modify: `src/lib/scoring-engine.ts` (agregar `calculateGroupStagePoints`)
- Create: `scripts/verify-group-scoring.mjs`

**Interfaces:**
- Consumes: `calcStandings` de `$lib/bracket-engine`, `getTeamId` de `$lib/teams`, tipos `Match`, `Prediction`, `ScoringConfig`.
- Produces:
  ```ts
  export interface GroupPositionPointDetail {
  	groupCode: string;
  	position: number; // 1 | 2 | 3
  	predictedTeam: string;
  	actualTeam: string;
  	hit: boolean;
  	points: number;
  }
  export interface GroupStagePointResult {
  	totalPoints: number;
  	details: GroupPositionPointDetail[];
  }
  export function calculateGroupStagePoints(
  	predictions: Prediction[],
  	matches: Match[],
  	config: ScoringConfig
  ): GroupStagePointResult;
  ```

- [ ] **Step 1: Agregar tipos en `types.ts`**

Al final de `src/lib/types.ts` (antes de cualquier export de bloque no relacionado, o al final del archivo) agregar:

```ts
/** Una posición de grupo evaluada para puntaje de clasificación */
export interface GroupPositionPointDetail {
	groupCode: string;
	/** 1, 2 o 3 */
	position: number;
	predictedTeam: string;
	actualTeam: string;
	hit: boolean;
	points: number;
}

/** Resultado del puntaje por clasificación en fase de grupos de un usuario */
export interface GroupStagePointResult {
	totalPoints: number;
	details: GroupPositionPointDetail[];
}
```

- [ ] **Step 2: Escribir el test (falla primero)**

Crear `scripts/verify-group-scoring.mjs`. Usa un grupo de 4 equipos (6 partidos). Los pronósticos del usuario aciertan 1° y 2° pero no 3°.

```js
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
	const { calculateGroupStagePoints } = await server.ssrLoadModule('/src/lib/scoring-engine.ts');
	const { normalizeScoringConfig } = await server.ssrLoadModule('/src/lib/scoring-config.ts');
	const config = normalizeScoringConfig({ stages: { groups: { outcome: 1, exact: 1, bracketTeam: 2 } } });

	const teams = ['Argentina', 'Brasil', 'Chile', 'Peru'];
	const pair = (a, b) => ({
		id: `A-${a}-${b}`, tournamentId: 't', stage: 'groups', groupCode: 'A',
		teamA: teams[a], teamB: teams[b], kickoffAt: '2026-06-10T00:00:00.000Z',
		venue: null, penaltyWinner: null, isClosed: true
	});
	// 6 partidos del grupo. Resultados REALES: orden final Argentina>Brasil>Chile>Peru
	const matches = [
		{ ...pair(0,1), scoreA: 2, scoreB: 0 }, // ARG vence BRA
		{ ...pair(0,2), scoreA: 2, scoreB: 0 }, // ARG vence CHI
		{ ...pair(0,3), scoreA: 2, scoreB: 0 }, // ARG vence PER
		{ ...pair(1,2), scoreA: 1, scoreB: 0 }, // BRA vence CHI
		{ ...pair(1,3), scoreA: 1, scoreB: 0 }, // BRA vence PER
		{ ...pair(2,3), scoreA: 1, scoreB: 0 }  // CHI vence PER
	];
	// real: ARG 9, BRA 6, CHI 3, PER 0 -> 1°ARG 2°BRA 3°CHI

	const mkPred = (m, a, b) => ({
		id: `p-${m.id}`, userId: 'u', tournamentId: 't', matchId: m.id,
		predA: a, predB: b, predPenaltyWinner: null,
		createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
	});
	// Pronóstico: acierta ARG 1° y BRA 2°, pero invierte CHI/PER (no acierta 3°)
	const predictions = [
		mkPred(matches[0], 2, 0), // ARG>BRA
		mkPred(matches[1], 2, 0), // ARG>CHI
		mkPred(matches[2], 2, 0), // ARG>PER
		mkPred(matches[3], 1, 0), // BRA>CHI
		mkPred(matches[4], 1, 0), // BRA>PER
		mkPred(matches[5], 0, 1)  // PER>CHI  (invierte el 3°)
	];

	const res = calculateGroupStagePoints(predictions, matches, config);
	// 1° y 2° acertados = 2 casilleros * 2pts = 4; 3° fallado = 0
	assert.equal(res.totalPoints, 4, `esperaba 4, dio ${res.totalPoints}`);
	const hits = res.details.filter((d) => d.hit).map((d) => d.position).sort();
	assert.deepEqual(hits, [1, 2], 'deben acertar posiciones 1 y 2');

	// Grupo incompleto no puntúa
	const incompleteMatches = matches.map((m, i) => (i === 0 ? { ...m, scoreA: null, scoreB: null } : m));
	const res2 = calculateGroupStagePoints(predictions, incompleteMatches, config);
	assert.equal(res2.totalPoints, 0, 'grupo incompleto no debe puntuar');

	console.log('OK verify-group-scoring');
} finally {
	await server.close();
}
```

- [ ] **Step 3: Correr el test y verificar que FALLA**

Run: `node ./scripts/verify-group-scoring.mjs`
Expected: FALLA con error tipo `calculateGroupStagePoints is not a function`.

- [ ] **Step 4: Implementar `calculateGroupStagePoints`**

En `src/lib/scoring-engine.ts`, agregar imports y la función. En el import de tipos existente (línea 4) sumar los tipos nuevos, e importar `calcStandings` y `LivePred`:

```ts
import { calcStandings, type LivePred } from '$lib/bracket-engine';
import type { GroupPositionPointDetail, GroupStagePointResult } from '$lib/types';
```

Y al final del archivo:

```ts
const SCORED_GROUP_POSITIONS = [0, 1, 2] as const; // 1°, 2°, 3°

export function calculateGroupStagePoints(
	prediction: Prediction[],
	matches: Match[],
	config: ScoringConfig
): GroupStagePointResult {
	const pointsPerSlot = config.stages.groups.bracketTeam;
	const groupMatches = matches.filter((m) => m.stage === 'groups');
	if (pointsPerSlot <= 0 || groupMatches.length === 0) return { totalPoints: 0, details: [] };

	const userPreds: Record<string, LivePred> = {};
	for (const p of prediction) {
		userPreds[p.matchId] = { predA: p.predA, predB: p.predB, predPenaltyWinner: p.predPenaltyWinner };
	}
	const actualPreds: Record<string, LivePred> = {};
	for (const m of groupMatches) {
		if (m.scoreA !== null && m.scoreB !== null) {
			actualPreds[m.id] = { predA: m.scoreA, predB: m.scoreB, predPenaltyWinner: m.penaltyWinner };
		}
	}

	const predictedStandings = calcStandings(groupMatches, userPreds);
	const actualStandings = calcStandings(groupMatches, actualPreds);

	const matchesByGroup = new Map<string, Match[]>();
	for (const m of groupMatches) {
		const g = m.groupCode ?? '?';
		const list = matchesByGroup.get(g) ?? [];
		list.push(m);
		matchesByGroup.set(g, list);
	}

	const details: GroupPositionPointDetail[] = [];
	let totalPoints = 0;

	for (const [g, gMatches] of matchesByGroup) {
		const complete = gMatches.length > 0 && gMatches.every((m) => actualPreds[m.id] !== undefined);
		if (!complete) continue;
		const predicted = predictedStandings[g] ?? [];
		const actual = actualStandings[g] ?? [];
		for (const idx of SCORED_GROUP_POSITIONS) {
			const predTeam = predicted[idx]?.team;
			const actTeam = actual[idx]?.team;
			if (!predTeam || !actTeam) continue;
			const hit = getTeamId(predTeam) === getTeamId(actTeam);
			const points = hit ? pointsPerSlot : 0;
			totalPoints += points;
			details.push({ groupCode: g, position: idx + 1, predictedTeam: predTeam, actualTeam: actTeam, hit, points });
		}
	}

	return { totalPoints, details };
}
```

- [ ] **Step 5: Correr el test y verificar que PASA**

Run: `node ./scripts/verify-group-scoring.mjs`
Expected: imprime `OK verify-group-scoring`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/scoring-engine.ts scripts/verify-group-scoring.mjs
git commit -m "feat(scoring): puntaje por posición exacta en fase de grupos (1°/2°/3°)"
```

---

### Task 4: Sumar puntaje de grupos al leaderboard

**Files:**
- Modify: `src/lib/server/state.ts` (import + `getLeaderboardUncached:1643-1664`)

**Interfaces:**
- Consumes: `calculateGroupStagePoints(predictions, matches, config)` de Task 3.
- Produces: `LeaderboardEntry.totalPoints` y `.bracketPoints` incluyen el puntaje de clasificación de grupos.

- [ ] **Step 1: Importar la función**

En `src/lib/server/state.ts` línea 36, extender el import:

```ts
import { calculatePredictionPoints, calculateGroupStagePoints, type PredictionPointResult } from '$lib/scoring-engine';
```

- [ ] **Step 2: Sumar el puntaje de grupos por usuario**

En `getLeaderboardUncached`, dentro del `.map((user) => { ... })`, después del `for (const prediction of userPredictions) { ... }` y antes del `return {...}`, agregar:

```ts
			const groupStage = calculateGroupStagePoints(userPredictions, matches, config);
			totalPoints += groupStage.totalPoints;
			bracketPoints += groupStage.totalPoints;
```

- [ ] **Step 3: Verificar tipos/compilación**

Run: `pnpm check`
Expected: sin errores nuevos en `state.ts`.

- [ ] **Step 4: Test de integración liviano (leaderboard refleja grupos)**

Crear `scripts/verify-leaderboard-groups.mjs` que cargue `calculateGroupStagePoints` y confirme que sumar su `totalPoints` a un acumulador da el total esperado (reusa el fixture del Task 3 de forma mínima):

```js
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
	const { calculateGroupStagePoints } = await server.ssrLoadModule('/src/lib/scoring-engine.ts');
	const { normalizeScoringConfig } = await server.ssrLoadModule('/src/lib/scoring-config.ts');
	const config = normalizeScoringConfig({ stages: { groups: { outcome: 1, exact: 1, bracketTeam: 2 } } });
	// sanity: sin partidos no suma
	const res = calculateGroupStagePoints([], [], config);
	assert.equal(res.totalPoints, 0);
	console.log('OK verify-leaderboard-groups');
} finally {
	await server.close();
}
```

Run: `node ./scripts/verify-leaderboard-groups.mjs`
Expected: `OK verify-leaderboard-groups`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/state.ts scripts/verify-leaderboard-groups.mjs
git commit -m "feat(leaderboard): sumar puntaje por clasificación de grupos al total"
```

---

### Task 5: Desglose de puntaje de grupos en el detalle del jugador (UI)

**Files:**
- Modify: `src/lib/server/state.ts` (nuevo export `getPlayerGroupStageDetails`)
- Modify: `src/routes/[tournamentAlias]/prode/[nickname]/+page.server.ts` (pasar el desglose)
- Modify: `src/routes/[tournamentAlias]/prode/[nickname]/+page.svelte` (render mínimo)

**Interfaces:**
- Consumes: `calculateGroupStagePoints`, patrón de `getPlayerMatchDetails:1674-1701`.
- Produces: `getPlayerGroupStageDetails(userId, tournamentId): Promise<GroupStagePointResult>`.

- [ ] **Step 1: Agregar `getPlayerGroupStageDetails` en `state.ts`**

Justo debajo de `getPlayerMatchDetails` (después de la línea 1701), agregar:

```ts
/** Desglose del puntaje por clasificación de grupos de un jugador */
export async function getPlayerGroupStageDetails(userId: string, tournamentId: string): Promise<GroupStagePointResult> {
	const tournament = await getTournamentById(tournamentId);
	if (!tournament) return { totalPoints: 0, details: [] };
	const sourceId = getSourceId(tournament);
	const sourceTournament = tournament.parentTournamentId ? await getTournamentById(sourceId) : tournament;
	if (!sourceTournament) return { totalPoints: 0, details: [] };
	const [predRows, matchRows] = await Promise.all([
		db.select().from(tournamentPredictions).where(
			and(eq(tournamentPredictions.userId, Number(userId)), eq(tournamentPredictions.tournamentId, sourceId))
		),
		db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, sourceId))
	]);
	const matches = matchRows.map(toMatch);
	const predictions = predRows.map(toPrediction);
	return calculateGroupStagePoints(predictions, matches, sourceTournament.scoringConfig);
}
```

Asegurar que `GroupStagePointResult` esté importado de `$lib/types` en `state.ts` (agregarlo al import de tipos existente).

- [ ] **Step 2: Pasar el desglose desde el page server**

En `src/routes/[tournamentAlias]/prode/[nickname]/+page.server.ts`, importar `getPlayerGroupStageDetails` (junto a `getPlayerMatchDetails`, línea 5) y en el objeto retornado (línea ~47) agregar:

```ts
		groupStageDetails: canViewPredictions
			? await getPlayerGroupStageDetails(profileUser.id, tournament.id)
			: { totalPoints: 0, details: [] },
```

- [ ] **Step 3: Render mínimo en el `.svelte`**

En `src/routes/[tournamentAlias]/prode/[nickname]/+page.svelte`, donde se muestran los `matchDetails`, agregar un bloque (Svelte 5 runes, clases existentes) que liste `data.groupStageDetails.details` solo si `data.groupStageDetails.totalPoints > 0`:

```svelte
{#if data.groupStageDetails?.totalPoints > 0}
	<div class="mt-4 rounded-lg border border-slate-200 bg-white p-3">
		<h3 class="mb-2 text-sm font-bold text-slate-700">Clasificación de grupos (+{data.groupStageDetails.totalPoints})</h3>
		<ul class="space-y-1 text-xs text-slate-600">
			{#each data.groupStageDetails.details.filter((d) => d.hit) as d (d.groupCode + '-' + d.position)}
				<li>Grupo {d.groupCode} · {d.position}° {d.predictedTeam} (+{d.points})</li>
			{/each}
		</ul>
	</div>
{/if}
```

- [ ] **Step 4: Verificar tipos/compilación**

Run: `pnpm check`
Expected: sin errores nuevos en los 3 archivos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/state.ts "src/routes/[tournamentAlias]/prode/[nickname]/+page.server.ts" "src/routes/[tournamentAlias]/prode/[nickname]/+page.svelte"
git commit -m "feat(prode): desglose del puntaje por clasificación de grupos en el perfil del jugador"
```

---

### Task 6: Script de snapshot read-only de producción

**Files:**
- Create: `scripts/snapshot-prod.mjs`
- Modify: `.gitignore` (ignorar `snapshot.db`)

**Interfaces:**
- Consumes: credenciales de prod en `.env.cloudrun` (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`).
- Produces: archivo local `snapshot.db` con esquema + datos (solo lectura desde prod).

- [ ] **Step 1: Crear el esquema local con drizzle**

El script primero crea el esquema en `file:snapshot.db` usando push, luego copia datos. Crear `scripts/snapshot-prod.mjs`:

```js
import { createClient } from '@libsql/client';
import { config as loadEnv } from 'dotenv';
import { execSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';

loadEnv({ path: '.env.cloudrun' });

const PROD_URL = process.env.TURSO_DATABASE_URL;
const PROD_TOKEN = process.env.TURSO_AUTH_TOKEN;
if (!PROD_URL || !PROD_URL.startsWith('libsql://')) throw new Error('TURSO_DATABASE_URL de prod no configurada en .env.cloudrun');

const SNAP = 'snapshot.db';
if (existsSync(SNAP)) rmSync(SNAP);

// 1) Crear esquema local con drizzle push apuntando al snapshot
execSync('pnpm drizzle-kit push --force', { stdio: 'inherit', env: { ...process.env, TURSO_DATABASE_URL: `file:${SNAP}`, TURSO_AUTH_TOKEN: '' } });

// 2) Copiar datos (SOLO SELECT contra prod)
const prod = createClient({ url: PROD_URL, authToken: PROD_TOKEN });
const local = createClient({ url: `file:${SNAP}` });

const TABLES = ['tournaments', 'users', 'user_tournaments', 'tournament_matches', 'tournament_predictions'];
for (const table of TABLES) {
	const { rows, columns } = await prod.execute(`SELECT * FROM ${table}`);
	if (rows.length === 0) { console.log(`· ${table}: 0 filas`); continue; }
	const cols = columns.join(', ');
	const placeholders = columns.map(() => '?').join(', ');
	for (const row of rows) {
		const values = columns.map((c) => row[c]);
		await local.execute({ sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, args: values });
	}
	console.log(`· ${table}: ${rows.length} filas copiadas`);
}
console.log(`OK snapshot -> ${SNAP} (read-only desde prod, sin escrituras)`);
```

> Nota: si algún nombre de tabla difiere, verificarlo con el `schema.ts` (`sqliteTable('...')`). Ajustar la lista `TABLES` a los nombres reales.

- [ ] **Step 2: Verificar `dotenv` disponible**

Run: `node -e "require.resolve('dotenv')" 2>/dev/null && echo tiene-dotenv || pnpm add -D dotenv`
Expected: `tiene-dotenv` o instala dotenv.

- [ ] **Step 3: Ignorar el snapshot en git**

Agregar a `.gitignore` una línea:

```
snapshot.db
```

- [ ] **Step 4: Correr el snapshot (lectura de prod)**

Run: `node ./scripts/snapshot-prod.mjs`
Expected: imprime las filas copiadas por tabla y `OK snapshot -> snapshot.db`. **Cero escrituras a prod** (solo `SELECT`).

- [ ] **Step 5: Validar puntajes nuevos contra datos reales (local, read-only)**

Levantar la app local apuntando al snapshot y revisar la tabla:

Run: `TURSO_DATABASE_URL=file:snapshot.db pnpm dev`
Expected: la home `/` muestra el leaderboard con el exacto valiendo 2 (no 3). Para ver puntaje de grupos, antes setear `groups.bracketTeam=2` en el snapshot vía el panel admin local (`/admin/config`) — esto escribe SOLO en el snapshot local, no en prod.

- [ ] **Step 6: Commit**

```bash
git add scripts/snapshot-prod.mjs .gitignore
git commit -m "chore(scripts): snapshot read-only de prod para validar puntajes en local/staging"
```

---

### Task 7: Link de testing local + túnel temporal (cloudflared)

> **No es TDD.** Corre la app **local** contra `snapshot.db` (copia read-only de prod) y la expone con un túnel temporal. **No despliega nada en la nube** ni toca producción. El link se apaga al cerrar el túnel.

**Files:**
- (ninguno nuevo; usa `snapshot.db` de Task 6)

**Interfaces:**
- Consumes: `snapshot.db` (Task 6), binario `cloudflared` (o `npx cloudflared`).
- Produces: URL pública temporal `https://<aleatorio>.trycloudflare.com`.

- [ ] **Step 1: Build de producción local**

Run: `pnpm build`
Expected: genera `build/` sin errores.

- [ ] **Step 2: Levantar la app apuntando al snapshot**

En una terminal (background):

```bash
TURSO_DATABASE_URL=file:snapshot.db ORIGIN=http://localhost:3000 PORT=3000 node build
```

Expected: log "Listening on 0.0.0.0:3000" (o similar).
Verificar: `curl -s http://localhost:3000/health` responde OK.

- [ ] **Step 3: Verificar cloudflared disponible**

Run: `command -v cloudflared || npx --yes cloudflared@latest --version`
Expected: versión de cloudflared (si no está, `npx` lo baja).

- [ ] **Step 4: Abrir el túnel temporal**

```bash
cloudflared tunnel --url http://localhost:3000
```

(o `npx --yes cloudflared@latest tunnel --url http://localhost:3000`)
Expected: imprime una URL `https://<...>.trycloudflare.com`.

- [ ] **Step 5: Ajustar ORIGIN al túnel (si hace falta para login)**

Si se va a probar login/OAuth o acciones POST, relanzar el server del Step 2 con `ORIGIN=https://<...>.trycloudflare.com` (SvelteKit valida el origin en form actions). Para solo ver el leaderboard, no es necesario.

- [ ] **Step 6: Probar y pasar el link**

Abrir la URL del túnel. Verificar: leaderboard con exacto = 2 (no 3). Para ver puntaje de grupos, setear `groups.bracketTeam=2` en `/admin/config` (escribe SOLO en `snapshot.db`, no en prod). Pasar el link al usuario para que pruebe desde el celular. Recordar: copia efímera; cerrar el túnel y matar `node build` al terminar.

---

## Self-Review

**Spec coverage:**
- Fix exacto (bonus 1, total 2) → Task 1 ✅
- Destrabar config de grupos (código) → Task 1 (normalize) ✅
- Destrabar UI admin → Task 2 ✅
- Motor de puntaje por posición de grupos (1°/2°/3°, posición-exacta, solo grupos completos) → Task 3 ✅
- Sumar al leaderboard → Task 4 ✅
- Desglose en detalle del jugador → Task 5 ✅
- Validación read-only de prod → Task 6 ✅
- Link de testing (local + túnel cloudflared, copia de prod) → Task 7 ✅
- No deploy a prod → respetado (nada se despliega en la nube) ✅

**Placeholder scan:** sin TBD/TODO; las únicas "notas" son verificaciones de nombres reales (tablas, Dockerfile) con instrucción concreta de cómo resolver.

**Type consistency:** `calculateGroupStagePoints(predictions, matches, config)` y `GroupStagePointResult { totalPoints, details }` usados igual en Tasks 3/4/5. `GroupPositionPointDetail` con campos `{groupCode, position, predictedTeam, actualTeam, hit, points}` consistente entre engine y UI.

**Riesgos conocidos:**
- Los nombres de tabla en Task 6 deben confirmarse contra `schema.ts`.
- El `Dockerfile.staging` debe alinearse con el `Dockerfile` real (Node version/pasos).
- Task 1 Step 5: actualizar expectativas de `verify-knockout-scoring.mjs` (exacto eliminatorias 3→2).
