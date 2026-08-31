-- GridSchool student lab notebook.
-- Apply ONLY on AWS account 643600678330 (GridSchool Management) after founding
-- tokens exist (slug + student secret + Aden admin secret).
-- Do not apply against RBS (992382665911).
-- Spec: ops/student-data.md

-- School-owned identity + two write domains + attention events.

CREATE TABLE IF NOT EXISTS students (
  slug TEXT PRIMARY KEY
    CHECK (slug ~ '^[a-z0-9-]{1,40}$'),
  name TEXT NOT NULL,
  cohort TEXT NOT NULL,
  joined DATE NOT NULL,
  public BOOLEAN NOT NULL DEFAULT false,
  clock JSONB NOT NULL DEFAULT '{}'::jsonb,
  oneone JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT NOT NULL DEFAULT '',

  -- Student board writes only these keys inside the document:
  -- evidence, tasks, layout, stepFlags, chat, memory, usage, readReviews, questions
  student_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  student_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Console writes only these keys:
  -- focus, next, reviews, extraNodes, nodeOverrides, quotaLog
  instructor_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  instructor_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attention + audit. Telegram (later) marks notified_at.
CREATE TABLE IF NOT EXISTS student_events (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS student_events_slug_created
  ON student_events (slug, created_at DESC);

CREATE INDEX IF NOT EXISTS student_events_attention_pending
  ON student_events (created_at)
  WHERE notified_at IS NULL
    AND kind IN (
      'evidence.submitted',
      'review.requested',
      'question.asked',
      'chat.needs_human'
    );

-- Reconstitute data/students/<slug>.json shape for export / backup.
CREATE OR REPLACE VIEW student_export AS
SELECT
  s.slug,
  s.name,
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
