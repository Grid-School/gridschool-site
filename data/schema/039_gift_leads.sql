-- Parent leads (server/gift_leads.py, gift_leads_api.py): "Email me this" on
-- gift/. One row per email: the gift link goes at once, then at most two
-- follow-ups in the first week (followups counts them), none after a purchase
-- (bought_at) or an unsubscribe. A phone is kept only with text consent, with
-- the wording version and time it was given. Deleted on the lead schedule in
-- the privacy page. Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS gift_leads (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  sms_ok BOOLEAN NOT NULL DEFAULT false,
  sms_version TEXT NOT NULL DEFAULT '',
  sms_at TIMESTAMPTZ,
  visitor TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  ghl_contact TEXT NOT NULL DEFAULT '',
  unsub_hash TEXT NOT NULL DEFAULT '',
  followups INT NOT NULL DEFAULT 0,
  last_followup_at TIMESTAMPTZ,
  bought_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gift_leads_email ON gift_leads (lower(email));
