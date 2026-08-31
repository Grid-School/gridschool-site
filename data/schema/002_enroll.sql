-- Leads + per-seat tokens. Apply on account 643600678330 only.
-- Spec: ops/student-data.md
-- Safe to re-run. 001 stays the student notebook.
-- DROP the export view first. CREATE OR REPLACE cannot insert email mid-list.

DROP VIEW IF EXISTS student_export;

ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS student_tokens (
  slug TEXT PRIMARY KEY REFERENCES students (slug) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'enrolled', 'declined', 'lost')),
  slug TEXT REFERENCES students (slug),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrolled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS leads_status_created
  ON leads (status, created_at DESC);

CREATE OR REPLACE VIEW student_export AS
SELECT
  s.slug,
  s.name,
  s.email,
  s.cohort,
  s.joined::text AS joined,
  s.public,
  s.clock,
  s.oneone,
  s.note,
  COALESCE(s.instructor_state->>'focus', '') AS focus,
  COALESCE(s.instructor_state->>'next', '') AS next,
  COALESCE(s.student_state->'evidence', '{}'::jsonb) AS evidence,
  COALESCE(s.student_state->'tasks', '{}'::jsonb) AS tasks,
  COALESCE(s.student_state->'layout', '{}'::jsonb) AS layout,
  COALESCE(s.student_state->'stepFlags', '{}'::jsonb) AS stepFlags,
  COALESCE(s.student_state->'chat', '{"turns":[]}'::jsonb) AS chat,
  COALESCE(s.student_state->'memory', '{"notes":[],"files":[]}'::jsonb) AS memory,
  COALESCE(s.student_state->'usage', '[]'::jsonb) AS usage,
  COALESCE(s.student_state->'readReviews', '[]'::jsonb) AS readReviews,
  COALESCE(s.student_state->'questions', '[]'::jsonb) AS questions,
  COALESCE(s.instructor_state->'reviews', '[]'::jsonb) AS reviews,
  COALESCE(s.instructor_state->'extraNodes', '[]'::jsonb) AS extraNodes,
  COALESCE(s.instructor_state->'nodeOverrides', '{}'::jsonb) AS nodeOverrides,
  COALESCE(s.instructor_state->'quotaLog', '[]'::jsonb) AS quotaLog,
  s.student_updated_at,
  s.instructor_updated_at
FROM students s;
