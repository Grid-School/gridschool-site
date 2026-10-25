-- Gifts (server/gifts.py, gifts_api.py): someone pays for a plan for someone else,
-- usually a parent for their son or daughter. Nothing is made for the person
-- receiving it until they accept it themselves from the link in their email; on
-- accepting they also choose whether the giver gets a weekly progress note.
-- Links are stored only as hashes. Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS gifts (
  id BIGSERIAL PRIMARY KEY,
  claim_hash TEXT NOT NULL UNIQUE,
  stop_hash TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'complete',
  amount INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  buyer_email TEXT NOT NULL,
  buyer_name TEXT NOT NULL DEFAULT '',
  giver TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  share BOOLEAN NOT NULL DEFAULT false,
  slug TEXT NOT NULL DEFAULT '',
  event_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  last_update_at TIMESTAMPTZ
);

-- How the giver signs it ("Mom"), when they filled the optional From field at checkout.
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS giver TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS gifts_buyer ON gifts (lower(buyer_email));
CREATE INDEX IF NOT EXISTS gifts_email ON gifts (lower(email));
