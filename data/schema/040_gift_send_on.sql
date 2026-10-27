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
-- Gifts made before this file were invited when they were bought. Once only: this file runs on every
-- boot, and a later gift whose invite email failed must stay uninvited so the hourly sender retries it
-- (gifts_api.send_scheduled). schema_once remembers that the backfill ran.
CREATE TABLE IF NOT EXISTS schema_once (
  name TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
UPDATE gifts SET invited_at = created_at WHERE invited_at IS NULL AND send_on IS NULL AND created_at < '2026-10-28'
  AND NOT EXISTS (SELECT 1 FROM schema_once WHERE name = '040_gift_invited_backfill');
INSERT INTO schema_once (name) VALUES ('040_gift_invited_backfill') ON CONFLICT DO NOTHING;
