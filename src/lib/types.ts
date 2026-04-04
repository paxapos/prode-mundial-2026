export type UserRole = 'player' | 'admin';

export type TournamentState = 'draft' | 'open_predictions' | 'locked' | 'finished';

export type MatchStage = 'groups' | 'round32' | 'round16' | 'quarterfinal' | 'semifinal' | 'final';

export type SideWinner = 'A' | 'B' | null;

export interface User {
	id: string;
	email: string;
	nickname: string;
	role: UserRole;
	avatarUrl: string | null;
	createdAt: string;
}

/** Per-stage scoring configuration for a tournament */
export interface StageScoringConfig {
	/** Points for correct outcome (win/draw/loss) */
	outcome: number;
	/** Bonus points for exact score (on top of outcome) */
	exact: number;
	/** Points for each correct team predicted in this bracket round */
	bracketTeam: number;
	/** Points for correct team on wrong side of bracket (usually floor(bracketTeam/2)) */
	bracketTeamWrongSide: number;
}

export interface ScoringConfig {
	stages: Record<MatchStage, StageScoringConfig>;
	/** Bonus for predicting the champion */
	bonusChampion: number;
	/** Bonus for predicting the runner-up */
	bonusRunnerUp: number;
	/** Bonus for predicting third place */
	bonusThird: number;
}

export interface Tournament {
	id: string;
	alias: string;
	name: string;
	headerImageUrl: string;
	state: TournamentState;
	startAt: string;
	lockReason: string | null;
	scoringConfig: ScoringConfig;
	parentTournamentId: string | null;
	createdAt: string;
}

export interface Match {
	id: string;
	tournamentId: string;
	stage: MatchStage;
	groupCode: string | null;
	teamA: string;
	teamB: string;
	kickoffAt: string;
	venue: string | null;
	scoreA: number | null;
	scoreB: number | null;
	penaltyWinner: SideWinner;
	isClosed: boolean;
}

export interface Prediction {
	id: string;
	userId: string;
	tournamentId: string;
	matchId: string;
	predA: number;
	predB: number;
	predPenaltyWinner: SideWinner;
	createdAt: string;
	updatedAt: string;
}

export interface ScoringRules extends ScoringConfig {}

/** Detail of how many points a single match awarded */
export interface MatchPointDetail {
	matchId: string;
	stage: MatchStage;
	teamA: string;
	teamB: string;
	scoreA: number;
	scoreB: number;
	predA: number;
	predB: number;
	outcomePoints: number;
	exactPoints: number;
	bracketPoints: number;
	totalPoints: number;
	reason: string;
}

export interface TournamentSettings {
	state: TournamentState;
	tournamentStartAt: string;
	lockReason: string | null;
}

export interface GroupStandingRow {
	team: string;
	played: number;
	wins: number;
	draws: number;
	losses: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDiff: number;
	points: number;
}

export interface LeaderboardEntry {
	userId: string;
	nickname: string;
	role: UserRole;
	totalPoints: number;
	exactHits: number;
	outcomeHits: number;
	bracketPoints: number;
}
