-- Migration: Add team_group_adjustments table for manual tiebreaker points
-- Used by admins to resolve group-stage ties (fair play, drawing lots, etc.)

CREATE TABLE IF NOT EXISTS team_group_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id TEXT NOT NULL,
  group_code TEXT NOT NULL,
  team TEXT NOT NULL,
  tiebreaker_points REAL NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  UNIQUE(tournament_id, group_code, team)
);
