-- Which Meta ad click a visitor arrived with (server/meta_capi.py): the page kept
-- fb.1.<ms>.<fbclid> from ?fbclid= in the browser (no cookie) and sent it with
-- a counted step (POST /events). Read only to attach it to a conversion sent to
-- Meta's Conversions API. One row per visitor, the first click kept. Rows older
-- than 90 days are no use to Meta and are deleted by the six-hourly sweep.
-- Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS ad_clicks (
  visitor TEXT PRIMARY KEY,
  fbc TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
