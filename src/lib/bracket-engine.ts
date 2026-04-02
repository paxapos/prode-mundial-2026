/**
 * Client-side bracket engine.
 * Calculates group standings from predictions, auto-fills knockout slots,
 * and propagates winners through the bracket.
 */
import type { Match, GroupStandingRow, SideWinner } from '$lib/types';

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
					points: 0
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
	for (const [g, rows] of tables) {
		result[g] = [...rows.values()].sort((x, y) => {
			if (y.points !== x.points) return y.points - x.points;
			if (y.goalDiff !== x.goalDiff) return y.goalDiff - x.goalDiff;
			return y.goalsFor - x.goalsFor;
		});
	}
	return result;
}

function teamAt(
	standings: Record<string, GroupStandingRow[]>,
	group: string,
	pos: number
): string | null {
	return standings[group]?.[pos]?.team ?? null;
}

/* ------------------------------------------------------------------ */
/*  R32 slot definitions: which group position fills each slot        */
/* ------------------------------------------------------------------ */

const R32_DEFS: Record<
	string,
	{ aGroup: string; aPos: number; bGroup?: string; bPos?: number; bLabel: string }
> = {
	'r32-01': { aGroup: 'A', aPos: 0, bLabel: '3° C/D/E' },
	'r32-02': { aGroup: 'B', aPos: 0, bLabel: '3° A/D/E' },
	'r32-03': { aGroup: 'C', aPos: 0, bLabel: '3° A/B/F' },
	'r32-04': { aGroup: 'D', aPos: 0, bLabel: '3° B/E/F' },
	'r32-05': { aGroup: 'E', aPos: 0, bLabel: '3° A/C/D' },
	'r32-06': { aGroup: 'F', aPos: 0, bLabel: '3° B/C/D' },
	'r32-07': { aGroup: 'A', aPos: 1, bGroup: 'B', bPos: 1, bLabel: '2° B' },
	'r32-08': { aGroup: 'C', aPos: 1, bGroup: 'D', bPos: 1, bLabel: '2° D' },
	'r32-09': { aGroup: 'G', aPos: 0, bLabel: '3° I/J/K' },
	'r32-10': { aGroup: 'H', aPos: 0, bLabel: '3° G/J/K' },
	'r32-11': { aGroup: 'I', aPos: 0, bLabel: '3° G/H/L' },
	'r32-12': { aGroup: 'J', aPos: 0, bLabel: '3° H/I/L' },
	'r32-13': { aGroup: 'K', aPos: 0, bLabel: '3° G/I/J' },
	'r32-14': { aGroup: 'L', aPos: 0, bLabel: '3° H/K/L' },
	'r32-15': { aGroup: 'E', aPos: 1, bGroup: 'F', bPos: 1, bLabel: '2° F' },
	'r32-16': { aGroup: 'G', aPos: 1, bGroup: 'H', bPos: 1, bLabel: '2° H' }
};

/* ------------------------------------------------------------------ */
/*  Knockout flow: matchId → where winner/loser advance               */
/* ------------------------------------------------------------------ */

const FLOW: Record<string, { w: [string, 'A' | 'B']; l?: [string, 'A' | 'B'] }> = {
	'r32-01': { w: ['r16-01', 'A'] },
	'r32-02': { w: ['r16-01', 'B'] },
	'r32-03': { w: ['r16-02', 'A'] },
	'r32-04': { w: ['r16-02', 'B'] },
	'r32-05': { w: ['r16-03', 'A'] },
	'r32-06': { w: ['r16-03', 'B'] },
	'r32-07': { w: ['r16-04', 'A'] },
	'r32-08': { w: ['r16-04', 'B'] },
	'r32-09': { w: ['r16-05', 'A'] },
	'r32-10': { w: ['r16-05', 'B'] },
	'r32-11': { w: ['r16-06', 'A'] },
	'r32-12': { w: ['r16-06', 'B'] },
	'r32-13': { w: ['r16-07', 'A'] },
	'r32-14': { w: ['r16-07', 'B'] },
	'r32-15': { w: ['r16-08', 'A'] },
	'r32-16': { w: ['r16-08', 'B'] },
	'r16-01': { w: ['qf-01', 'A'] },
	'r16-02': { w: ['qf-01', 'B'] },
	'r16-03': { w: ['qf-02', 'A'] },
	'r16-04': { w: ['qf-02', 'B'] },
	'r16-05': { w: ['qf-03', 'A'] },
	'r16-06': { w: ['qf-03', 'B'] },
	'r16-07': { w: ['qf-04', 'A'] },
	'r16-08': { w: ['qf-04', 'B'] },
	'qf-01': { w: ['sf-01', 'A'] },
	'qf-02': { w: ['sf-01', 'B'] },
	'qf-03': { w: ['sf-02', 'A'] },
	'qf-04': { w: ['sf-02', 'B'] },
	'sf-01': { w: ['final', 'A'], l: ['3rd', 'A'] },
	'sf-02': { w: ['final', 'B'], l: ['3rd', 'B'] }
};

/* ------------------------------------------------------------------ */
/*  Winner / loser helper                                             */
/* ------------------------------------------------------------------ */

export function getWinner(
	teamA: string,
	teamB: string,
	pred: LivePred | undefined
): { winner: string | null; loser: string | null } {
	if (!pred || pred.predA === null || pred.predB === null)
		return { winner: null, loser: null };
	if (pred.predA > pred.predB) return { winner: teamA, loser: teamB };
	if (pred.predB > pred.predA) return { winner: teamB, loser: teamA };
	if (pred.predPenaltyWinner === 'A') return { winner: teamA, loser: teamB };
	if (pred.predPenaltyWinner === 'B') return { winner: teamB, loser: teamA };
	return { winner: null, loser: null };
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
