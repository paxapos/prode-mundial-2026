# Diseño: Fix de puntaje exacto + puntaje por clasificación de grupos

**Fecha:** 2026-06-20
**Estado:** Aprobado para implementación (sin deploy a producción)

## Contexto

El sistema de puntajes se calcula **en vivo, al leer** (no hay puntajes congelados
en la DB). El leaderboard se arma en `getLeaderboardUncached` (`src/lib/server/state.ts`)
sumando, por usuario, el resultado de `calculatePredictionPoints` partido por partido.
Cada torneo tiene su propia configuración de puntajes en la columna `scoring_config_json`,
que se parsea en cada lectura con `parseScoringConfig` → `normalizeScoringConfig`.

Se detectaron dos problemas:

1. **El exacto da 3 puntos en vez de 2.** El motor es additivo y correcto
   (`outcome + exact`), pero el valor guardado/por-defecto es `exact: 2`, por lo que
   un acierto exacto suma `outcome(1) + exact(2) = 3`. El modelo deseado es "bonus":
   acertar el resultado da 1 punto y el exacto suma **1 más** (total **2**).

2. **No se puede puntuar la clasificación en fase de grupos.** En
   `normalizeScoringConfig` el `bracketTeam` de `groups` está forzado a `0`, y en el
   panel admin el input correspondiente está `disabled` para grupos. No existe lógica
   que otorgue puntos por acertar las posiciones de la tabla de grupos.

## Decisiones

- **Semántica del exacto:** modelo "bonus" (`outcome` + `exact`). El motor no cambia;
  se corrige el **valor** `exact` a `1` (en el default de código y en la config del
  torneo prod, editada desde el panel admin). Total del exacto = `1 + 1 = 2`.
- **Puntaje por clasificación de grupos:** se habilita y se reutiliza el campo
  `groups.bracketTeam` como "puntos por casillero de posición acertada". Valor objetivo: **2 pts**.
- **Criterio de acierto:** **posición exacta** en la tabla final del grupo. Por cada
  posición cuyo equipo pronosticado coincide con el equipo real en esa misma posición,
  se suman `groups.bracketTeam` puntos.
- **Posiciones que puntúan:** 1°, 2° y 3° de cada grupo (las relevantes para la
  clasificación a 16avos; la 4ª queda excluida por ser determinada por descarte).
  *(Si se prefiere puntuar solo los 8 mejores terceros que efectivamente clasifican,
  es un ajuste menor — ver "Abierto a confirmar".)*
- **Momento del cálculo:** solo se puntúan grupos **completos** (todos sus partidos con
  resultado cargado). Grupos en curso no otorgan puntos parciales.
- **Sin deploy a producción** en esta etapa. Validación con snapshot de **solo lectura**.

## Componentes

### 1. Fix del valor `exact` (código)
- `src/lib/scoring-config.ts` → `DEFAULT_STAGE_SCORING`: `exact: 2 → 1` en todas las
  fases (modelo consistente). Torneos nuevos nacen correctos. Los torneos existentes
  conservan su valor guardado y se ajustan desde el panel admin.

### 2. Destrabar configuración de grupos (código)
- `src/lib/scoring-config.ts` → `normalizeScoringConfig`: quitar el forzado
  `groups → bracketTeam: 0`; pasa a usar `pointsOrDefault` como las demás fases.
- `src/lib/scoring-config.ts` → `DEFAULT_STAGE_SCORING.groups.bracketTeam: 0 → 2`.
- `src/routes/admin/config/+page.svelte`: quitar `disabled={stage === 'groups'}` del
  input "Equipo que avanza" y aclarar en el encabezado/ayuda que en grupos significa
  "puntos por posición acertada en la tabla".

### 3. Motor nuevo: puntaje por clasificación de grupos (código, solo lectura)
- Nueva función pura `calculateGroupStagePoints(predictions, matches, config)` en
  `src/lib/scoring-engine.ts`:
  - Construye standings **pronosticados** con `calcStandings(groupMatches, userPreds)`.
  - Construye standings **reales** con `calcStandings(groupMatches, actualPreds)` donde
    `actualPreds` se arma desde `match.scoreA/scoreB`, solo para grupos completos.
  - Por cada grupo completo y cada posición puntuable (índices 0,1,2 = 1°,2°,3°):
    `+config.stages.groups.bracketTeam` si el equipo pronosticado en esa posición
    (por `getTeamId`) coincide con el real.
  - Devuelve total + desglose por grupo/posición.
- Cableado:
  - `getLeaderboardUncached` (`state.ts`): sumar el total al `totalPoints` y a
    `bracketPoints` de cada usuario.
  - `getPlayerMatchDetails` (`state.ts`): incluir el desglose de grupos en el detalle
    del jugador (sección aparte de los puntos por partido).

### 4. Validación 100% read-only (script)
- Script (`scripts/preview-scoring.mjs` o similar) que hace `SELECT` de solo lectura
  contra Turso prod (`tournaments`, `tournament_predictions`, `tournament_matches`),
  vuelca a un sqlite local temporal, corre la fórmula nueva y muestra:
  - Tabla de posiciones del prode **antes vs después**.
  - Desglose de puntos de grupo de 1–2 usuarios de muestra.
- **No realiza ninguna escritura contra prod.**

### 5. Puesta en producción (fuera de esta etapa)
- Cuando se apruebe: deploy del **código** (todo read-only/seguro) a Cloud Run prod.
- Ajuste de la **config** del torneo (`exact: 1`, `groups.bracketTeam: 2`) desde el
  **panel admin** ya destrabado (camino existente `updateScoringRules`, reversible,
  una sola fila, sin tocar esquema/pronósticos/resultados).

## Pruebas

- Tests unitarios del motor (extender `scripts/verify-knockout-scoring.mjs` o nuevo):
  - Exacto en grupos = 2 (1 outcome + 1 bonus), no 3.
  - Acierto de posición 1°/2°/3° suma `groups.bracketTeam` por casillero
    (ej. 1° y 2° acertados con valor 2 → 4 pts).
  - Grupo incompleto no otorga puntos.
  - Equipo correcto en posición incorrecta no puntúa (posición exacta estricta).

## Confirmado (revisión del spec, 2026-06-20 / 2026-06-21)

1. **exact:1 en todas las fases** (no solo grupos). Cada torneo igual se ajusta desde admin.
2. **Grupos:** puntúan **1° y 2°** (clasificación directa), por posición exacta, valor `groups.bracketTeam`.
3. **3° (mejores terceros):** **diferido** — se define más adelante. Por ahora NO puntúa
   (`SCORED_GROUP_POSITIONS = [0, 1]`).
4. **4ª posición:** no puntúa.

### Hallazgos de la validación con datos reales (2026-06-21)

- **No había bug en el exacto.** La config de prod ya tiene `exact: 1` en grupos en los
  4 torneos → el exacto ya daba 2 (1 resultado + 1 bonus). Verificado contra los 3860
  pronósticos reales: la tabla de `guardianes-de-la-gloria` suma correctamente
  (`2×exactos + resultados = puntos` en todas las filas).
- **Eliminatorias:** el puntaje por avance/posición ya funciona vía `bracketTeam` por fase
  (escalera 2/3/4/5/6/10 en mundial-2026), a medida que cada llave se confirma. Sin cambios.
- **Ligas hijas** (`guardianes`, `paxapoga`, `futbol-lunes`) usan la config de puntajes del
  **torneo padre** (`mundial-2026`), no la propia. Para activar el puntaje de posición de
  grupos en todas, hay que poner `groups.bracketTeam > 0` en **mundial-2026**.

## Entorno de testing (confirmado)

- **No hay Firebase Hosting** (`adapter-node` = app servidor). El link de prueba es un
  servicio **Cloud Run de staging** independiente de producción (`gcloud` disponible).
- La base del staging es una **copia read-only de la data real de prod** (snapshot
  embebido), para ver la tabla real con los puntajes nuevos sin riesgo a producción.
- **No se despliega a producción** en esta etapa.
