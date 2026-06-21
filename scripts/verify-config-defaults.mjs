import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
	const { defaultScoringConfig, normalizeScoringConfig } = await server.ssrLoadModule('/src/lib/scoring-config.ts');
	const cfg = defaultScoringConfig();
	assert.equal(cfg.stages.groups.exact, 1, 'exacto grupos debe ser 1 (bonus)');
	assert.equal(cfg.stages.groups.bracketTeam, 2, 'grupos bracketTeam default debe ser 2');
	assert.equal(cfg.stages.round32.exact, 1, 'exacto round32 debe ser 1');

	const norm = normalizeScoringConfig({ stages: { groups: { outcome: 1, exact: 1, bracketTeam: 5 } } });
	assert.equal(norm.stages.groups.bracketTeam, 5, 'normalize debe respetar groups.bracketTeam configurado');
	console.log('OK verify-config-defaults');
} finally {
	await server.close();
}
