-- Migration: Add per-user prediction edit unlocks
-- Allows admins to grant a user permission to edit future matches while the source competition is locked.

CREATE TABLE IF NOT EXISTS prediction_edit_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tournament_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_by INTEGER,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, tournament_id)
);