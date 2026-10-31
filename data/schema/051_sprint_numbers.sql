-- The sprint's published numbers (server/sprint_api.py publish; site/sprint/numbers/). A snapshot Aden publishes from
-- the console at weeks 3 and 6: counts across every member, never a name, a message or a company.
CREATE TABLE IF NOT EXISTS sprint_numbers (
  id BIGSERIAL PRIMARY KEY,
  cohort TEXT NOT NULL,
  label TEXT NOT NULL,
  numbers JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sprint_numbers_cohort ON sprint_numbers (cohort, published_at DESC);
