import type { ScoringConfig, StageScoringConfig, MatchStage } from '$lib/types';

export const SCORING_STAGES = ['groups', 'round32', 'round16', 'quarterfinal', 'semifinal', 'final'] as const satisfies readonly MatchStage[];

const DEFAULT_STAGE_SCORING: Record<MatchStage, StageScoringConfig> = {
	groups: { outcome: 1, exact: 2, bracketTeam: 0 },
	round32: { outcome: 1, exact: 2, bracketTeam: 2 },
	round16: { outcome: 1, exact: 2, bracketTeam: 3 },
	quarterfinal: { outcome: 1, exact: 2, bracketTeam: 4 },
	semifinal: { outcome: 1, exact: 2, bracketTeam: 5 },
	final: { outcome: 1, exact: 2, bracketTeam: 6 }
};

function pointsOrDefault(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function normalizeScoringConfig(config: unknown): ScoringConfig {
	const input = config as { stages?: Partial<Record<MatchStage, Partial<StageScoringConfig>>> } | null;
	const stages = Object.fromEntries(
		SCORING_STAGES.map((stage) => {
			const defaults = DEFAULT_STAGE_SCORING[stage];
			const stageInput = input?.stages?.[stage] ?? {};
			return [
				stage,
				{
					outcome: pointsOrDefault(stageInput.outcome, defaults.outcome),
					exact: pointsOrDefault(stageInput.exact, defaults.exact),
					bracketTeam: stage === 'groups' ? 0 : pointsOrDefault(stageInput.bracketTeam, defaults.bracketTeam)
				}
			];
		})
	) as Record<MatchStage, StageScoringConfig>;

	return { stages };
}

/**
 * Default scoring configuration adapted from the Qatar 2022 Paxapoga rules,
 * scaled for the 2026 World Cup format with a Round of 32.
 */
export function defaultScoringConfig(): ScoringConfig {
	return normalizeScoringConfig({ stages: DEFAULT_STAGE_SCORING });
}

/** Get config for a specific stage, falling back to groups defaults */
export function getStageConfig(config: ScoringConfig, stage: MatchStage): StageScoringConfig {
	return config.stages[stage] ?? config.stages.groups;
}

/** Serialize for DB storage */
export function serializeScoringConfig(config: ScoringConfig): string {
	return JSON.stringify(normalizeScoringConfig(config));
}

/** Deserialize from DB */
export function parseScoringConfig(json: string): ScoringConfig {
	try {
		return normalizeScoringConfig(JSON.parse(json));
	} catch {
		return defaultScoringConfig();
	}
}

/** Human-readable stage names */
export const STAGE_LABELS: Record<MatchStage, string> = {
	groups: 'Fase de Grupos',
	round32: 'Ronda de 32',
	round16: 'Octavos de final',
	quarterfinal: 'Cuartos de final',
	semifinal: 'Semifinal',
	final: 'Final'
};
