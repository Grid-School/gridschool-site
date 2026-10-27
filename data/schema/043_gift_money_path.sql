-- Gift money-path fixes (server/billing_api.py, gifts_api.py). Additive; safe to re-run.
--
-- A gift whose recipient address can't be read is kept (status 'needs_address') with its subscription
-- and customer, so its later payments and its end reach the gift desk instead of the buyer's own seat.
-- Aden fixes it by hand: UPDATE gifts SET email = '<theirs>', status = 'sent' WHERE id = <id>, and the
-- hourly sender invites them.
--
-- invite_attempts: how many times the invite email was tried. An invite that failed is retried hourly,
-- up to gifts.INVITE_TRIES, but only for gifts made after this file first ran (schema_once
-- '043_gift_invite_retry'), so no gift from before is ever re-invited with a new link.

ALTER TABLE gifts ADD COLUMN IF NOT EXISTS invite_attempts INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS schema_once (
  name TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_once (name) VALUES ('043_gift_invite_retry') ON CONFLICT DO NOTHING;

-- A gift buyer's processor customer is the gift's, never a Complete seat of their own: a cancelled or
-- refunded gift must not pause the buyer's seat (billing_api.Provisioner.ended, .refund).
UPDATE billing_customers SET plan = 'gift'
  WHERE plan = 'complete' AND slug = '' AND customer IN (SELECT customer FROM gifts WHERE customer <> '' AND plan = 'complete');

CREATE INDEX IF NOT EXISTS gifts_customer ON gifts (customer) WHERE customer <> '';
CREATE INDEX IF NOT EXISTS gifts_event ON gifts (event_id) WHERE event_id <> '';
