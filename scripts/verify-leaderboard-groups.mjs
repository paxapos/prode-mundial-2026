import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
	const { calculateGroupStagePoints } = await server.ssrLoadModule('/src/lib/scoring-engine.ts');
	const { normalizeScoringConfig } = await server.ssrLoadModule('/src/lib/scoring-config.ts');
	const config = normalizeScoringConfig({ stages: { groups: { outcome: 1, exact: 1, bracketTeam: 2 } } });
	// sanity: sin partidos no suma
	const res = calculateGroupStagePoints([], [], config);
	assert.equal(res.totalPoints, 0);
	console.log('OK verify-leaderboard-groups');
} finally {
	await server.close();
}
