-- The event log: one row per step a person takes, from the first visit to a
-- hire, tagged with where they came from, so every growth avenue is measured
-- the same way (plan doc: "The engine that picks the winners").
-- First-party only: a random visitor id from the browser, no cookies, no IP
-- addresses, no third parties. Additive; safe to re-run. Spec: server/events.py.

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  visitor TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  check_id TEXT NOT NULL DEFAULT '',
  props JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS events_at ON events (at DESC);
CREATE INDEX IF NOT EXISTS events_name_at ON events (name, at DESC);
