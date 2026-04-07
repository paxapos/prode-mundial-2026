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
/*  R32 slot definitions (FIFA 2026 official bracket)                 */
/*  FIFA#  r32-ID   Description                                      */
/*  M73    r32-01   2°A vs 2°B                                       */
/*  M74    r32-02   1°E vs 3° (A/B/C/D/F)                            */
/*  M75    r32-03   1°F vs 2°C                                       */
/*  M76    r32-04   1°C vs 2°F                                       */
/*  M77    r32-05   1°I vs 3° (C/D/F/G/H)                            */
/*  M78    r32-06   2°E vs 2°I                                       */
/*  M79    r32-07   1°A vs 3° (C/E/F/H/I)                            */
/*  M80    r32-08   1°L vs 3° (E/H/I/J/K)                            */
/*  M81    r32-09   1°D vs 3° (B/E/F/I/J)                            */
/*  M82    r32-10   1°G vs 3° (A/E/H/I/J)                            */
/*  M83    r32-11   2°K vs 2°L                                       */
/*  M84    r32-12   1°H vs 2°J                                       */
/*  M85    r32-13   1°B vs 3° (E/F/G/I/J)                            */
/*  M86    r32-14   1°J vs 2°H                                       */
/*  M87    r32-15   1°K vs 3° (D/E/I/J/L)                            */
/*  M88    r32-16   2°D vs 2°G                                       */
/* ------------------------------------------------------------------ */

const R32_DEFS: Record<
	string,
	{ aGroup: string; aPos: number; bGroup?: string; bPos?: number; bLabel: string }
> = {
	'r32-01': { aGroup: 'A', aPos: 1, bGroup: 'B', bPos: 1, bLabel: '2° B' },
	'r32-02': { aGroup: 'E', aPos: 0, bLabel: '3° A/B/C/D/F' },
	'r32-03': { aGroup: 'F', aPos: 0, bGroup: 'C', bPos: 1, bLabel: '2° C' },
	'r32-04': { aGroup: 'C', aPos: 0, bGroup: 'F', bPos: 1, bLabel: '2° F' },
	'r32-05': { aGroup: 'I', aPos: 0, bLabel: '3° C/D/F/G/H' },
	'r32-06': { aGroup: 'E', aPos: 1, bGroup: 'I', bPos: 1, bLabel: '2° I' },
	'r32-07': { aGroup: 'A', aPos: 0, bLabel: '3° C/E/F/H/I' },
	'r32-08': { aGroup: 'L', aPos: 0, bLabel: '3° E/H/I/J/K' },
	'r32-09': { aGroup: 'D', aPos: 0, bLabel: '3° B/E/F/I/J' },
	'r32-10': { aGroup: 'G', aPos: 0, bLabel: '3° A/E/H/I/J' },
	'r32-11': { aGroup: 'K', aPos: 1, bGroup: 'L', bPos: 1, bLabel: '2° L' },
	'r32-12': { aGroup: 'H', aPos: 0, bGroup: 'J', bPos: 1, bLabel: '2° J' },
	'r32-13': { aGroup: 'B', aPos: 0, bLabel: '3° E/F/G/I/J' },
	'r32-14': { aGroup: 'J', aPos: 0, bGroup: 'H', bPos: 1, bLabel: '2° H' },
	'r32-15': { aGroup: 'K', aPos: 0, bLabel: '3° D/E/I/J/L' },
	'r32-16': { aGroup: 'D', aPos: 1, bGroup: 'G', bPos: 1, bLabel: '2° G' }
};

/* ------------------------------------------------------------------ */
/*  Best-8 third-placed teams auto-fill                               */
/* ------------------------------------------------------------------ */

const ALL_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

/** Which groups' third-placed teams can fill each R32 slot */
const THIRD_PLACE_SLOTS: Record<string, string[]> = {
	'r32-02': ['A', 'B', 'C', 'D', 'F'],
	'r32-05': ['C', 'D', 'F', 'G', 'H'],
	'r32-07': ['C', 'E', 'F', 'H', 'I'],
	'r32-08': ['E', 'H', 'I', 'J', 'K'],
	'r32-09': ['B', 'E', 'F', 'I', 'J'],
	'r32-10': ['A', 'E', 'H', 'I', 'J'],
	'r32-13': ['E', 'F', 'G', 'I', 'J'],
	'r32-15': ['D', 'E', 'I', 'J', 'L']
};

/**
 * Determines the best 8 third-placed teams and assigns each to the
 * appropriate R32 match slot via constraint-based backtracking.
 * Returns a Map of matchId → group letter (e.g. 'r32-02' → 'F').
 */
function resolveBestThirds(
	standings: Record<string, GroupStandingRow[]>
): Map<string, string> {
	const thirds: { group: string; row: GroupStandingRow }[] = [];
	for (const g of ALL_GROUPS) {
		const row = standings[g]?.[2]; // 0-indexed: pos 2 = 3rd place
		if (row) thirds.push({ group: g, row });
	}

	if (thirds.length < 8) return new Map();

	// Rank by points → goal difference → goals scored
	thirds.sort((a, b) => {
		if (b.row.points !== a.row.points) return b.row.points - a.row.points;
		if (b.row.goalDiff !== a.row.goalDiff) return b.row.goalDiff - a.row.goalDiff;
		return b.row.goalsFor - a.row.goalsFor;
	});

	const best8 = new Set(thirds.slice(0, 8).map((t) => t.group));

	// Assign via backtracking (deterministic: slots and groups in sorted order)
	const slotIds = Object.keys(THIRD_PLACE_SLOTS);
	const assignment = new Map<string, string>();
	const used = new Set<string>();

	function solve(idx: number): boolean {
		if (idx === slotIds.length) return true;
		const slotId = slotIds[idx];
		for (const g of THIRD_PLACE_SLOTS[slotId]) {
			if (!best8.has(g) || used.has(g)) continue;
			assignment.set(slotId, g);
			used.add(g);
			if (solve(idx + 1)) return true;
			assignment.delete(slotId);
			used.delete(g);
		}
		return false;
	}

	solve(0);
	return assignment;
}

/* ------------------------------------------------------------------ */
/*  Knockout flow: matchId → where winner/loser advance               */
/* ------------------------------------------------------------------ */

const FLOW: Record<string, { w: [string, 'A' | 'B']; l?: [string, 'A' | 'B'] }> = {
	// R32 → R16 (FIFA official bracket)
	'r32-01': { w: ['r16-02', 'A'] }, // M73→M90 A
	'r32-02': { w: ['r16-01', 'A'] }, // M74→M89 A
	'r32-03': { w: ['r16-02', 'B'] }, // M75→M90 B
	'r32-04': { w: ['r16-03', 'A'] }, // M76→M91 A
	'r32-05': { w: ['r16-01', 'B'] }, // M77→M89 B
	'r32-06': { w: ['r16-03', 'B'] }, // M78→M91 B
	'r32-07': { w: ['r16-04', 'A'] }, // M79→M92 A
	'r32-08': { w: ['r16-04', 'B'] }, // M80→M92 B
	'r32-09': { w: ['r16-06', 'A'] }, // M81→M94 A
	'r32-10': { w: ['r16-06', 'B'] }, // M82→M94 B
	'r32-11': { w: ['r16-05', 'A'] }, // M83→M93 A
	'r32-12': { w: ['r16-05', 'B'] }, // M84→M93 B
	'r32-13': { w: ['r16-08', 'A'] }, // M85→M96 A
	'r32-14': { w: ['r16-07', 'A'] }, // M86→M95 A
	'r32-15': { w: ['r16-08', 'B'] }, // M87→M96 B
	'r32-16': { w: ['r16-07', 'B'] }, // M88→M95 B
	// R16 → QF
	'r16-01': { w: ['qf-01', 'A'] }, // M89→M97 A
	'r16-02': { w: ['qf-01', 'B'] }, // M90→M97 B
	'r16-03': { w: ['qf-03', 'A'] }, // M91→M99 A
	'r16-04': { w: ['qf-03', 'B'] }, // M92→M99 B
	'r16-05': { w: ['qf-02', 'A'] }, // M93→M98 A
	'r16-06': { w: ['qf-02', 'B'] }, // M94→M98 B
	'r16-07': { w: ['qf-04', 'A'] }, // M95→M100 A
	'r16-08': { w: ['qf-04', 'B'] }, // M96→M100 B
	// QF → SF
	'qf-01': { w: ['sf-01', 'A'] },
	'qf-02': { w: ['sf-01', 'B'] },
	'qf-03': { w: ['sf-02', 'A'] },
	'qf-04': { w: ['sf-02', 'B'] },
	// SF → Final / 3rd
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
