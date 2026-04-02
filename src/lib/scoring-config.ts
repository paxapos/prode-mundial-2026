import type { ScoringConfig, StageScoringConfig, MatchStage } from '$lib/types';

/**
 * Default scoring configuration adapted from the Qatar 2022 Paxapoga rules,
 * scaled for the 2026 World Cup format with a Round of 32.
 */
export function defaultScoringConfig(): ScoringConfig {
	return {
		stages: {
			groups:       { outcome: 1, exact: 1, bracketTeam: 0, bracketTeamWrongSide: 0 },
			round32:      { outcome: 1, exact: 1, bracketTeam: 2, bracketTeamWrongSide: 1 },
			round16:      { outcome: 1, exact: 1, bracketTeam: 3, bracketTeamWrongSide: 1 },
			quarterfinal: { outcome: 1, exact: 1, bracketTeam: 4, bracketTeamWrongSide: 2 },
			semifinal:    { outcome: 1, exact: 1, bracketTeam: 5, bracketTeamWrongSide: 2 },
			final:        { outcome: 1, exact: 1, bracketTeam: 6, bracketTeamWrongSide: 3 }
		},
		bonusChampion: 10,
		bonusRunnerUp: 6,
		bonusThird: 5
	};
}

/** Get config for a specific stage, falling back to groups defaults */
export function getStageConfig(config: ScoringConfig, stage: MatchStage): StageScoringConfig {
	return config.stages[stage] ?? config.stages.groups;
}

/** Serialize for DB storage */
export function serializeScoringConfig(config: ScoringConfig): string {
	return JSON.stringify(config);
}

/** Deserialize from DB */
export function parseScoringConfig(json: string): ScoringConfig {
	try {
		const parsed = JSON.parse(json) as ScoringConfig;
		// Ensure all stages exist (forward-compat if a stage was added later)
		const defaults = defaultScoringConfig();
		for (const stage of Object.keys(defaults.stages)) {
			if (!parsed.stages[stage as MatchStage]) {
				parsed.stages[stage as MatchStage] = defaults.stages[stage as MatchStage];
			}
		}
		return parsed;
	} catch {
		return defaultScoringConfig();
	}
}

/** Human-readable stage names */
export const STAGE_LABELS: Record<MatchStage, string> = {
	groups: 'Fase de Grupos',
	round32: '32avos de Final',
	round16: 'Octavos de Final',
	quarterfinal: 'Cuartos de Final',
	semifinal: 'Semifinales',
	final: 'Final / 3er Puesto'
};
