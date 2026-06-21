import { getMatchOutcome, resolveWinner } from '$lib/bracket-rules';
import { calcStandings, type LivePred } from '$lib/bracket-engine';
import { getStageConfig } from '$lib/scoring-config';
import { getTeamId } from '$lib/teams';
import type {
	GroupPositionPointDetail,
	GroupStagePointResult,
	Match,
	MatchPointDetail,
	Prediction,
	ScoringConfig,
	SideWinner
} from '$lib/types';

export type PredictionPointResult = MatchPointDetail & {
	exactHit: boolean;
	outcomeHit: boolean;
};

export type PredictedMatchTeams = Pick<Match, 'teamA' | 'teamB'>;

function penaltyWinnerTeam(teamA: string, teamB: string, penaltyWinner: SideWinner): string | null {
	if (penaltyWinner === 'A') return teamA;
	if (penaltyWinner === 'B') return teamB;
	return null;
}

function sameTeam(a: string | null, b: string | null): boolean {
	return !!a && !!b && getTeamId(a) === getTeamId(b);
}

function hasExactKnockoutTeams(match: Match, predictedTeams: PredictedMatchTeams): boolean {
	const predictedTeamSet = new Set([getTeamId(predictedTeams.teamA), getTeamId(predictedTeams.teamB)]);
	return predictedTeamSet.has(getTeamId(match.teamA)) && predictedTeamSet.has(getTeamId(match.teamB));
}

export function calculatePredictionPoints(
	prediction: Prediction,
	match: Match,
	config: ScoringConfig,
	predictedTeams?: PredictedMatchTeams
): PredictionPointResult | null {
	if (match.scoreA === null || match.scoreB === null) return null;

	const stageConfig = getStageConfig(config, match.stage);
	let exactHit = false;
	let outcomeHit = false;
	let bracketTeamHit = false;
	let advancedTeam: string | null = null;

	if (match.stage === 'groups') {
		const predictedOutcome = getMatchOutcome(prediction.predA, prediction.predB, match.stage, prediction.predPenaltyWinner);
		const actualOutcome = getMatchOutcome(match.scoreA, match.scoreB, match.stage, match.penaltyWinner);
		const exactScore = prediction.predA === match.scoreA && prediction.predB === match.scoreB;
		exactHit = exactScore;
		outcomeHit = !exactHit && predictedOutcome === actualOutcome;
	} else if (predictedTeams) {
		const { winner: actualWinner } = resolveWinner(match.teamA, match.teamB, match.scoreA, match.scoreB, match.penaltyWinner);
		const { winner: predictedWinner } = resolveWinner(
			predictedTeams.teamA,
			predictedTeams.teamB,
			prediction.predA,
			prediction.predB,
			prediction.predPenaltyWinner
		);
		const predictedScores = new Map([
			[getTeamId(predictedTeams.teamA), prediction.predA],
			[getTeamId(predictedTeams.teamB), prediction.predB]
		]);
		const exactTeams = hasExactKnockoutTeams(match, predictedTeams);
		const exactScore = predictedScores.get(getTeamId(match.teamA)) === match.scoreA && predictedScores.get(getTeamId(match.teamB)) === match.scoreB;
		const predictedPenaltyTeam = penaltyWinnerTeam(predictedTeams.teamA, predictedTeams.teamB, prediction.predPenaltyWinner);
		const actualPenaltyTeam = penaltyWinnerTeam(match.teamA, match.teamB, match.penaltyWinner);
		const exactPenaltyWinner = match.scoreA !== match.scoreB || sameTeam(predictedPenaltyTeam, actualPenaltyTeam);

		advancedTeam = actualWinner;
		bracketTeamHit = sameTeam(predictedWinner, actualWinner);
		exactHit = exactTeams && exactScore && exactPenaltyWinner;
		outcomeHit = !exactHit && exactTeams && bracketTeamHit;
	}

	const outcomePoints = exactHit || outcomeHit ? stageConfig.outcome : 0;
	const exactPoints = exactHit ? stageConfig.exact : 0;
	const bracketPoints = bracketTeamHit ? stageConfig.bracketTeam : 0;
	const reason = exactHit
		? 'Resultado exacto'
		: outcomeHit
			? 'Acierto de resultado'
			: bracketTeamHit
				? 'Equipo que avanza'
				: 'No acertó';

	return {
		matchId: match.id,
		stage: match.stage,
		teamA: match.teamA,
		teamB: match.teamB,
		scoreA: match.scoreA,
		scoreB: match.scoreB,
		predA: prediction.predA,
		predB: prediction.predB,
		outcomePoints,
		exactPoints,
		bracketPoints,
		totalPoints: outcomePoints + exactPoints + bracketPoints,
		reason: bracketPoints > 0 && (exactHit || outcomeHit)
			? `${reason} + equipo avanza: ${advancedTeam ?? 'equipo'} (${bracketPoints}pts)`
			: bracketPoints > 0
				? `${reason}: ${advancedTeam ?? 'equipo'} (${bracketPoints}pts)`
				: reason,
		exactHit,
		outcomeHit
	};
}

const SCORED_GROUP_POSITIONS = [0, 1, 2] as const; // 1°, 2°, 3°

/**
 * Puntaje por acertar la posición en la tabla final de cada grupo.
 * Compara los standings pronosticados (derivados de los pronósticos del usuario)
 * contra los reales (derivados de los resultados cargados). Solo puntúa grupos
 * completos (todos sus partidos con resultado) y las posiciones 1°, 2° y 3°.
 */
export function calculateGroupStagePoints(
	prediction: Prediction[],
	matches: Match[],
	config: ScoringConfig
): GroupStagePointResult {
	const pointsPerSlot = config.stages.groups.bracketTeam;
	const groupMatches = matches.filter((m) => m.stage === 'groups');
	if (pointsPerSlot <= 0 || groupMatches.length === 0) return { totalPoints: 0, details: [] };

	const userPreds: Record<string, LivePred> = {};
	for (const p of prediction) {
		userPreds[p.matchId] = { predA: p.predA, predB: p.predB, predPenaltyWinner: p.predPenaltyWinner };
	}
	const actualPreds: Record<string, LivePred> = {};
	for (const m of groupMatches) {
		if (m.scoreA !== null && m.scoreB !== null) {
			actualPreds[m.id] = { predA: m.scoreA, predB: m.scoreB, predPenaltyWinner: m.penaltyWinner };
		}
	}

	const predictedStandings = calcStandings(groupMatches, userPreds);
	const actualStandings = calcStandings(groupMatches, actualPreds);

	const matchesByGroup = new Map<string, Match[]>();
	for (const m of groupMatches) {
		const g = m.groupCode ?? '?';
		const list = matchesByGroup.get(g) ?? [];
		list.push(m);
		matchesByGroup.set(g, list);
	}

	const details: GroupPositionPointDetail[] = [];
	let totalPoints = 0;

	for (const [g, gMatches] of matchesByGroup) {
		const complete = gMatches.length > 0 && gMatches.every((m) => actualPreds[m.id] !== undefined);
		if (!complete) continue;
		const predicted = predictedStandings[g] ?? [];
		const actual = actualStandings[g] ?? [];
		for (const idx of SCORED_GROUP_POSITIONS) {
			const predTeam = predicted[idx]?.team;
			const actTeam = actual[idx]?.team;
			if (!predTeam || !actTeam) continue;
			const hit = getTeamId(predTeam) === getTeamId(actTeam);
			const points = hit ? pointsPerSlot : 0;
			totalPoints += points;
			details.push({ groupCode: g, position: idx + 1, predictedTeam: predTeam, actualTeam: actTeam, hit, points });
		}
	}

	return { totalPoints, details };
}