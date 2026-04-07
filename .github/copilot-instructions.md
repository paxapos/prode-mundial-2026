# Instrucciones para agentes de programacion

Este repositorio implementa un prode del Mundial 2026 usando SvelteKit + TypeScript.

## Objetivo del producto

- Gestionar usuarios con nickname unico y autenticacion (email/password o Google OAuth).
- Organizar competiciones (torneos con partidos) y ligas (subgrupos de amigos dentro de una competicion).
- Permitir carga de pronosticos por partido antes del kickoff.
- Calcular puntos automaticamente cuando el admin carga un resultado real.
- Mostrar tabla de posiciones por liga con desglose transparente de puntos.
- Cubrir torneo completo: grupos, ronda de 32, octavos, cuartos, semifinales y final.

## Arquitectura de torneos

El sistema tiene una jerarquia de dos niveles:
- **Competicion** (torneo raiz): tiene `parentTournamentId = null`. Contiene los partidos reales.
- **Liga** (torneo hijo): tiene `parentTournamentId = <id_competicion>`. Comparte los partidos de la competicion padre. Cada liga tiene su propia tabla de posiciones.

Los pronosticos se guardan contra el `tournamentId` de la competicion fuente:
```ts
const sourceId = tournament.parentTournamentId ?? tournament.id;
```

## Reglas de negocio obligatorias

### Puntuacion

La puntuacion se configura por competicion y se almacena en `scoring_config_json`. Valores default:

| Fase | Acierto resultado (outcome) | Bonus exacto (exact) | Equipo avanza (bracketTeam) |
|------|------|------|------|
| Grupos | 1 | 2 | 0 |
| Ronda de 32 | 1 | 2 | 2 |
| Octavos | 1 | 2 | 3 |
| Cuartos | 1 | 2 | 4 |
| Semifinal | 1 | 2 | 5 |
| Final | 1 | 2 | 6 |

- **Resultado exacto** = outcome + exact = 3 puntos en grupos.
- **Acierto de signo** (gana local / empate / gana visitante) = outcome = 1 punto.
- En eliminatoria, si hay empate en el marcador, el `penaltyWinner` determina quien avanza.
- Un pronostico exacto en eliminatoria requiere acertar marcador Y ganador por penales (si aplica).
- `bracketTeam` se otorga cuando se acierta el equipo que avanza (el outcome correcto en knockout).
- Bonus configurables: campeon (10), subcampeon (6), tercero (5) — aun no implementado.

### Restricciones

- Un participante solo puede tener un pronostico por partido (unique constraint en DB).
- No se permite editar pronosticos despues del kickoff del partido.
- Los partidos de eliminatoria con empate requieren penalty_winner al cargar resultado.
- El ranking se ordena por: puntos totales > aciertos exactos > aciertos de outcome.

## Stack tecnico

- **Framework**: SvelteKit con Svelte 5 (runes: `$state`, `$derived`, `$props`, `$effect`).
- **Estilos**: Tailwind CSS (utility-first, sin CSS custom salvo app.css).
- **Componentes UI**: Flowbite para Svelte (Alert, Badge, etc.). Para formularios usar HTML nativo con clases Tailwind.
- **Base de datos**: Turso (libSQL) via Drizzle ORM.
- **Auth**: Sesiones con cookie (`prode_session`), hash SHA-256. Soporte Google OAuth.
- **Gestor de paquetes**: pnpm.

## Estructura del proyecto

```
src/
  routes/                  # Paginas y endpoints SvelteKit
    +layout.svelte         # Layout principal con navbar
    +layout.server.ts      # Auth check global
    +page.svelte           # Home/landing
    admin/                 # Panel de administracion
    prode/                 # Vista de pronosticos (ruta legacy)
    [tournamentAlias]/     # Rutas por alias de torneo/liga
      prode/[nickname]/    # Pronosticos de un jugador en una liga
    login/                 # Login + registro
      complete-profile/    # Completar nickname post-Google OAuth
    auth/google/           # Callback OAuth
  lib/
    types.ts               # Interfaces y tipos compartidos
    teams.ts               # Datos de equipos, banderas, sedes
    scoring-config.ts      # Config de puntuacion default y helpers
    bracket-engine.ts      # Motor de llaves eliminatorias (cliente)
    components/            # Componentes Svelte reutilizables
    assets/                # SVGs e imagenes empaquetadas
    server/
      state.ts             # TODA la logica de negocio (CRUD, scoring, leaderboard)
      auth.ts              # Manejo de sesiones y cookies
      security.ts          # Hash de passwords (bcrypt-like)
      google-oauth.ts      # Flujo OAuth con Google
      bootstrap.ts         # Seed de datos iniciales (partidos, competicion)
      db/
        client.ts          # Conexion a Turso/libSQL
        schema.ts          # Definicion de tablas Drizzle
```

## Modelo de datos real

```
users(id, username, nickname, password_hash, google_id, avatar_url, role, created_at)
sessions(id, token_hash, user_id, expires_at, created_at)
tournaments(id, alias, name, header_image_url, state, start_at, lock_reason, scoring_config_json, parent_tournament_id, created_at)
user_tournaments(id, user_id, tournament_id, created_at)  -- inscripcion a liga/competicion
tournament_matches(id, tournament_id, stage, group_code, team_a, team_b, kickoff_at, venue, score_a, score_b, penalty_winner, is_closed)
tournament_predictions(id, user_id, tournament_id, match_id, pred_a, pred_b, pred_penalty_winner, created_at, updated_at)
audit_logs(id, user_id, action, entity_type, entity_id, payload_json, created_at)
```

Los puntos NO se almacenan en una tabla separada. Se calculan on-the-fly en `getLeaderboard()` y `getPlayerMatchDetails()`.

## Patrones de codigo obligatorios

### Svelte 5 (runes)

```svelte
<script lang="ts">
  let { data, form } = $props();          // Props del server
  let activeTab = $state('resultados');     // Estado local reactivo
  const filtered = $derived(               // Valores derivados
    data.items.filter(i => i.active)
  );
</script>
```

Nunca usar `export let`, `$:`, `$$props`, ni stores de Svelte 4.

### Formularios con use:enhance

Todos los `<form method="POST">` deben usar `use:enhance` para evitar recargas completas:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
</script>

<form method="POST" action="?/save" use:enhance>
  ...
</form>
```

Si se necesita logica post-submit:
```svelte
<form use:enhance={() => {
  return async ({ update }) => {
    // reset local state
    await update();
  };
}}>
```

### Validacion server-side

Toda validacion debe existir en el servidor (actions en +page.server.ts o en state.ts). Las validaciones de UI son solo UX, nunca seguridad.

```ts
// state.ts - siempre validar inputs
export async function savePrediction(input: { ... }): Promise<void> {
  if (input.predA < 0 || input.predB < 0) throw new Error('Goles negativos no permitidos.');
  // ...
}
```

### Actions SvelteKit

Usar `fail()` para errores de validacion (preserva form state). Usar `error()` solo para errores HTTP reales (404, 403):

```ts
// Correcto
return fail(400, { message: 'Pronostico invalido.' });

// Incorrecto - pierde el estado del formulario
throw error(400, 'Pronostico invalido.');
```

### Estilos

- Usar Tailwind utility classes directamente en el markup.
- No crear archivos CSS adicionales.
- Componentes Flowbite solo cuando agregan valor real (Alert, Badge, Tooltip). Para inputs y botones usar HTML nativo + Tailwind.
- Seguir patron de tarjetas con bordes redondeados: `rounded-xl border border-slate-200 bg-white p-5 shadow-sm`.

## Assets e imagenes

- **Logo/icono de la app (copa):** `static/copacup.svg` y `src/lib/assets/favicon.svg`. SVG de la copa dorada. Favicon e icono de navbar.
- **Logo del Mundial 2026:** `static/mundial_2026.png`. Logo FIFA World Cup 2026. Hero de la pagina principal.

## Principios UX obligatorios

### Transparencia del torneo

Los jugadores deben poder entender como se suman sus puntos. Toda pantalla de posiciones debe:
- Mostrar desglose de puntos (exactos, outcomes, bracket).
- Permitir ver los pronosticos de cada jugador una vez comenzado el torneo.
- Indicar claramente el estado de cada partido (pendiente, cerrado, resultado cargado).

### Feedback inmediato

- Toda accion del usuario debe tener feedback visual (mensaje de exito/error via Alert).
- Los formularios no deben recargar la pagina (use:enhance obligatorio).
- Los estados de carga deben ser evidentes.

### Jerarquia visual

- Usar tipografia con pesos claros: font-black para titulos, font-bold para subtitulos, font-semibold para labels.
- Colores semanticos consistentes: emerald para exito/acciones positivas, red para errores/eliminar, sky para informacion/links, amber para advertencias/ligas, slate para neutro.
- Espaciado consistente con `space-y-6` entre secciones y `gap-3` dentro de grids.

### Mobile-first

- Todo layout debe funcionar en mobile primero.
- Usar `grid` responsivo: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- Tablas deben tener `overflow-x-auto` en mobile.
- Botones y areas tocables minimo `py-2.5 px-4` para dedos.

## Convenciones para agentes

- Antes de modificar logica de puntos, verificar que `getLeaderboard()` y `getPlayerMatchDetails()` sean consistentes.
- Nunca cambiar la firma de `getOutcome()` sin actualizar ambas funciones de scoring.
- Evitar cambios destructivos en datos historicos (no DROP tables, no alterar migrations aplicadas).
- Priorizar cambios pequenos y faciles de revisar.
- Validar siempre del lado servidor aunque ya existan validaciones en UI.
- Al agregar un campo nuevo a un formulario, agregar `use:enhance` si el form no lo tiene.
- Las funciones de `state.ts` no necesitan llamar a `ensureDatabaseReady()` ya que hooks.server.ts inicializa la DB antes de cada request.
- Documentar cualquier cambio de reglas del torneo en README.md.

## Definicion de terminado

Un cambio se considera completo cuando:
- `pnpm check` pasa con 0 errores.
- No rompe rutas existentes.
- Respeta reglas de negocio definidas arriba.
- Formularios usan `use:enhance`.
- Validaciones existen en el servidor.
- Incluye actualizacion de README si cambia comportamiento funcional.
