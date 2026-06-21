import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
	const { calculateGroupStagePoints } = await server.ssrLoadModule('/src/lib/scoring-engine.ts');
	const { normalizeScoringConfig } = await server.ssrLoadModule('/src/lib/scoring-config.ts');
	const config = normalizeScoringConfig({ stages: { groups: { outcome: 1, exact: 1, bracketTeam: 2 } } });

	const teams = ['Argentina', 'Brasil', 'Chile', 'Peru'];
	const pair = (a, b) => ({
		id: `A-${a}-${b}`, tournamentId: 't', stage: 'groups', groupCode: 'A',
		teamA: teams[a], teamB: teams[b], kickoffAt: '2026-06-10T00:00:00.000Z',
		venue: null, penaltyWinner: null, isClosed: true
	});
	// 6 partidos del grupo. Resultados REALES: orden final Argentina>Brasil>Chile>Peru
	const matches = [
		{ ...pair(0, 1), scoreA: 2, scoreB: 0 }, // ARG vence BRA
		{ ...pair(0, 2), scoreA: 2, scoreB: 0 }, // ARG vence CHI
		{ ...pair(0, 3), scoreA: 2, scoreB: 0 }, // ARG vence PER
		{ ...pair(1, 2), scoreA: 1, scoreB: 0 }, // BRA vence CHI
		{ ...pair(1, 3), scoreA: 1, scoreB: 0 }, // BRA vence PER
		{ ...pair(2, 3), scoreA: 1, scoreB: 0 } //  CHI vence PER
	];
	// real: ARG 9, BRA 6, CHI 3, PER 0 -> 1°ARG 2°BRA 3°CHI

	const mkPred = (m, a, b) => ({
		id: `p-${m.id}`, userId: 'u', tournamentId: 't', matchId: m.id,
		predA: a, predB: b, predPenaltyWinner: null,
		createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
	});
	// Pronóstico: acierta ARG 1° y BRA 2°, pero invierte CHI/PER (no acierta 3°)
	const predictions = [
		mkPred(matches[0], 2, 0), // ARG>BRA
		mkPred(matches[1], 2, 0), // ARG>CHI
		mkPred(matches[2], 2, 0), // ARG>PER
		mkPred(matches[3], 1, 0), // BRA>CHI
		mkPred(matches[4], 1, 0), // BRA>PER
		mkPred(matches[5], 0, 1) //  PER>CHI  (invierte el 3°)
	];

	const res = calculateGroupStagePoints(predictions, matches, config);
	// 1° y 2° acertados = 2 casilleros * 2pts = 4; 3° fallado = 0
	assert.equal(res.totalPoints, 4, `esperaba 4, dio ${res.totalPoints}`);
	const hits = res.details.filter((d) => d.hit).map((d) => d.position).sort();
	assert.deepEqual(hits, [1, 2], 'deben acertar posiciones 1 y 2');

	// Grupo incompleto no puntúa
	const incompleteMatches = matches.map((m, i) => (i === 0 ? { ...m, scoreA: null, scoreB: null } : m));
	const res2 = calculateGroupStagePoints(predictions, incompleteMatches, config);
	assert.equal(res2.totalPoints, 0, 'grupo incompleto no debe puntuar');

	console.log('OK verify-group-scoring');
} finally {
	await server.close();
}
