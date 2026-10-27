-- How people use the app (server/activity.py): one row per click, change, submit, screen, error or session
-- end, for signed-in students and for visitors, so we can see what confused someone (the same button
-- pressed again and again, a click that did nothing, a warning they hit) and what happened before they left.
-- First-party only. Never what anyone types: the browser sends which control was used, never its value.
-- Kept 180 days (activity.purge). Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS activity (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL,                      -- when it happened, by the browser's clock (bounded by the server)
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  slug TEXT NOT NULL DEFAULT '',                -- the signed-in student, from the token (never from the body)
  visitor TEXT NOT NULL DEFAULT '',             -- the random id kept in the browser (check/events.js)
  session TEXT NOT NULL DEFAULT '',             -- one tab's visit
  kind TEXT NOT NULL,                           -- view | click | change | submit | toast | error | leave | account
  target TEXT NOT NULL DEFAULT '',              -- which control: data-track, an id, or its label
  route TEXT NOT NULL DEFAULT '',               -- the screen, e.g. map/b.resume
  props JSONB NOT NULL DEFAULT '{}'::jsonb      -- small facts: repeat count, dead click, ms on screen, tone
);

CREATE INDEX IF NOT EXISTS activity_slug_at ON activity (slug, at DESC);
CREATE INDEX IF NOT EXISTS activity_at ON activity (at DESC);
CREATE INDEX IF NOT EXISTS activity_session ON activity (session);
