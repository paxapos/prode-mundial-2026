# Prode Mundial 2026

Este repositorio define las reglas, formato del torneo y base tecnica para construir una app de prode del Mundial 2026.

Objetivo del juego:
- Cada participante crea su propio prode.
- En cada partido, el participante ingresa su pronostico de goles para ambos equipos.
- El juego recorre todo el torneo: fase de grupos, llaves eliminatorias y final.
- Gana quien sume mas puntos.

## 1) Reglas de puntuacion propuestas

Sistema simple y claro para empezar (se puede ajustar luego):

- 3 puntos: acierta el resultado exacto (goles de ambos equipos).
- 1 punto: acierta solo el signo del partido (gana local, empate o gana visitante).
- 0 puntos: no acierta ni marcador exacto ni signo.

Reglas opcionales para desempate:
- Desempate 1: mayor cantidad de resultados exactos.
- Desempate 2: mejor precision en semifinales y final.

## 2) Participantes

Cada participante debe tener:
- Nombre (unico dentro del torneo).
- Fecha de alta.
- Estado (activo/inactivo).

Ejemplo:
- Juan Perez
- Maria Gomez
- Pedro Ruiz

## 3) Carga de pronosticos por partido

Cada partido debe tener inputs para:
- Goles Equipo A (numero entero >= 0).
- Goles Equipo B (numero entero >= 0).

Reglas de carga:
- Solo se puede pronosticar antes del inicio del partido.
- Si el partido ya empezo, el pronostico queda bloqueado.
- Cada participante puede guardar un solo pronostico por partido (si edita, reemplaza el anterior mientras este abierto).

## 4) Estructura del torneo

### Fase de grupos (48 equipos)

El torneo se divide en 12 grupos de 4 equipos.

| Grupo | Equipo 1 | Equipo 2 | Equipo 3 | Equipo 4 |
| :--- | :--- | :--- | :--- | :--- |
| **A** | 🇲🇽 Mexico | 🇿🇦 Sudafrica | 🇰🇷 Corea del Sur | 🇨🇿 Rep. Checa |
| **B** | 🇨🇦 Canada | 🇧🇦 Bosnia y Herz. | 🇶🇦 Catar | 🇨🇭 Suiza |
| **C** | 🇧🇷 Brasil | 🇲🇦 Marruecos | 🇭🇹 Haiti | 🏴 Escocia |
| **D** | 🇺🇸 Estados Unidos | 🇵🇾 Paraguay | 🇦🇺 Australia | 🇹🇷 Turquia |
| **E** | 🇩🇪 Alemania | 🇨🇼 Curazao | 🇨🇮 Costa de Marfil | 🇪🇨 Ecuador |
| **F** | 🇳🇱 Paises Bajos | 🇯🇵 Japon | 🇹🇳 Tunez | 🇵🇱 Polonia |
| **G** | 🇧🇪 Belgica | 🇪🇬 Egipto | 🇮🇷 Iran | 🇳🇿 Nueva Zelanda |
| **H** | 🇪🇸 Espana | 🇨🇻 Cabo Verde | 🇸🇦 Arabia Saudita | 🇺🇾 Uruguay |
| **I** | 🇫🇷 Francia | 🇸🇳 Senegal | 🇳🇴 Noruega | 🇧🇴 Bolivia |
| **J** | 🇦🇷 Argentina | 🇩🇿 Argelia | 🇦🇹 Austria | 🇯🇴 Jordania |
| **K** | 🇵🇹 Portugal | 🇨🇩 RD Congo | 🇺🇿 Uzbekistan | 🇨🇴 Colombia |
| **L** | 🏴 Inglaterra | 🇭🇷 Croacia | 🇬🇭 Ghana | 🇵🇦 Panama |

### Fase de eliminacion directa

Clasifican 32 equipos:
- 1 y 2 de cada grupo (24 equipos).
- Los 8 mejores terceros.

#### Ronda de 32 (dieciseisavos)

La organizacion de cruces busca evitar que equipos del mismo grupo se crucen temprano.

Llave superior (referencia de cruces):
- Ganador Grupo A vs 3 C/E/F.
- Ganador Grupo B vs 3 A/C/D.
- Ganador Grupo E vs 2 Grupo F.
- Ganador Grupo F vs 2 Grupo E.
- Ganador Grupo I vs 3 G/H/J.
- Ganador Grupo J vs 2 Grupo I.

Llave inferior (referencia de cruces):
- Ganador Grupo C vs 2 Grupo D.
- Ganador Grupo D vs 3 B/E/F.
- Ganador Grupo G vs 3 I/J/L.
- Ganador Grupo H vs 2 Grupo G.
- Ganador Grupo K vs 2 Grupo L.
- Ganador Grupo L vs 2 Grupo K.

#### Octavos de final
- Juegan los 16 ganadores de la ronda de 32.
- La llave superior y la llave inferior se mantienen separadas hasta la final.

#### Cuartos de final
- Participan 8 equipos.
- Sedes previstas en EE. UU.: Los Angeles, Kansas City, Miami y Boston.

#### Semifinales
- Semi 1: ganador de la llave superior (grupos A, B, E, F, I, J).
- Semi 2: ganador de la llave inferior (grupos C, D, G, H, K, L).

#### Gran final
- Fecha: 19 de julio de 2026.
- Estadio: MetLife Stadium, Nueva Jersey (Nueva York).
- Partido: ganador Semi 1 vs ganador Semi 2.

Dato clave:
- El campeon jugara 8 partidos para levantar la copa.

## 5) Base funcional (MVP)

Para una primera version:

- Gestion de participantes.
- Listado de partidos por fase.
- Formulario de pronostico por partido.
- Carga de resultados reales.
- Calculo automatico de puntos.
- Tabla de posiciones global.

## 6) Base tecnica sugerida: SvelteKit + TursoDB

Stack recomendado:
- Frontend/App: SvelteKit.
- Estilos: Tailwind CSS.
- UI: Flowbite para Svelte.
- Base de datos: Turso (libSQL).
- Acceso a datos: Drizzle ORM con driver libSQL.

Variables de entorno necesarias:
- TURSO_DATABASE_URL
- TURSO_AUTH_TOKEN

Modelo de datos inicial sugerido:

- participants
	- id
	- name
	- active
	- created_at

- teams
	- id
	- name
	- group_code

- matches
	- id
	- stage (groups, round1, quarterfinal, semifinal, final)
	- group_code (nullable)
	- team_a_id
	- team_b_id
	- kickoff_at
	- score_a (nullable)
	- score_b (nullable)
	- is_closed

- predictions
	- id
	- participant_id
	- match_id
	- pred_a
	- pred_b
	- created_at
	- updated_at
	- unique(participant_id, match_id)

- points
	- id
	- participant_id
	- match_id
	- points_awarded
	- reason

## 7) Rutas y modulos sugeridos en SvelteKit

Rutas de app:
- /participantes
- /partidos
- /pronosticos
- /tabla
- /admin/resultados

Endpoints server (ejemplo):
- GET /api/matches
- POST /api/predictions
- POST /api/results
- GET /api/leaderboard

## 8) Roadmap de implementacion

1. Inicializar proyecto SvelteKit con Tailwind y Flowbite.
2. Configurar Turso y Drizzle.
3. Crear esquema y migraciones.
4. Seed de equipos y partidos de fase de grupos.
5. CRUD de participantes.
6. Formulario de pronosticos por partido.
7. Modulo de resultados reales + calculo de puntos.
8. Tabla de posiciones y desempates.
9. Soporte completo de llaves hasta la final.

## 9) Criterios de aceptacion iniciales

- Se pueden crear participantes con nombre.
- Se pueden cargar pronosticos para todos los partidos.
- Se pueden cargar resultados reales.
- Se calculan puntos automaticamente.
- Se visualiza ranking total ordenado por puntos.
- Se identifica ganador del prode al terminar la final.

## 10) Nota de alcance

Este README define la logica de negocio del prode y la estructura del torneo.
Si FIFA ajusta cruces oficiales de ronda de 32, se actualiza esta seccion sin cambiar la base del sistema de puntuacion.