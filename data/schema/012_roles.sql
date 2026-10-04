-- Job radar: employer boards polled on public ATS feeds, and the roles seen on them.
-- No student data lives here. Engines read roles through the token-gated feed.

CREATE TABLE IF NOT EXISTS role_boards (
  board_key TEXT PRIMARY KEY,
  ats TEXT NOT NULL CHECK (ats IN ('greenhouse', 'lever', 'ashby')),
  token TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  watch BOOLEAN NOT NULL DEFAULT FALSE,
  last_polled_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  next_poll_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  open_roles INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_boards_due ON role_boards (watch DESC, next_poll_at);

CREATE TABLE IF NOT EXISTS roles (
  role_key TEXT PRIMARY KEY,
  board_key TEXT NOT NULL REFERENCES role_boards (board_key) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  apply_url TEXT NOT NULL DEFAULT '',
  locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  workplace TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  employment_type TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  description TEXT NOT NULL DEFAULT '',
  eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  baseline BOOLEAN NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS roles_feed_cursor ON roles (first_seen_at, role_key);
CREATE INDEX IF NOT EXISTS roles_board ON roles (board_key);
