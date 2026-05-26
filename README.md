# Prode Mundial 2026

Este repositorio define las reglas, formato del torneo y base tecnica para construir una app de prode del Mundial 2026.

Objetivo del juego:
- Cada participante crea su propio prode.
- En cada partido, el participante ingresa su pronostico de goles para ambos equipos.
- El juego recorre todo el torneo: fase de grupos, llaves eliminatorias y final.
- Gana quien sume mas puntos.

## 1) Reglas de puntuacion

El sistema de puntuación es **100% configurable por torneo** desde el panel de administración. Cada torneo almacena su configuración completa en formato JSON.

### Puntuación por fase

Cada fase del torneo tiene estos parámetros aplicados por el cálculo automático:

| Concepto | Descripción |
|---|---|
| **Resultado (outcome)** | Acertar quién gana o si hay empate (1/X/2) |
| **Resultado exacto (exact)** | Acertar el marcador exacto; suma este bonus además del outcome |
| **Equipo que avanza (bracketTeam)** | Bonus de eliminación directa cuando el pronóstico acierta el equipo que pasa de ronda |

En fases de eliminación directa, los puntos de **Resultado** y **Resultado exacto** solo se otorgan si el pronóstico reconstruido tiene los dos equipos reales del partido, comparados por identidad/código de equipo. No alcanza con acertar que ganó el local o el visitante. Si el usuario no acertó ambos equipos del cruce, no suma outcome ni exact aunque el marcador coincida; solo puede sumar **Equipo que avanza** si acertó el equipo que pasó de ronda.

### Valores por defecto (basados en Qatar 2022 "Paxapoga")

| Fase | Resultado | R. Exacto | Equipo que avanza |
|---|:---:|:---:|:---:|
| Grupos | 1 | 2 | — |
| 16avos de final | 1 | 2 | 2 |
| Octavos | 1 | 2 | 3 |
| Cuartos | 1 | 2 | 4 |
| Semifinales | 1 | 2 | 5 |
| Final por tercer puesto | 1 | 2 | 6 |
| Final | 1 | 2 | 6 |

### Desempate
- Desempate 1: mayor cantidad de resultados exactos.
- Desempate 2: mayor cantidad de aciertos de resultado no exacto.

## 2) Participantes

Cada participante debe tener:
- Usuario para iniciar sesion.
- Clave.
- Nombre (unico dentro del torneo).
- Fecha de alta.
- Estado (activo/inactivo).

Regla operativa inicial:
- Si no existe ningun usuario, el primero que se registra/inicia sesion se crea automaticamente como administrador.
- Luego de eso, los nuevos usuarios se crean desde el panel de administracion.

Roles:
- player: puede iniciar sesion y cargar su prode.
- admin: puede jugar y ademas administrar usuarios, reglas, bloqueo global y resultados.

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
| **A** | 🇲🇽 México | 🇿🇦 Sudáfrica | 🇰🇷 Corea del Sur | 🇨🇿 República Checa |
| **B** | 🇨🇦 Canadá | 🇧🇦 Bosnia y Herzegovina | 🇶🇦 Catar | 🇨🇭 Suiza |
| **C** | 🇧🇷 Brasil | 🇲🇦 Marruecos | 🇭🇹 Haití | 🏴 Escocia |
| **D** | 🇺🇸 Estados Unidos | 🇵🇾 Paraguay | 🇦🇺 Australia | 🇹🇷 Turquía |
| **E** | 🇩🇪 Alemania | 🇨🇼 Curazao | 🇨🇮 Costa de Marfil | 🇪🇨 Ecuador |
| **F** | 🇳🇱 Países Bajos | 🇯🇵 Japón | 🇸🇪 Suecia | 🇹🇳 Túnez |
| **G** | 🇧🇪 Bélgica | 🇪🇬 Egipto | 🇮🇷 Irán | 🇳🇿 Nueva Zelanda |
| **H** | 🇪🇸 España | 🇨🇻 Cabo Verde | 🇸🇦 Arabia Saudita | 🇺🇾 Uruguay |
| **I** | 🇫🇷 Francia | 🇸🇳 Senegal | 🇳🇴 Noruega | 🇮🇶 Irak |
| **J** | 🇦🇷 Argentina | 🇩🇿 Argelia | 🇦🇹 Austria | 🇯🇴 Jordania |
| **K** | 🇵🇹 Portugal | 🇨🇩 República Democrática del Congo | 🇺🇿 Uzbekistán | 🇨🇴 Colombia |
| **L** | 🏴 Inglaterra | 🇭🇷 Croacia | 🇬🇭 Ghana | 🇵🇦 Panamá |

El fixture oficial de 104 partidos vive en `src/lib/worldcup-2026-fixture.ts` y fue extraído de la tabla local `src/partidos.html`. Los ids internos preservan la numeración FIFA: `g-001` a `g-072` son los partidos 1 a 72; `r32-01` a `final` son los partidos 73 a 104.

### Fase de eliminacion directa

Clasifican 32 equipos:
- 1 y 2 de cada grupo (24 equipos).
- Los 8 mejores terceros.

#### Criterios FIFA para ordenar grupos

Si dos o más equipos terminan empatados en puntos dentro de un grupo, se ordenan por:

1. Diferencia de goles en todos los partidos del grupo.
2. Goles marcados en todos los partidos del grupo.
3. Puntos obtenidos en los partidos entre los equipos empatados.
4. Diferencia de goles en los partidos entre los equipos empatados.
5. Goles marcados en los partidos entre los equipos empatados.
6. Conducta del equipo (fair play).
7. Sorteo o criterio manual FIFA si persiste el empate.

La app calcula automáticamente los criterios deportivos. El admin puede cargar el desempate manual para conducta/ranking FIFA; si queda un empate que afecta 1°, 2°, 3° o 4° del grupo, la llave no se sincroniza hasta resolverlo.

#### Criterios FIFA para los ocho mejores terceros

Los terceros se comparan entre grupos por:

1. Puntos obtenidos en todos los partidos de grupo.
2. Diferencia de goles en todos los partidos de grupo.
3. Goles marcados en todos los partidos de grupo.
4. Conducta del equipo (fair play).
5. Última Clasificación Mundial Masculina FIFA/Coca-Cola publicada.

La app usa el mismo desempate manual para los criterios 4 y 5, y no sincroniza 16avos si sigue empatado el corte entre el 8° y 9° mejor tercero.

#### 16avos de final

Los cruces base oficiales son:

- 2° Grupo A vs 2° Grupo B.
- 1° Grupo E vs 3° Grupo A/B/C/D/F.
- 1° Grupo F vs 2° Grupo C.
- 1° Grupo C vs 2° Grupo F.
- 1° Grupo I vs 3° Grupo C/D/F/G/H.
- 2° Grupo E vs 2° Grupo I.
- 1° Grupo A vs 3° Grupo C/E/F/H/I.
- 1° Grupo L vs 3° Grupo E/H/I/J/K.
- 1° Grupo D vs 3° Grupo B/E/F/I/J.
- 1° Grupo G vs 3° Grupo A/E/H/I/J.
- 2° Grupo K vs 2° Grupo L.
- 1° Grupo H vs 2° Grupo J.
- 1° Grupo B vs 3° Grupo E/F/G/I/J.
- 1° Grupo J vs 2° Grupo H.
- 1° Grupo K vs 3° Grupo D/E/I/J/L.
- 2° Grupo D vs 2° Grupo G.

La asignación de qué tercero va a cada cruce no se calcula con un matching genérico: sigue la tabla FIFA Annex C con las 495 combinaciones posibles de grupos terceros clasificados.
La progresión de ganadores y perdedores de las llaves está definida en `src/lib/bracket-rules.ts` mediante `FLOW`.
La app sincroniza automáticamente toda la llave: completa 16avos desde la tabla de grupos y luego propaga ganadores de eliminatorias cerradas hacia octavos, cuartos, semifinales, final por tercer puesto y final.
El Fixture completo del admin muestra el origen oficial de cada cruce de eliminación directa, por ejemplo `1° Grupo C vs 2° Grupo F`, aunque el partido ya esté resuelto como equipos reales.
El administrador puede editar manualmente los equipos de cualquier partido de eliminación directa desde el panel si hace falta resolver un desempate o aplicar una corrección operativa. La edición usa el ID/código canónico de equipo; si cambia un equipo en una llave con resultado cargado, se borra ese resultado y se resetean los cruces posteriores para recalcular puntos y clasificación con la identidad correcta. También puede eliminar resultados cargados desde el Fixture completo: al eliminar un resultado de grupos se reinicia la llave completa, y al eliminar un resultado de eliminación directa se reinician los cruces dependientes.

#### Octavos de final
- Juegan los 16 ganadores de 16avos.
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
- Base de datos: Turso (libSQL).
- Acceso a datos: Drizzle ORM con driver libSQL.
- Adaptador de produccion: @sveltejs/adapter-node.
- Autenticacion actual: usuario + clave con sesiones persistentes en base de datos.

Variables de entorno necesarias:
- TURSO_DATABASE_URL
- TURSO_AUTH_TOKEN
- SESSION_DURATION_DAYS
- ORIGIN

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

## 9) Puesta en marcha local

Inicio rapido recomendado (primera corrida):

```bash
pnpm bootstrap
```

Este comando ejecuta instalacion, corre smoke test de health (que dispara auto-inicializacion), valida tablas/migraciones y chequea compilacion.

Ademas, en runtime la app auto-inicializa la base local en el primer arranque y completa columnas faltantes si detecta un schema parcial.

1. Instalar dependencias:

```bash
pnpm install
```

2. Crear variables de entorno:

```bash
cp .env.example .env
```

3. Levantar la app:

```bash
pnpm dev
```

4. Abrir login y crear el primer usuario. Ese usuario sera administrador automaticamente si todavia no existe ninguno.

## 10) Despliegue a produccion

Comandos principales:

```bash
pnpm check
pnpm build
pnpm start
```

Base de datos:
- La app usa Turso/libSQL.
- Si no se define TURSO_DATABASE_URL, por defecto usa file:local.db para desarrollo local.
- El schema base tambien esta definido en drizzle.config.ts y drizzle/0000_initial.sql.

Comandos utiles de base:

```bash
pnpm db:generate
pnpm db:push
```

Contenedor:
- Hay Dockerfile listo para construir imagen Node y publicar el build de SvelteKit.

Healthcheck:
- Endpoint de verificacion: /health
- Incluye diagnostico de base: dbReady, schemaVersion y expectedSchemaVersion.

## 11) Seguridad actual

- Las claves ya no se guardan en texto plano: se hashean con scrypt.
- Las sesiones se almacenan en base de datos y la cookie es httpOnly.
- En produccion la cookie se marca secure automaticamente.
- Todas las validaciones sensibles siguen ejecutandose del lado servidor.

## 12) Criterios de aceptacion iniciales

- Se pueden crear participantes con nombre.
- Se pueden cargar pronosticos para todos los partidos.
- Se pueden cargar resultados reales.
- Se calculan puntos automaticamente.
- Se visualiza ranking total ordenado por puntos.
- Se identifica ganador del prode al terminar la final.

## 13) Nota de alcance

Este README define la logica de negocio del prode y la estructura del torneo.
Si FIFA ajusta cruces oficiales de 16avos, se actualiza esta seccion sin cambiar la base del sistema de puntuacion.

## 14) Deploy en produccion — Cloud Run

El stack de produccion usa:
- **Cloud Run** (Google): corre el servidor SvelteKit SSR
- **Google OAuth**: login con cuenta de Google

### Deploy rapido

```bash
cp .env.cloudrun.example .env.cloudrun
# editar .env.cloudrun con tus valores reales
pnpm ship
```

### Variables de entorno requeridas

| Variable | Descripcion |
|---|---|
| `GCP_PROJECT_ID` | ID del proyecto GCP |
| `TURSO_DATABASE_URL` | URL de Turso DB |
| `TURSO_AUTH_TOKEN` | Token de Turso |
| `ORIGIN` | URL publica (ej: `https://tu-dominio.com`) |
| `BODY_SIZE_LIMIT` | Limite de body para SvelteKit en Cloud Run (default `30M`) |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth |

### Guia completa

- [docs/deploy-guia-completa.md](docs/deploy-guia-completa.md) — Guia paso a paso de deploy a Cloud Run
- [docs/cloudrun-deploy.md](docs/cloudrun-deploy.md) — Deploy rapido a Cloud Run