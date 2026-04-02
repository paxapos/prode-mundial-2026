-- Migration: Add Google OAuth support to users table
-- Makes password_hash nullable (OAuth users don't have passwords)
-- Adds google_id column with unique index

ALTER TABLE users ADD COLUMN google_id TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id) WHERE google_id IS NOT NULL;
