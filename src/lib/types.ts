export type UserRole = 'player' | 'admin';

export type TournamentState = 'draft' | 'open_predictions' | 'locked' | 'finished';

export type MatchStage = 'groups' | 'round32' | 'round16' | 'quarterfinal' | 'semifinal' | 'final';

export type SideWinner = 'A' | 'B' | null;

export interface User {
	id: string;
	email: string;
	nickname: string;
	role: UserRole;
	createdAt: string;
}

export interface Tournament {
	id: string;
	alias: string;
	name: string;
	headerImageUrl: string;
	state: TournamentState;
	startAt: string;
	lockReason: string | null;
	pointsOutcome: number;
	pointsExact: number;
	pointsBracket: number;
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

export interface ScoringRules {
	pointsOutcome: number;
	pointsExact: number;
	pointsBracket: number;
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
}
