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
	assert.equal(reversedTeamsExact?.exactPoints, 1, 'Debe sumar exacto (bonus 1) aunque los equipos esten invertidos si el marcador por equipo coincide');
	assert.equal(reversedTeamsExact?.bracketPoints, 2, 'Debe sumar equipo que avanza por ID');

	// Semifinal tests
	const sfMatch = {
		id: 'sf1',
		tournamentId: 'mundial-2026',
		stage: 'semifinal',
		groupCode: null,
		teamA: 'Argentina',
		teamB: 'Croacia',
		kickoffAt: '2026-07-10T00:00:00.000Z',
		venue: null,
		scoreA: 3,
		scoreB: 0,
		penaltyWinner: null,
		isClosed: true
	};
	const sfPrediction = {
		id: 'psf1',
		userId: 'u1',
		tournamentId: 'mundial-2026',
		matchId: sfMatch.id,
		predA: 3,
		predB: 0,
		predPenaltyWinner: null,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z'
	};

	// 1. Both winner and loser correct
	const sfBothCorrect = calculatePredictionPoints(sfPrediction, sfMatch, scoringConfig, {
		teamA: 'Argentina',
		teamB: 'Croacia'
	});
	assert.equal(sfBothCorrect?.bracketPoints, 10, 'Semifinal: Debe sumar 10 puntos (5 + 5) si acierta ganador y perdedor');

	// 2. Winner correct, loser incorrect
	const sfWinnerCorrect = calculatePredictionPoints(sfPrediction, sfMatch, scoringConfig, {
		teamA: 'Argentina',
		teamB: 'Francia'
	});
	assert.equal(sfWinnerCorrect?.bracketPoints, 5, 'Semifinal: Debe sumar 5 puntos si acierta solo ganador');

	// 3. Winner incorrect, loser correct (predicted loser is Croatia, actual loser is Croatia)
	// sfPrediction says predA (teamA: Francia) is 3, predB (teamB: Croacia) is 0. So France is winner, Croatia is loser.
	const sfLoserCorrect = calculatePredictionPoints(sfPrediction, sfMatch, scoringConfig, {
		teamA: 'Francia',
		teamB: 'Croacia'
	});
	assert.equal(sfLoserCorrect?.bracketPoints, 5, 'Semifinal: Debe sumar 5 puntos si acierta solo perdedor');

	// 4. Both incorrect
	const sfBothIncorrect = calculatePredictionPoints(sfPrediction, sfMatch, scoringConfig, {
		teamA: 'Francia',
		teamB: 'Brasil'
	});
	assert.equal(sfBothIncorrect?.bracketPoints, 0, 'Semifinal: Debe sumar 0 puntos si ambos son incorrectos');

	console.log('OK: scoring de llaves exige identidad de equipos para resultado/exacto y no premia local/visitante sin equipo.');
} finally {
	await server.close();
}