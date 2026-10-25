-- The resume engine (server/resume_graph.py, resume_api.py; plan in ops/resume-engine-plan.md).
-- A student's resume is stored as claims, not a document: every line a resume prints comes from a
-- claim the student confirmed, and every claim points back to the answers it came from.
--
-- resume_graphs   one claim graph per student; version guards two tabs from losing each other's edit
-- resume_turns    every question asked and the student's verbatim answer, append-only (claims cite these ids)
-- resume_exports  every resume produced, frozen, with where it was meant to go

CREATE TABLE IF NOT EXISTS resume_graphs (
  slug TEXT PRIMARY KEY REFERENCES students (slug) ON DELETE CASCADE,
  graph JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resume_turns (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  node TEXT NOT NULL,
  question JSONB NOT NULL,
  answer TEXT,
  skipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resume_turns_by_slug ON resume_turns (slug, id);
-- What each turn changed (added, merged, dropped as unstated), for the console's run trace.
ALTER TABLE resume_turns ADD COLUMN IF NOT EXISTS report JSONB;

CREATE TABLE IF NOT EXISTS resume_exports (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('docx', 'pdf', 'txt', 'json', 'paste')),
  target_url TEXT,
  ats TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resume_exports_by_slug ON resume_exports (slug, created_at DESC);
