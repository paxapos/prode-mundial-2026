/**
 * Client-side bracket engine.
 * Calculates group standings from predictions, auto-fills knockout slots,
 * and propagates winners through the bracket.
 */
import type { Match, GroupStandingRow, SideWinner } from '$lib/types';
import { FLOW, R32_DEFS, resolveBestThirds, resolveWinner, sortGroupStandingRows, teamAt } from '$lib/bracket-rules';
import { getTeamId } from '$lib/teams';

export interface LivePred {
	predA: number | null;
	predB: number | null;
	predPenaltyWinner: SideWinner;
}

/* ------------------------------------------------------------------ */
/*  Group standings from predictions                                  */
/* ------------------------------------------------------------------ */

export function calcStandings(
	groupMatches: Match[],
	preds: Record<string, LivePred>
): Record<string, GroupStandingRow[]> {
	const tables = new Map<string, Map<string, GroupStandingRow>>();

	for (const match of groupMatches) {
		const g = match.groupCode ?? '?';
		if (!tables.has(g)) tables.set(g, new Map());
		const t = tables.get(g)!;
		for (const team of [match.teamA, match.teamB]) {
			if (!t.has(team))
				t.set(team, {
					team,
					played: 0,
					wins: 0,
					draws: 0,
					losses: 0,
					goalsFor: 0,
					goalsAgainst: 0,
					goalDiff: 0,
					points: 0,
					tiebreakerPoints: 0
				});
		}

		const p = preds[match.id];
		if (!p || p.predA === null || p.predB === null) continue;

		const a = t.get(match.teamA)!;
		const b = t.get(match.teamB)!;
		a.played++;
		b.played++;
		a.goalsFor += p.predA;
		a.goalsAgainst += p.predB;
		b.goalsFor += p.predB;
		b.goalsAgainst += p.predA;
		a.goalDiff = a.goalsFor - a.goalsAgainst;
		b.goalDiff = b.goalsFor - b.goalsAgainst;

		if (p.predA > p.predB) {
			a.wins++;
			b.losses++;
			a.points += 3;
		} else if (p.predB > p.predA) {
			b.wins++;
			a.losses++;
			b.points += 3;
		} else {
			a.draws++;
			b.draws++;
			a.points++;
			b.points++;
		}
	}

	const result: Record<string, GroupStandingRow[]> = {};
	const matchesByGroup = new Map<string, Match[]>();
	for (const match of groupMatches) {
		const g = match.groupCode ?? '?';
		let list = matchesByGroup.get(g);
		if (!list) {
			list = [];
			matchesByGroup.set(g, list);
		}
		list.push(match);
	}

	for (const [g, rows] of tables) {
		const groupMatchesList = matchesByGroup.get(g) ?? [];
		const matchesForGroup = groupMatchesList.map((match) => {
			const pred = preds[match.id];
			return {
				teamA: match.teamA,
				teamB: match.teamB,
				scoreA: pred?.predA ?? null,
				scoreB: pred?.predB ?? null
			};
		});
		result[g] = sortGroupStandingRows([...rows.values()], matchesForGroup);
	}
	return result;
}

/* ------------------------------------------------------------------ */
/*  Group position accuracy (prediction vs. reality)                  */
/* ------------------------------------------------------------------ */

export interface GroupPositionAccuracy {
	/** Cantidad de grupos cuyos partidos ya tienen todos resultado real (definidos). */
	decidedGroups: number;
	/** Posiciones comparadas en total (suma de equipos de los grupos definidos). */
	totalPositions: number;
	/** Posiciones en las que el equipo pronosticado coincide con el real. */
	correctPositions: number;
	/** Porcentaje 0-100 redondeado, o null si todavía no hay ningún grupo definido. */
	pct: number | null;
}

/**
 * Compara la tabla de posiciones que arman las predicciones del usuario contra
 * la tabla real (según los resultados cargados). Sólo cuenta los grupos que ya
 * están completamente jugados, para que el porcentaje refleje aciertos firmes.
 */
export function calcGroupPositionAccuracy(
	groupMatches: Match[],
	preds: Record<string, LivePred>
): GroupPositionAccuracy {
	// Reutilizamos calcStandings tratando los resultados reales como "predicciones".
	const realPreds: Record<string, LivePred> = {};
	for (const m of groupMatches) {
		if (m.scoreA === null || m.scoreB === null) continue;
		realPreds[m.id] = { predA: m.scoreA, predB: m.scoreB, predPenaltyWinner: m.penaltyWinner };
	}

	const predictedStandings = calcStandings(groupMatches, preds);
	const actualStandings = calcStandings(groupMatches, realPreds);

	const totalByGroup = new Map<string, number>();
	const playedByGroup = new Map<string, number>();
	for (const m of groupMatches) {
		const g = m.groupCode ?? '?';
		totalByGroup.set(g, (totalByGroup.get(g) ?? 0) + 1);
		if (m.scoreA !== null && m.scoreB !== null) {
			playedByGroup.set(g, (playedByGroup.get(g) ?? 0) + 1);
		}
	}

	let decidedGroups = 0;
	let totalPositions = 0;
	let correctPositions = 0;

	for (const [g, total] of totalByGroup) {
		if ((playedByGroup.get(g) ?? 0) < total) continue; // grupo aún sin terminar
		const predicted = predictedStandings[g] ?? [];
		const actual = actualStandings[g] ?? [];
		if (actual.length === 0) continue;
		decidedGroups++;
		totalPositions += actual.length;
		for (let i = 0; i < actual.length; i++) {
			if (predicted[i] && actual[i] && predicted[i].team === actual[i].team) {
				correctPositions++;
			}
		}
	}

	const pct = totalPositions > 0 ? Math.round((correctPositions / totalPositions) * 100) : null;
	return { decidedGroups, totalPositions, correctPositions, pct };
}

/* ------------------------------------------------------------------ */
/*  Winner / loser helper                                             */
/* ------------------------------------------------------------------ */

export function getWinner(
	teamA: string,
	teamB: string,
	pred: LivePred | undefined
): { winner: string | null; loser: string | null } {
	return resolveWinner(teamA, teamB, pred?.predA ?? null, pred?.predB ?? null, pred?.predPenaltyWinner ?? null);
}

/* ------------------------------------------------------------------ */
/*  Build full bracket with auto-filled teams                         */
/* ------------------------------------------------------------------ */

export interface BracketSlot {
	teamA: string;
	teamB: string;
	autoA: boolean;
	autoB: boolean;
}

export function buildBracket(
	matches: Match[],
	preds: Record<string, LivePred>
): Record<string, BracketSlot> {
	const groupMatches = matches.filter((m) => m.stage === 'groups');
	const standings = calcStandings(groupMatches, preds);
	const bracket: Record<string, BracketSlot> = {};

	// Init all knockout matches with original placeholder names
	for (const m of matches) {
		if (m.stage === 'groups') continue;
		bracket[m.id] = { teamA: m.teamA, teamB: m.teamB, autoA: false, autoB: false };
	}

	// Auto-fill R32 from group standings
	for (const [matchId, def] of Object.entries(R32_DEFS)) {
		const slot = bracket[matchId];
		if (!slot) continue;

		const aTeam = teamAt(standings, def.aGroup, def.aPos);
		if (aTeam) {
			slot.teamA = aTeam;
			slot.autoA = true;
		}
		if (def.bGroup !== undefined && def.bPos !== undefined) {
			const bTeam = teamAt(standings, def.bGroup, def.bPos);
			if (bTeam) {
				slot.teamB = bTeam;
				slot.autoB = true;
			}
		}
	}

	// Auto-fill best 8 third-placed teams
	const thirdAssignment = resolveBestThirds(standings);
	for (const [matchId, group] of thirdAssignment) {
		const slot = bracket[matchId];
		if (!slot) continue;
		const team = teamAt(standings, group, 2);
		if (team) {
			slot.teamB = team;
			slot.autoB = true;
		}
	}

	// Propagate knockout winners in chronological order
	const knockoutIds = matches
		.filter((m) => m.stage !== 'groups' && m.id !== 'final' && m.id !== '3rd')
		.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
		.map((m) => m.id);

	for (const matchId of knockoutIds) {
		const slot = bracket[matchId];
		if (!slot) continue;

		const pred = preds[matchId];
		const flow = FLOW[matchId];
		if (!flow) continue;

		const { winner, loser } = getWinner(slot.teamA, slot.teamB, pred);

		if (winner) {
			const [targetId, side] = flow.w;
			const target = bracket[targetId];
			if (target) {
				if (side === 'A') {
					target.teamA = winner;
					target.autoA = true;
				} else {
					target.teamB = winner;
					target.autoB = true;
				}
			}
		}
		if (loser && flow.l) {
			const [targetId, side] = flow.l;
			const target = bracket[targetId];
			if (target) {
				if (side === 'A') {
					target.teamA = loser;
					target.autoA = true;
				} else {
					target.teamB = loser;
					target.autoB = true;
				}
			}
		}
	}

	return bracket;
}

/* ------------------------------------------------------------------ */
/*  Bracket accuracy (prediction vs. reality, with forward propagation) */
/* ------------------------------------------------------------------ */

export type SideAccuracy = 'pending' | 'hit' | 'miss';

export interface BracketAccuracy {
	a: SideAccuracy;
	b: SideAccuracy;
	/** Ambos lados resueltos y errados → llave muerta (sin chances de sumar). */
	dead: boolean;
	/** Equipo real que ocupa cada lado, si ya se conoce. */
	realA?: string;
	realB?: string;
}

/**
 * Para cada cruce de eliminación directa indica si los equipos pronosticados coinciden con la
 * realidad (`hit`), ya no pueden coincidir (`miss`) o todavía no se sabe (`pending`).
 *
 * Un lado es `miss` cuando: (a) ya se conoce el equipo real y no es el pronosticado, (b) el
 * equipo pronosticado quedó eliminado de la realidad, o (c) **propagación**: ese equipo ya
 * había errado en su cruce de origen (no es el que realmente avanza). La propagación arrastra
 * el error hacia 8vos, 4tos, etc. aunque el equipo siga vivo en otra zona del cuadro y el
 * casillero real de la ronda siguiente todavía no se conozca: si una llave queda muerta en
 * 16avos, no hay equipo que pase, así que los casilleros que dependen de ella también se marcan.
 */
export function calcBracketAccuracy(
	matches: Match[],
	bracket: Record<string, BracketSlot>,
	progressiveR32: Record<string, { A?: string; B?: string }>,
	eliminatedTeams: string[]
): Record<string, BracketAccuracy> {
	const realTeamIds = new Set<string>();
	for (const m of matches) {
		if (m.stage !== 'groups') continue;
		realTeamIds.add(getTeamId(m.teamA));
		realTeamIds.add(getTeamId(m.teamB));
	}
	const eliminatedSet = new Set(eliminatedTeams.map((t) => getTeamId(t)));

	// Equipo real ya definido para cada lado del cruce.
	// 16avos: resolución progresiva del servidor. Rondas siguientes: surge del cruce previo ya jugado.
	const realSlot = (match: Match): { A?: string; B?: string } => {
		if (match.stage === 'round32') return progressiveR32[match.id] ?? {};
		const out: { A?: string; B?: string } = {};
		if (realTeamIds.has(getTeamId(match.teamA))) out.A = match.teamA;
		if (realTeamIds.has(getTeamId(match.teamB))) out.B = match.teamB;
		return out;
	};

	const sideAccuracy = (
		realTeam: string | undefined,
		predTeam: string | undefined,
		predResolved: boolean
	): SideAccuracy => {
		if (!predResolved || !predTeam) return 'pending';
		if (realTeam) return getTeamId(predTeam) === getTeamId(realTeam) ? 'hit' : 'miss';
		if (eliminatedSet.has(getTeamId(predTeam))) return 'miss';
		return 'pending';
	};

	// Inverso de FLOW: a qué casillero (`matchId:side`) alimenta el ganador/perdedor de cada cruce.
	const feederOf = new Map<string, string>();
	for (const [fromId, flow] of Object.entries(FLOW)) {
		feederOf.set(`${flow.w[0]}:${flow.w[1]}`, fromId);
		if (flow.l) feederOf.set(`${flow.l[0]}:${flow.l[1]}`, fromId);
	}

	const result: Record<string, BracketAccuracy> = {};

	// Precisión de un equipo dentro de un cruce ya calculado, según el lado que ocupa.
	const teamAccuracyInMatch = (matchId: string, team: string): SideAccuracy | null => {
		const acc = result[matchId];
		const slot = bracket[matchId];
		if (!acc || !slot) return null;
		if (getTeamId(slot.teamA) === getTeamId(team)) return acc.a;
		if (getTeamId(slot.teamB) === getTeamId(team)) return acc.b;
		return null;
	};

	// Orden cronológico: así cada cruce ya tiene calculado el cruce que lo alimenta.
	const knockout = matches
		.filter((m) => m.stage !== 'groups')
		.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

	for (const match of knockout) {
		const slot = bracket[match.id];
		const real = realSlot(match);
		let a = sideAccuracy(real.A, slot?.teamA, !!slot?.autoA);
		let b = sideAccuracy(real.B, slot?.teamB, !!slot?.autoB);

		// Propagación del "miss" desde el cruce de origen.
		if (a === 'pending' && slot?.teamA) {
			const fromId = feederOf.get(`${match.id}:A`);
			if (fromId && teamAccuracyInMatch(fromId, slot.teamA) === 'miss') a = 'miss';
		}
		if (b === 'pending' && slot?.teamB) {
			const fromId = feederOf.get(`${match.id}:B`);
			if (fromId && teamAccuracyInMatch(fromId, slot.teamB) === 'miss') b = 'miss';
		}

		result[match.id] = { a, b, dead: a === 'miss' && b === 'miss', realA: real.A, realB: real.B };
	}

	return result;
}
