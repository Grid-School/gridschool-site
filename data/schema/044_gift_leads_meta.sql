-- Parent leads and Meta (server/gift_leads_api.py, meta_capi.py, billing_api.py). Additive; safe to re-run.
--
-- gift_leads.link_sent_at: when the gift link last went to this lead, so asking again within a week sends
-- nothing more, and the hourly cap on lead emails can be counted.
-- gift_leads.sms_user_agent: the browser that ticked the text box, kept with its time and wording version
-- as the record of that consent (no IP address: the privacy page promises none).
-- gift_lead_links: each email's own unsubscribe link, random and stored only as a SHA-256 hash (not peppered
-- with ADMIN_TOKEN, so rotating it breaks no link). Links sent before this file keep working through
-- gift_leads.unsub_hash.

ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS link_sent_at TIMESTAMPTZ;
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS sms_user_agent TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS gift_lead_links (
  hash TEXT PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES gift_leads (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gift_leads_link_sent ON gift_leads (link_sent_at) WHERE link_sent_at IS NOT NULL;

-- The browser that brought an ad visitor (sent to Meta as client_user_agent with that visitor's
-- conversions), kept with the click and deleted with it after 90 days.
ALTER TABLE ad_clicks ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT '';

-- A Complete customer's visit (its random id), so a trial's first paid month can be reported to Meta
-- with the ad click that brought them (billing_api.Provisioner.progress).
ALTER TABLE billing_customers ADD COLUMN IF NOT EXISTS visitor TEXT NOT NULL DEFAULT '';
