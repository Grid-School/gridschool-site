-- GridSchool Complete: the self-serve plan beside the Residency (build plan doc).
-- Additive only. Every existing seat reads as 'residency' and nothing it does
-- changes; Complete features check plan = 'complete'. Safe to re-run.

ALTER TABLE students ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'residency';

-- The free check (/check/): one row per saved result. The id is the unguessable
-- link the person gets by email; no IP or browser data is kept.
CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY CHECK (id ~ '^ck_[A-Za-z0-9_-]{16,40}$'),
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  skipped JSONB NOT NULL DEFAULT '[]'::jsonb,
  read JSONB NOT NULL DEFAULT '{}'::jsonb,
  followups JSONB NOT NULL DEFAULT '[]'::jsonb,
  top JSONB NOT NULL DEFAULT '[]'::jsonb,
  catalog_version INTEGER NOT NULL DEFAULT 1,
  lead_id TEXT REFERENCES leads (id) ON DELETE SET NULL,
  slug TEXT REFERENCES students (slug) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checks_email ON checks (lower(email), created_at DESC);

-- A Complete seat's intake answers, one row per question (data/intake/questions.json).
-- source says where the value came from; confidence starts as self-reported.
CREATE TABLE IF NOT EXISTS intake_answers (
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  value JSONB,
  source TEXT NOT NULL DEFAULT 'answer' CHECK (source IN ('answer', 'resume', 'check', 'human', 'skipped')),
  confidence TEXT NOT NULL DEFAULT 'self-reported' CHECK (confidence IN ('self-reported', 'probable', 'verified')),
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, question_id)
);

-- Chunks a Complete seat has finished: each one unlocks an area of their map.
CREATE TABLE IF NOT EXISTS intake_chunks (
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL,
  done_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, chunk_id)
);
