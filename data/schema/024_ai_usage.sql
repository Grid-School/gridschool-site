-- What each AI call actually cost, so prices and free limits come from real numbers (ai_usage.py).
-- One row per model call. ref is whose it was: a seat slug, or '' for an anonymous free check.

CREATE TABLE IF NOT EXISTS ai_usage (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 5) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ai_usage_at ON ai_usage (at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_ref ON ai_usage (ref, at DESC);
