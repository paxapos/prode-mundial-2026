export type UserRole = 'player' | 'admin';

export type TournamentState = 'draft' | 'open_predictions' | 'locked' | 'finished';

export type MatchStage = 'groups' | 'round32' | 'round16' | 'quarterfinal' | 'semifinal' | 'thirdplace' | 'final';

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
	/** Knockout bonus for predicting the team that advances */
	bracketTeam: number;
}

export interface ScoringConfig {
	stages: Record<MatchStage, StageScoringConfig>;
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

export interface PredictionEditUnlock {
	id: string;
	userId: string;
	tournamentId: string;
	enabled: boolean;
	reason: string | null;
	createdBy: string | null;
	createdAt: string;
	updatedBy: string | null;
	updatedAt: string;
}

export interface PredictionLock {
	id: string;
	userId: string;
	tournamentId: string;
	enabled: boolean;
	reason: string | null;
	createdBy: string | null;
	createdAt: string;
	updatedBy: string | null;
	updatedAt: string;
}


export interface PredictionChangeAudit {
	id: string;
	userId: string;
	tournamentId: string;
	matchId: string;
	matchLabel: string;
	action: 'prediction_created' | 'prediction_updated';
	previous: { predA: number; predB: number; predPenaltyWinner: SideWinner } | null;
	next: { predA: number; predB: number; predPenaltyWinner: SideWinner };
	changedByUserId: string | null;
	usedIndividualUnlock: boolean;
	createdAt: string;
}

export interface UserPredictionChangeSummary {
	userId: string;
	count: number;
	lastChangedAt: string | null;
	lastChange: PredictionChangeAudit | null;
}

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
	/** Manual tiebreaker points set by admin for fair play and FIFA ranking */
	tiebreakerPoints: number;
}

export interface LeaderboardEntry {
	userId: string;
	nickname: string;
	role: UserRole;
	avatarUrl: string | null;
	totalPoints: number;
	exactHits: number;
	outcomeHits: number;
	bracketPoints: number;
}

export interface BlogPost {
	id: string;
	slug: string;
	title: string;
	excerpt: string;
	body: string;
	imageUrl: string | null;
	authorId: string;
	authorNickname: string;
	published: boolean;
	createdAt: string;
	updatedAt: string;
}

/** Un casillero de 16avos evaluado para puntaje de clasificación */
export interface GroupPositionPointDetail {
	/** id del partido de 16avos (ej. 'r32-07') */
	matchId: string;
	/** lado del casillero */
	side: 'A' | 'B';
	/** etiqueta legible del casillero (ej. '1° Grupo A', '2° Grupo B', '3° Grupo C/E/F/H/I') */
	slotLabel: string;
	predictedTeam: string;
	actualTeam: string;
	hit: boolean;
	points: number;
}

/** Resultado del puntaje por clasificación a 16avos (casilleros) de un usuario */
export interface GroupStagePointResult {
	totalPoints: number;
	details: GroupPositionPointDetail[];
}
