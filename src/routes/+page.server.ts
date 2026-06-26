import type { PageServerLoad } from './$types';
import { buildLandingData, listLigas, listUserTournamentIds, getActiveTournament } from '$lib/server/state';
import { db } from '$lib/server/db/client';
import { tournamentPredictions } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const landing = await buildLandingData();
	const source = await getActiveTournament();

	// Load ligas for the user
	let userLigas: Awaited<ReturnType<typeof listLigas>> = [];
	if (locals.user && source) {
		const allLigas = await listLigas(source.id);
		const enrolledIds = await listUserTournamentIds(String(locals.user.id));
		userLigas = allLigas.filter((l) => enrolledIds.includes(l.id));
	}

	// Find live or next match IDs to limit prediction calculation
	const now = new Date();
	const liveOrNextMatches = (landing.matches || []).filter((m) => {
		const kickoffTime = new Date(m.kickoffAt);
		const isLive = kickoffTime <= now && !m.isClosed;
		const isNext = kickoffTime > now;
		return isLive || isNext;
	});
	// Sort by kickoff date to find the absolute next match
	liveOrNextMatches.sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

	const targetMatchIds: string[] = [];
	// Add all live matches
	const liveMatches = liveOrNextMatches.filter(m => new Date(m.kickoffAt) <= now);
	for (const m of liveMatches) {
		targetMatchIds.push(m.id);
	}
	// Add the next match(es) starting at the first future kickoff time
	const futureMatches = liveOrNextMatches.filter(m => new Date(m.kickoffAt) > now);
	if (futureMatches.length > 0) {
		const nextKickoff = futureMatches[0].kickoffAt;
		const sameTimeMatches = futureMatches.filter(m => m.kickoffAt === nextKickoff);
		for (const m of sameTimeMatches) {
			targetMatchIds.push(m.id);
		}
	}

	// Calculate prediction percentages for the next/live matches only
	let matchPredictionStats: Record<string, { winA: number; draw: number; winB: number; total: number }> = {};
	if (source && targetMatchIds.length > 0) {
		const predictionRows = await db
			.select({
				matchId: tournamentPredictions.matchId,
				predA: tournamentPredictions.predA,
				predB: tournamentPredictions.predB,
				predPenaltyWinner: tournamentPredictions.predPenaltyWinner
			})
			.from(tournamentPredictions)
			.where(
				and(
					eq(tournamentPredictions.tournamentId, source.id),
					inArray(tournamentPredictions.matchId, targetMatchIds)
				)
			);

		const statsMap: Record<string, { winA: number; draw: number; winB: number; total: number }> = {};
		for (const row of predictionRows) {
			if (row.predA === null || row.predB === null) continue;
			if (!statsMap[row.matchId]) {
				statsMap[row.matchId] = { winA: 0, draw: 0, winB: 0, total: 0 };
			}
			const mStats = statsMap[row.matchId];
			mStats.total++;
			if (row.predA > row.predB) {
				mStats.winA++;
			} else if (row.predB > row.predA) {
				mStats.winB++;
			} else {
				if (row.predPenaltyWinner === 'A') {
					mStats.winA++;
				} else if (row.predPenaltyWinner === 'B') {
					mStats.winB++;
				} else {
					mStats.draw++;
				}
			}
		}

		for (const matchId in statsMap) {
			const s = statsMap[matchId];
			if (s.total > 0) {
				matchPredictionStats[matchId] = {
					winA: Math.round((s.winA / s.total) * 100),
					draw: Math.round((s.draw / s.total) * 100),
					winB: Math.round((s.winB / s.total) * 100),
					total: s.total
				};
			}
		}
	}

	return {
		...landing,
		ligas: userLigas,
		user: locals.user,
		matchPredictionStats
	};
};

