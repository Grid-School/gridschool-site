-- Monthly gifts (server/gifts_api.py): a giver can pay for Complete at $97 a
-- month instead of $997 once. The gift is tied to the giver's Stripe
-- subscription, so each later payment counts on the gift (payment N of 12) and a
-- cancelled subscription pauses the seat it paid for unless all 12 were paid.
-- A one-time gift keeps billing 'once' and is fully paid at checkout.
-- Additive; safe to re-run.

ALTER TABLE gifts ADD COLUMN IF NOT EXISTS billing TEXT NOT NULL DEFAULT 'once';
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS subscription TEXT NOT NULL DEFAULT '';
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS customer TEXT NOT NULL DEFAULT '';
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS payments INT NOT NULL DEFAULT 1;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS paid_cents INT NOT NULL DEFAULT 0;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS fully_paid_at TIMESTAMPTZ;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS gifts_subscription ON gifts (subscription) WHERE subscription <> '';
