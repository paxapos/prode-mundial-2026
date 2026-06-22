import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { userTournaments, tournamentPredictions, tournamentMatches } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getTournamentByAlias, buildPredictedBracket } from '$lib/server/state';
import { resolveWinner } from '$lib/bracket-rules';
import type { Prediction, Match } from '$lib/types';
import { canonicalTeamName } from '$lib/teams';

// Hardcoded historical data
const HISTORICAL_PROBABILITIES = [
	{ team: 'Brasil', prob: 25, reason: '5 veces campeón del mundo y siempre favorito histórico.' },
	{ team: 'Francia', prob: 20, reason: 'Actual subcampeón, con un equipo lleno de estrellas jóvenes y experiencia.' },
	{ team: 'Argentina', prob: 18, reason: 'Actual campeón defensor, con la mística y experiencia necesarias para repetir.' },
	{ team: 'España', prob: 12, reason: 'Juego de posesión dominante y generaciones nuevas de altísimo nivel.' },
	{ team: 'Inglaterra', prob: 10, reason: 'Plantilla más valiosa del mundo, siempre candidato firme aunque le cuesta definir.' },
	{ team: 'Alemania', prob: 8, reason: 'Tetracampeón. El gigante europeo siempre es peligroso en instancias finales.' }
];

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	// Fuerte cache por dia (86400 segundos) ya que los pronosticos ya están armados
	setHeaders({
		'cache-control': 'public, max-age=86400'
	});

	const tournament = await getTournamentByAlias(params.tournamentAlias);
	if (!tournament) throw error(404, 'Liga no encontrada.');

	const sourceId = tournament.parentTournamentId ?? tournament.id;

	// 1. Fetch users in this tournament
	const memberships = await db.select().from(userTournaments).where(eq(userTournaments.tournamentId, tournament.id));
	const memberUserIds = memberships.map((m) => m.userId);

	if (memberUserIds.length === 0) {
		return {
			tournament,
			champions: [],
			mexicoVsSudafrica: { mexico: 0, draw: 0, sudafrica: 0 },
			totalParticipants: 0,
			historicalProbs: HISTORICAL_PROBABILITIES,
			stats: {
				mostCommonScore: null,
				averageGoalsPerMatch: 0,
				matchWithMostGoals: null,
				averageCompletionPercentage: 0
			}
		};
	}

	// 2. Fetch matches & predictions
	const matchRows = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, sourceId));
	// Map matches to Match type
	const matches: Match[] = matchRows.map(row => ({
		id: row.id,
		tournamentId: row.tournamentId,
		stage: row.stage as Match['stage'],
		groupCode: row.groupCode,
		teamA: canonicalTeamName(row.teamA),
		teamB: canonicalTeamName(row.teamB),
		kickoffAt: row.kickoffAt,
		venue: row.venue ?? null,
		scoreA: row.scoreA,
		scoreB: row.scoreB,
		penaltyWinner: (row.penaltyWinner as any) ?? null,
		isClosed: row.isClosed
	}));

	const predictionRows = await db.select().from(tournamentPredictions).where(eq(tournamentPredictions.tournamentId, sourceId));
	
	const predictionsByUser = new Map<number, Prediction[]>();
	for (const row of predictionRows) {
		if (!memberUserIds.includes(row.userId)) continue;
		const pred: Prediction = {
			id: String(row.id),
			userId: String(row.userId),
			tournamentId: row.tournamentId,
			matchId: row.matchId,
			predA: row.predA,
			predB: row.predB,
			predPenaltyWinner: (row.predPenaltyWinner as any) ?? null,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		};
		const userPreds = predictionsByUser.get(row.userId) ?? [];
		userPreds.push(pred);
		predictionsByUser.set(row.userId, userPreds);
	}

	// 3. Process data
	const championCounts = new Map<string, number>();
	let mexicoWins = 0;
	let sudafricaWins = 0;
	let draws = 0;
	let g001Count = 0;

	// New stats maps/counters
	const scoreCounts = new Map<string, number>();
	let totalGoals = 0;
	let totalPredsCount = 0;
	const matchGoalSums = new Map<string, { sum: number; count: number }>();

	for (const userId of memberUserIds) {
		const userPreds = predictionsByUser.get(userId) ?? [];
		
		// Mexico vs Sudafrica (match g-001)
		const matchG001 = userPreds.find(p => p.matchId === 'g-001');
		if (matchG001) {
			g001Count++;
			if (matchG001.predA > matchG001.predB) mexicoWins++;
			else if (matchG001.predA < matchG001.predB) sudafricaWins++;
			else draws++;
		}

		// Champion prediction
		const bracket = buildPredictedBracket(matches, userPreds);
		const finalSlot = bracket['final'];
		if (finalSlot && !finalSlot.teamA.includes('Ganador') && !finalSlot.teamB.includes('Ganador')) {
			const finalPred = userPreds.find(p => p.matchId === 'final');
			if (finalPred) {
				const { winner } = resolveWinner(
					finalSlot.teamA, 
					finalSlot.teamB, 
					finalPred.predA, 
					finalPred.predB, 
					finalPred.predPenaltyWinner
				);
				if (winner) {
					championCounts.set(winner, (championCounts.get(winner) ?? 0) + 1);
				}
			}
		}

		// Calculate statistics for this user's predictions
		for (const pred of userPreds) {
			if (pred.predA !== null && pred.predB !== null) {
				const scoreKey = `${pred.predA}-${pred.predB}`;
				scoreCounts.set(scoreKey, (scoreCounts.get(scoreKey) ?? 0) + 1);

				const sum = pred.predA + pred.predB;
				totalGoals += sum;
				totalPredsCount++;

				const matchStats = matchGoalSums.get(pred.matchId) ?? { sum: 0, count: 0 };
				matchStats.sum += sum;
				matchStats.count++;
				matchGoalSums.set(pred.matchId, matchStats);
			}
		}
	}

	const totalParticipants = memberUserIds.length;
	const champions = Array.from(championCounts.entries())
		.map(([team, count]) => ({ team, count, percentage: Math.round((count / totalParticipants) * 100) }))
		.sort((a, b) => b.count - a.count);

	// Compute new stats
	let mostCommonScore: { score: string; percentage: number } | null = null;
	if (totalPredsCount > 0) {
		let bestScore = '';
		let bestCount = 0;
		for (const [score, count] of scoreCounts.entries()) {
			if (count > bestCount) {
				bestCount = count;
				bestScore = score;
			}
		}
		if (bestScore) {
			const [pA, pB] = bestScore.split('-');
			mostCommonScore = {
				score: `${pA} - ${pB}`,
				percentage: Math.round((bestCount / totalPredsCount) * 100)
			};
		}
	}

	const averageGoalsPerMatch = totalPredsCount > 0
		? parseFloat((totalGoals / totalPredsCount).toFixed(2))
		: 0;

	let matchWithMostGoals: { teamA: string; teamB: string; avgGoals: number } | null = null;
	if (matchGoalSums.size > 0) {
		let maxAvg = -1;
		let bestMatchId = '';
		for (const [matchId, stats] of matchGoalSums.entries()) {
			const avg = stats.sum / stats.count;
			if (avg > maxAvg) {
				maxAvg = avg;
				bestMatchId = matchId;
			}
		}

		const bestMatch = matches.find(m => m.id === bestMatchId);
		if (bestMatch && maxAvg >= 0) {
			matchWithMostGoals = {
				teamA: bestMatch.teamA,
				teamB: bestMatch.teamB,
				avgGoals: parseFloat(maxAvg.toFixed(2))
			};
		}
	}

	// Calculate average prediction completion rate per user
	const totalMatchesCount = matches.length;
	let totalUserCompletionSum = 0;
	for (const userId of memberUserIds) {
		const userPreds = predictionsByUser.get(userId) ?? [];
		const validCount = userPreds.filter(p => p.predA !== null && p.predB !== null).length;
		totalUserCompletionSum += totalMatchesCount > 0 ? (validCount / totalMatchesCount) : 0;
	}
	const averageCompletionPercentage = memberUserIds.length > 0
		? Math.round((totalUserCompletionSum / memberUserIds.length) * 100)
		: 0;

	return {
		tournament,
		totalParticipants,
		champions,
		mexicoVsSudafrica: {
			mexico: g001Count > 0 ? Math.round((mexicoWins / g001Count) * 100) : 0,
			sudafrica: g001Count > 0 ? Math.round((sudafricaWins / g001Count) * 100) : 0,
			draw: g001Count > 0 ? Math.round((draws / g001Count) * 100) : 0,
		},
		historicalProbs: HISTORICAL_PROBABILITIES,
		stats: {
			mostCommonScore,
			averageGoalsPerMatch,
			matchWithMostGoals,
			averageCompletionPercentage
		}
	};
};
