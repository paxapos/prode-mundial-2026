import {
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
	'users',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		username: text('username').notNull(),
		nickname: text('nickname').notNull(),
		passwordHash: text('password_hash'),
		googleId: text('google_id'),
		avatarUrl: text('avatar_url'),
		role: text('role', { enum: ['player', 'admin'] }).notNull().default('player'),
		createdAt: text('created_at').notNull()
	},
	(table) => ({
		usernameIdx: uniqueIndex('users_username_idx').on(table.username),
		nicknameIdx: uniqueIndex('users_nickname_idx').on(table.nickname),
		googleIdIdx: uniqueIndex('users_google_id_idx').on(table.googleId)
	})
);

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		tokenHash: text('token_hash').notNull(),
		userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: text('expires_at').notNull(),
		createdAt: text('created_at').notNull()
	},
	(table) => ({
		tokenHashIdx: uniqueIndex('sessions_token_hash_idx').on(table.tokenHash)
	})
);

export const matches = sqliteTable('matches', {
	id: text('id').primaryKey(),
	stage: text('stage', {
		enum: ['groups', 'round32', 'round16', 'quarterfinal', 'semifinal', 'final']
	}).notNull(),
	groupCode: text('group_code'),
	teamA: text('team_a').notNull(),
	teamB: text('team_b').notNull(),
	kickoffAt: text('kickoff_at').notNull(),
	scoreA: integer('score_a'),
	scoreB: integer('score_b'),
	penaltyWinner: text('penalty_winner', { enum: ['A', 'B'] }),
	isClosed: integer('is_closed', { mode: 'boolean' }).notNull().default(false)
});

export const tournaments = sqliteTable(
	'tournaments',
	{
		id: text('id').primaryKey(),
		alias: text('alias').notNull(),
		name: text('name').notNull(),
		headerImageUrl: text('header_image_url').notNull(),
		state: text('state', { enum: ['draft', 'open_predictions', 'locked', 'finished'] })
			.notNull()
			.default('open_predictions'),
		startAt: text('start_at').notNull(),
		lockReason: text('lock_reason'),
		scoringConfigJson: text('scoring_config_json').notNull(),
		parentTournamentId: text('parent_tournament_id'),
		createdAt: text('created_at').notNull()
	},
	(table) => ({
		aliasIdx: uniqueIndex('tournaments_alias_idx').on(table.alias)
	})
);

export const userTournaments = sqliteTable(
	'user_tournaments',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
		createdAt: text('created_at').notNull()
	},
	(table) => ({
		userTournamentIdx: uniqueIndex('user_tournaments_user_tournament_idx').on(table.userId, table.tournamentId)
	})
);

export const tournamentMatches = sqliteTable(
	'tournament_matches',
	{
		id: text('id').primaryKey(),
		tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
		stage: text('stage', {
			enum: ['groups', 'round32', 'round16', 'quarterfinal', 'semifinal', 'final']
		}).notNull(),
		groupCode: text('group_code'),
		teamA: text('team_a').notNull(),
		teamB: text('team_b').notNull(),
		kickoffAt: text('kickoff_at').notNull(),
		venue: text('venue'),
		scoreA: integer('score_a'),
		scoreB: integer('score_b'),
		penaltyWinner: text('penalty_winner', { enum: ['A', 'B'] }),
		isClosed: integer('is_closed', { mode: 'boolean' }).notNull().default(false)
	},
	(table) => ({
		tournamentKickoffIdx: uniqueIndex('tournament_matches_id_tournament_idx').on(table.id, table.tournamentId)
	})
);

export const tournamentPredictions = sqliteTable(
	'tournament_predictions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
		matchId: text('match_id').notNull().references(() => tournamentMatches.id, { onDelete: 'cascade' }),
		predA: integer('pred_a').notNull(),
		predB: integer('pred_b').notNull(),
		predPenaltyWinner: text('pred_penalty_winner', { enum: ['A', 'B'] }),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => ({
		uniquePredictionIdx: uniqueIndex('tournament_predictions_user_tournament_match_idx').on(
			table.userId,
			table.tournamentId,
			table.matchId
		)
	})
);

export const predictions = sqliteTable(
	'predictions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
		predA: integer('pred_a').notNull(),
		predB: integer('pred_b').notNull(),
		predPenaltyWinner: text('pred_penalty_winner', { enum: ['A', 'B'] }),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => ({
		uniquePredictionIdx: uniqueIndex('predictions_user_match_idx').on(table.userId, table.matchId)
	})
);

export const scoringRules = sqliteTable('scoring_rules', {
	id: integer('id').primaryKey(),
	version: integer('version').notNull(),
	pointsOutcome: integer('points_outcome').notNull(),
	pointsExact: integer('points_exact').notNull(),
	pointsBracket: integer('points_bracket').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const tournamentSettings = sqliteTable('tournament_settings', {
	id: integer('id').primaryKey(),
	state: text('state', { enum: ['draft', 'open_predictions', 'locked', 'finished'] }).notNull(),
	tournamentStartAt: text('tournament_start_at').notNull(),
	lockReason: text('lock_reason')
});

export const auditLogs = sqliteTable('audit_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
	action: text('action').notNull(),
	entityType: text('entity_type').notNull(),
	entityId: text('entity_id').notNull(),
	payloadJson: text('payload_json').notNull(),
	createdAt: text('created_at').notNull()
});
