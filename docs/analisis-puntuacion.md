# Analisis del Sistema de Puntuacion — Prode Mundial 2026

## 1. Reglas del torneo anterior (Qatar 2022 — Paxapoga)

El PDF del torneo anterior usaba este esquema:

| Etapa | Concepto | Puntos |
|---|---|---|
| **Grupos** | Acierto de resultado (signo) | 1 |
| **Grupos** | Acierto de resultado con goles (exacto) | 1 adicional |
| **Octavos** | Equipo correcto en llave | 2 |
| **Octavos** | Acierto resultado partido* | 3 |
| **Octavos** | Acierto resultado con goles* | 3 |
| **Cuartos** | Equipo correcto en llave | 3 |
| **Cuartos** | Acierto resultado partido* | 4 |
| **Cuartos** | Acierto resultado con goles* | 4 |
| **Semifinales** | Equipo correcto en llave | 4 |
| **Semifinales** | Acierto resultado partido* | 5 |
| **Semifinales** | Acierto resultado con goles* | 5 |
| **Finales** | Equipo correcto en llave | 5 |
| **Finales** | Acierto resultado partido* | 6 |
| **Finales** | Acierto resultado con goles* | 6 |
| **Bonus** | Campeon | 10 |
| **Bonus** | Subcampeon | 6 |
| **Bonus** | Tercero | 5 |

> (*) Solo si ambos equipos estan ubicados correctamente en la llave.

## 2. Adaptacion al Mundial 2026 (con Ronda de 32)

El Mundial 2026 tiene una ronda extra (32avos = dieciseisavos). El sistema debe escalar:

| Etapa | Equipo en llave | Resultado* | Exacto* |
|---|---|---|---|
| Grupos | — | 1 | +1 |
| 32avos | 1 | 2 | +2 |
| Octavos | 2 | 3 | +3 |
| Cuartos | 3 | 4 | +4 |
| Semifinales | 4 | 5 | +5 |
| Final/3er puesto | 5 | 6 | +6 |

### Bonus especiales

| Concepto | Puntos |
|---|---|
| Campeon | 10 |
| Subcampeon | 6 |
| Tercer puesto | 5 |

### Llave invertida (equipo correcto, lado equivocado)
Si el participante acerto que un equipo llega a cierta ronda pero en el lado opuesto del cuadro, recibe **la mitad de los puntos de llave** (redondeado hacia abajo). Ejemplo: si acertar equipo en octavos vale 2 pts, llave invertida vale 1 pt.

## 3. Analisis: como hacer que sea divertido y peleado

### Problema tipico
En la mayoria de prodes, los primeros 3-4 puestos se definen en la fase de grupos porque es donde se juegan mas partidos (48 en grupos vs ~15 en llaves). Los resultados de llaves llegan tarde y no alcanzan a revertir diferencias.

### Solucion propuesta: puntos escalados + bonificaciones de llave

La escala progresiva (2→3→4→5→6) logra que las llaves valgan **mucho mas** que los grupos. Veamos con numeros:

| Etapa | Partidos | Max pts por partido (exacto+llave) | Max total etapa |
|---|---|---|---|
| Grupos | 48 | 2 (1+1) | 96 |
| 32avos | 16 | 5 (1+2+2) | 80 |
| Octavos | 8 | 8 (2+3+3) | 64 |
| Cuartos | 4 | 11 (3+4+4) | 44 |
| Semis | 2 | 14 (4+5+5) | 28 |
| Final+3ro | 2 | 17 (5+6+6) | 34 |
| Bonus | — | — | 21 |
| **TOTAL** | **80** | — | **367** |

El % de puntos por fase:
- Grupos: 26% del total
- Llaves (incluyendo bonus): **74% del total**

Esto garantiza que **siempre se puede remontar** hasta la final. Un jugador que arrancó mal en grupos puede recuperarse si acierta las llaves.

### Sugerencias adicionales para maximizar la diversion

1. **Comodin de confianza (opcional futuro):** Cada participante puede marcar N partidos durante el torneo como "comodin" — si acierta, duplica los puntos de ese partido. Agrega estrategia.

2. **Puntos por posicion final en grupo:** Dar 1 punto por cada equipo que aciertes en su posicion final dentro del grupo (1ro, 2do, 3ro, 4to). Maximo 4 por grupo = 48 puntos extra. Esto enriquece la fase de grupos sin dominar el torneo.

3. **Apuestas de llave antes del torneo:** Antes de que arranque, cada participante llena la llave completa (quien pasa de cada grupo, y toda la eliminatoria). Ese pronostico pre-torneo se compara al final y da puntos bonus por cada acierto. Esto genera expectativa desde el dia 1.

4. **Desempate por cercania:** Si dos jugadores tienen los mismos puntos y los mismos aciertos exactos, desempatar por diferencia de goles acumulada (suma de |gol_pred - gol_real| para todos los partidos). El que tiene menor diferencia gana.

### Recomendacion final

El esquema escalado propuesto (1-1-2-3-4-5-6) con bonus de campeon/subcampeon/tercero es el que mejor balancea:
- Recompensa al que sabe de futbol desde los grupos
- Da oportunidad de remontada con las llaves
- Hace que cada ronda sea mas emocionante que la anterior
- El campeon vale 10 puntos = lo mismo que acertar 5 partidos exactos de grupos

**Todo el sistema es 100% configurable por torneo** desde la tabla `scoring_config` en la base de datos, asi que se puede ajustar entre torneos sin tocar codigo.

## 4. Premios

| Posicion | Premio |
|---|---|
| 1er puesto | 50% del pozo |
| 2do puesto | 30% del pozo |
| 3er puesto | 20% del pozo |
