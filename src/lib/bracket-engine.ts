/**
 * Client-side bracket engine.
 * Calculates group standings from predictions, auto-fills knockout slots,
 * and propagates winners through the bracket.
 */
import type { Match, GroupStandingRow, SideWinner } from '$lib/types';
import { FLOW, R32_DEFS, resolveBestThirds, resolveWinner, sortGroupStandingRows, teamAt } from '$lib/bracket-rules';

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
	for (const [g, rows] of tables) {
		const matchesForGroup = groupMatches
			.filter((match) => match.groupCode === g)
			.map((match) => {
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
