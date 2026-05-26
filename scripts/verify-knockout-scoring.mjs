import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
	appType: 'custom',
	logLevel: 'error',
	server: { middlewareMode: true }
});

try {
	const [{ calculatePredictionPoints }, { defaultScoringConfig }] = await Promise.all([
		server.ssrLoadModule('/src/lib/scoring-engine.ts'),
		server.ssrLoadModule('/src/lib/scoring-config.ts')
	]);

	const match = {
		id: 'm73',
		tournamentId: 'mundial-2026',
		stage: 'round32',
		groupCode: null,
		teamA: 'Corea del Sur',
		teamB: 'Catar',
		kickoffAt: '2026-06-28T00:00:00.000Z',
		venue: null,
		scoreA: 1,
		scoreB: 0,
		penaltyWinner: null,
		isClosed: true
	};

	const basePrediction = {
		id: 'p1',
		userId: 'u1',
		tournamentId: 'mundial-2026',
		matchId: match.id,
		predA: 1,
		predB: 0,
		predPenaltyWinner: null,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z'
	};
	const scoringConfig = defaultScoringConfig();

	const wrongOpponent = calculatePredictionPoints(basePrediction, match, scoringConfig, {
		teamA: 'Corea del Sur',
		teamB: 'Marruecos'
	});
	assert.equal(wrongOpponent?.outcomePoints, 0, 'No debe sumar resultado si falta el rival real');
	assert.equal(wrongOpponent?.exactPoints, 0, 'No debe sumar exacto si falta el rival real');
	assert.equal(wrongOpponent?.bracketPoints, 2, 'Debe sumar equipo que avanza si Corea del Sur era el ganador pronosticado');

	const localWinnerOnly = calculatePredictionPoints(basePrediction, match, scoringConfig, {
		teamA: 'Ecuador',
		teamB: 'Turquía'
	});
	assert.equal(localWinnerOnly?.totalPoints, 0, 'No debe sumar por acertar que gano el local si el equipo ganador era otro');

	const reversedTeamsExact = calculatePredictionPoints({ ...basePrediction, predA: 0, predB: 1 }, match, scoringConfig, {
		teamA: 'Catar',
		teamB: 'Corea del Sur'
	});
	assert.equal(reversedTeamsExact?.outcomePoints, 1, 'Debe sumar resultado por identidad de equipo, no por posicion A/B');
	assert.equal(reversedTeamsExact?.exactPoints, 2, 'Debe sumar exacto aunque los equipos esten invertidos si el marcador por equipo coincide');
	assert.equal(reversedTeamsExact?.bracketPoints, 2, 'Debe sumar equipo que avanza por ID');

	console.log('OK: scoring de llaves exige identidad de equipos para resultado/exacto y no premia local/visitante sin equipo.');
} finally {
	await server.close();
}