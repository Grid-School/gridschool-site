-- The outcome loop (server/outcome_loop.py, outcome_loop_api.py).
-- testimonials: a student's own words about their result, kept only with their consent. A student writes
-- them on the "Tell us how it went" step, which appears on their map after a reply, an interview or an
-- offer. scope says where the words may appear: 'ads' (site and ads), 'site' (site only) or 'private'
-- (their coach only, never exported). consented_at is when they agreed (NULL for private); withdrawn_at
-- is when they took it back by unchecking the step, or replaced it with new words. Only the newest
-- row per seat with withdrawn_at NULL is live.
-- outcome_marks: what the loop already did for a seat (one 'hired' event, one alert per check-in, the
-- story step added once), so a repeated write never repeats an alert. Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS testimonials (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  attribution TEXT NOT NULL DEFAULT 'anonymous',
  shown_as TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'private' CHECK (scope IN ('ads', 'site', 'private')),
  consent_text TEXT NOT NULL DEFAULT '',
  consented_at TIMESTAMPTZ,
  outcome_stage TEXT NOT NULL DEFAULT '',
  outcome_company TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS testimonials_live ON testimonials (slug, created_at DESC) WHERE withdrawn_at IS NULL;

CREATE TABLE IF NOT EXISTS outcome_marks (
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  key TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, key)
);
