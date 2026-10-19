-- Accounts for the free map and, later, the paid seat (GridSchool Complete plan).
-- Passwordless: an emailed 6-digit code or link, or Google sign-in.
-- Separate from student logins (003): nothing here changes how a residency
-- student signs in. Additive only; safe to re-run. Spec: server/accounts.py.

CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY CHECK (email = lower(email)),
  google_sub TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One pending sign-in per email: a code to type, and a link token to click.
-- Both hashed; the plain values only ever exist in the email.
CREATE TABLE IF NOT EXISTS account_codes (
  email TEXT PRIMARY KEY CHECK (email = lower(email)),
  code_hash TEXT NOT NULL,
  link_hash TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES accounts (email) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS account_sessions_email ON account_sessions (email);
