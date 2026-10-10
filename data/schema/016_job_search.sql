-- The job search. Two new keys ride inside the existing JSONB domains:
--   student_state.search     (their resume, text + link, and the log of every
--                             application and warm message, with how far it got)
--   instructor_state.career  (what Aden worked out with them: the story, headline,
--                             About, title cluster, weekly targets, his copy of the resume)
-- No table change. The export view gains both columns; a view cannot add
-- columns in place, so it is dropped and recreated. Spec: ops/student-data.md

DROP VIEW IF EXISTS student_export;
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
  COALESCE(s.instructor_state->>'reader', '') AS reader,
  COALESCE(s.student_state->'evidence', '{}'::jsonb) AS evidence,
  COALESCE(s.student_state->'tasks', '{}'::jsonb) AS tasks,
  COALESCE(s.student_state->'layout', '{}'::jsonb) AS layout,
  COALESCE(s.student_state->'stepFlags', '{}'::jsonb) AS stepFlags,
  COALESCE(s.student_state->'chat', '{"turns":[]}'::jsonb) AS chat,
  COALESCE(s.student_state->'memory', '{"notes":[],"files":[]}'::jsonb) AS memory,
  COALESCE(s.student_state->'usage', '[]'::jsonb) AS usage,
  COALESCE(s.student_state->'readReviews', '[]'::jsonb) AS readReviews,
  COALESCE(s.student_state->'questions', '[]'::jsonb) AS questions,
  COALESCE(s.student_state->'chosen', '[]'::jsonb) AS chosen,
  COALESCE(s.instructor_state->'reviews', '[]'::jsonb) AS reviews,
  COALESCE(s.instructor_state->'extraNodes', '[]'::jsonb) AS extraNodes,
  COALESCE(s.instructor_state->'nodeOverrides', '{}'::jsonb) AS nodeOverrides,
  COALESCE(s.instructor_state->'quotaLog', '[]'::jsonb) AS quotaLog,
  COALESCE(s.student_state->'search', '{}'::jsonb) AS search,
  COALESCE(s.instructor_state->'career', '{}'::jsonb) AS career,
  s.student_updated_at,
  s.instructor_updated_at
FROM students s;
