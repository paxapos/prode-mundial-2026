# Instrucciones para agentes de programacion

Este repositorio implementa un prode del Mundial 2026.

## Objetivo del producto

- Gestionar participantes con nombre unico.
- Permitir carga de pronosticos por partido.
- Calcular puntos automaticamente cuando hay resultado real.
- Mostrar tabla de posiciones global.
- Cubrir torneo completo: grupos, ronda de 32, octavos, cuartos, semifinales y final.

## Reglas de negocio obligatorias

- Puntuacion base:
  - 3 puntos por resultado exacto.
  - 1 punto por acertar signo (gana local, empate o gana visitante).
  - 0 puntos en caso contrario.
- Un participante solo puede tener un pronostico por partido.
- No se permite editar pronosticos despues del inicio del partido.
- El ranking principal se ordena por puntos totales.
- Si hay empate en puntos, desempatar por cantidad de aciertos exactos.

## Reglas de desarrollo

- Stack principal: SvelteKit + TypeScript.
- Estilos: Tailwind CSS.
- Componentes UI: Flowbite para Svelte.
- Base de datos: Turso (libSQL).
- ORM recomendado: Drizzle.
- Gestor de paquetes: pnpm.

## Estructura esperada

- src/routes: paginas y endpoints de la app.
- src/lib: componentes compartidos, utilidades, servicios.
- src/lib/server: acceso a base de datos, repositorios y logica server.

## Assets e imagenes

- **Logo/icono de la app (copa):** `static/copacup.svg` y `src/lib/assets/favicon.svg` (copia). Es un SVG vectorial de la copa del mundo dorada con detalles verdes. Se usa como favicon, icono en la barra de navegación y en cualquier lugar donde se necesite representar la identidad de la app.
- **Logo del Mundial 2026:** `static/mundial_2026.png`. Es el logo oficial del torneo FIFA World Cup 2026. Se usa en el hero de la pagina principal y en contextos promocionales o de branding del torneo.

## Convenciones para agentes

- Antes de modificar logica de puntos, actualizar pruebas y documentacion.
- Evitar cambios destructivos en datos historicos.
- Priorizar cambios pequenos y faciles de revisar.
- Agregar validaciones del lado servidor aunque ya existan validaciones en UI.
- Documentar cualquier cambio de reglas del torneo en README.md.

## Modelo de datos minimo

- participants(id, name, active, created_at)
- teams(id, name, group_code)
- matches(id, stage, group_code, team_a_id, team_b_id, kickoff_at, score_a, score_b, is_closed)
- predictions(id, participant_id, match_id, pred_a, pred_b, created_at, updated_at)
- points(id, participant_id, match_id, points_awarded, reason)

## Definicion de terminado

Un cambio se considera completo cuando:
- Compila y no rompe rutas existentes.
- Respeta reglas de negocio arriba definidas.
- Incluye actualizacion de README si cambia comportamiento funcional.
