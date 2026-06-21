import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
	const { calculateGroupStagePoints } = await server.ssrLoadModule('/src/lib/scoring-engine.ts');
	const { normalizeScoringConfig } = await server.ssrLoadModule('/src/lib/scoring-config.ts');
	const config = normalizeScoringConfig({ stages: { groups: { outcome: 1, exact: 1, bracketTeam: 2 } } });

	// Dos grupos completos. Orden real: A) Argentina>Brasil>Chile>Peru  B) Francia>Alemania>Italia>Espana
	const groupTeams = { A: ['Argentina', 'Brasil', 'Chile', 'Peru'], B: ['Francia', 'Alemania', 'Italia', 'Espana'] };
	const groupMatches = [];
	for (const [g, teams] of Object.entries(groupTeams)) {
		// round-robin: el de índice menor le gana al de índice mayor -> orden = teams[0]>teams[1]>teams[2]>teams[3]
		for (let i = 0; i < teams.length; i++) {
			for (let j = i + 1; j < teams.length; j++) {
				groupMatches.push({
					id: `${g}-${i}-${j}`, tournamentId: 't', stage: 'groups', groupCode: g,
					teamA: teams[i], teamB: teams[j], kickoffAt: '2026-06-10T00:00:00.000Z',
					venue: null, scoreA: 1, scoreB: 0, penaltyWinner: null, isClosed: true
				});
			}
		}
	}
	// Casillero r32-01 = 2° Grupo A vs 2° Grupo B. Equipos REALES (sincronizados): Brasil y Alemania.
	const r3201 = {
		id: 'r32-01', tournamentId: 't', stage: 'round32', groupCode: null,
		teamA: 'Brasil', teamB: 'Alemania', kickoffAt: '2026-06-30T00:00:00.000Z',
		venue: null, scoreA: null, scoreB: null, penaltyWinner: null, isClosed: false
	};
	const matches = [...groupMatches, r3201];

	const mkPred = (m, a, b) => ({
		id: `p-${m.id}`, userId: 'u', tournamentId: 't', matchId: m.id,
		predA: a, predB: b, predPenaltyWinner: null,
		createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
	});

	// Participante 1: pronostica el MISMO orden -> su bracket pone Brasil (2°A) y Alemania (2°B) en r32-01.
	const predsSame = groupMatches.map((m) => mkPred(m, 1, 0));
	const res1 = calculateGroupStagePoints(predsSame, matches, config);
	assert.equal(res1.totalPoints, 4, `acertar los 2 casilleros del partido = 4, dio ${res1.totalPoints}`);
	assert.equal(res1.details.filter((d) => d.hit).length, 2, 'deben acertar los 2 lados de r32-01');

	// Participante 2: invierte Italia/Alemania en grupo B -> 2°B pasa a ser Italia -> falla el lado B.
	const predsFlipB = groupMatches.map((m) => {
		// partido Alemania(idx1) vs Italia(idx2) del grupo B: hacer ganar a Italia
		if (m.groupCode === 'B' && m.teamA === 'Alemania' && m.teamB === 'Italia') return mkPred(m, 0, 1);
		return mkPred(m, 1, 0);
	});
	const res2 = calculateGroupStagePoints(predsFlipB, matches, config);
	assert.equal(res2.totalPoints, 2, `acertar 1 de 2 casilleros = 2, dio ${res2.totalPoints}`);

	// Casillero sin resolver (equipos reales aún placeholders) no puntúa.
	const matchesUnresolved = [...groupMatches, { ...r3201, teamA: '2° Grupo A', teamB: '2° Grupo B' }];
	const res3 = calculateGroupStagePoints(predsSame, matchesUnresolved, config);
	assert.equal(res3.totalPoints, 0, 'casillero con equipos reales sin resolver no debe puntuar');

	console.log('OK verify-group-scoring');
} finally {
	await server.close();
}
