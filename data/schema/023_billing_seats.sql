-- Each Complete seat's payments (server/billing_api.py): how many have landed,
-- when the last one did (so an instalment email can say "since your last
-- payment"), and when the plan was fully paid. Only Complete seats get a row;
-- residency seats are never written here. Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS billing_seats (
  slug TEXT PRIMARY KEY REFERENCES students (slug) ON DELETE CASCADE,
  payments INT NOT NULL DEFAULT 0,
  paid_cents INT NOT NULL DEFAULT 0,
  last_paid_at TIMESTAMPTZ,
  fully_paid_at TIMESTAMPTZ
);

-- Whose payment each processor event was, for a person reading the table by hand.
ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
