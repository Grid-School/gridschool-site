-- Checkout: each processor event acts once (server/billing.py). Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
