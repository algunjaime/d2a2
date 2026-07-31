CREATE TABLE IF NOT EXISTS d2a2_sessions (
  owner_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  dupla_name TEXT NOT NULL DEFAULT '',
  session_date DATE,
  payload JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (owner_id, session_id)
);

CREATE INDEX IF NOT EXISTS d2a2_sessions_owner_updated_idx
  ON d2a2_sessions (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS d2a2_sessions_owner_status_idx
  ON d2a2_sessions (owner_id, status);
