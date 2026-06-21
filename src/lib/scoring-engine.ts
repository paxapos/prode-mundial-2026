import { getMatchOutcome, resolveWinner, R32_DEFS } from '$lib/bracket-rules';
import { buildBracket, type LivePred } from '$lib/bracket-engine';
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

/** Etiqueta legible de un casillero de 16avos (1°/2° de grupo o mejor 3°). */
function r32SlotLabel(matchId: string, side: 'A' | 'B'): string {
	const def = R32_DEFS[matchId];
	if (!def) return side === 'A' ? 'Lado A' : 'Lado B';
	if (side === 'A') return `${def.aPos === 0 ? '1°' : '2°'} Grupo ${def.aGroup}`;
	return def.bLabel;
}

/**
 * Puntaje por acertar quién clasifica a 16avos, casillero por casillero.
 *
 * Modelo: cada partido de 16avos tiene 2 casilleros (lados A y B). En total 32 casilleros
 * (12 primeros de grupo + 12 segundos + 8 mejores terceros). Por cada casillero donde el
 * equipo pronosticado coincide con el equipo real que terminó ahí, se suma
 * `groups.bracketTeam`. El bracket real ya refleja desempates (`tiebreakerPoints`) y overrides
 * manuales del admin, porque viene de los partidos sincronizados.
 *
 * Solo se evalúa un casillero cuando está resuelto de ambos lados: el equipo real es un equipo
 * de verdad (no un placeholder tipo "2° Grupo A") y el pronóstico del usuario resolvió ese
 * casillero (`autoA/autoB` del bracket pronosticado).
 */
export function calculateGroupStagePoints(
	prediction: Prediction[],
	matches: Match[],
	config: ScoringConfig
): GroupStagePointResult {
	const pointsPerSlot = config.stages.groups.bracketTeam;
	const groupMatches = matches.filter((m) => m.stage === 'groups');
	const r32Matches = matches.filter((m) => m.stage === 'round32');
	if (pointsPerSlot <= 0 || r32Matches.length === 0 || groupMatches.length === 0) {
		return { totalPoints: 0, details: [] };
	}

	const realTeams = new Set<string>();
	for (const m of groupMatches) {
		realTeams.add(getTeamId(m.teamA));
		realTeams.add(getTeamId(m.teamB));
	}

	const userPreds: Record<string, LivePred> = {};
	for (const p of prediction) {
		userPreds[p.matchId] = { predA: p.predA, predB: p.predB, predPenaltyWinner: p.predPenaltyWinner };
	}
	const predictedBracket = buildBracket(matches, userPreds);

	const details: GroupPositionPointDetail[] = [];
	let totalPoints = 0;

	for (const match of r32Matches) {
		const predicted = predictedBracket[match.id];
		if (!predicted) continue;
		const sides = [
			{ side: 'A' as const, actual: match.teamA, predTeam: predicted.teamA, resolved: predicted.autoA },
			{ side: 'B' as const, actual: match.teamB, predTeam: predicted.teamB, resolved: predicted.autoB }
		];
		for (const slot of sides) {
			// Casillero resuelto de ambos lados (pronóstico y resultado real).
			if (!slot.resolved) continue;
			if (!realTeams.has(getTeamId(slot.actual)) || !realTeams.has(getTeamId(slot.predTeam))) continue;
			const hit = getTeamId(slot.predTeam) === getTeamId(slot.actual);
			const points = hit ? pointsPerSlot : 0;
			totalPoints += points;
			details.push({
				matchId: match.id,
				side: slot.side,
				slotLabel: r32SlotLabel(match.id, slot.side),
				predictedTeam: slot.predTeam,
				actualTeam: slot.actual,
				hit,
				points
			});
		}
	}

	return { totalPoints, details };
}