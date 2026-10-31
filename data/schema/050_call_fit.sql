-- The filter before any call (server/fit.py, fit_api.py; ops/filter-and-funnels-2026-10-31.md §3).
-- One row per saved check that went on to the fit step: the answers in their words, the two taps, the suggested
-- score, the route shown, and Aden's confirmation. A parent who opened the grad's link is recorded on the same row.
CREATE TABLE IF NOT EXISTS call_fits (
  check_id TEXT PRIMARY KEY REFERENCES checks (id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  hours TEXT NOT NULL DEFAULT '',
  payer TEXT NOT NULL DEFAULT '',
  score JSONB NOT NULL DEFAULT '{}'::jsonb,
  route TEXT NOT NULL DEFAULT 'free' CHECK (route IN ('call', 'sprint', 'self', 'free')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'declined', 'booked')),
  note TEXT NOT NULL DEFAULT '',
  parent_seen_at TIMESTAMPTZ,
  parent_joining BOOLEAN NOT NULL DEFAULT false,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_fits_route ON call_fits (route, status, created_at DESC);
