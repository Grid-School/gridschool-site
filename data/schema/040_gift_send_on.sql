-- A gift sent on a chosen day (server/gifts_api.py): graduation day, a birthday.
-- A Payment Link's custom fields can't hold a date, so checkout/ saves a gift
-- intent first (POST /gift/intent) and passes its id as the checkout's
-- client_reference_id; the webhook reads the day from it. The invite then goes
-- out from the hourly parent loop on that day; invited_at says when it went
-- (now, for a gift sent at once). Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS gift_intents (
  id TEXT PRIMARY KEY,
  visitor TEXT NOT NULL DEFAULT '',
  send_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE gifts ADD COLUMN IF NOT EXISTS send_on DATE;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
-- Gifts made before this file were invited when they were bought.
UPDATE gifts SET invited_at = created_at WHERE invited_at IS NULL AND send_on IS NULL AND created_at < '2026-10-28';
