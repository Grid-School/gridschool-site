-- The daily run by email (server/daily_run.py, daily_run_api.py).
-- daily_run_emails: one row per seat per day, claimed before the email goes (INSERT ... ON CONFLICT DO
-- NOTHING), so a restart or a deploy never sends a second one that day. status is 'claimed' until the
-- mail server takes it, then 'sent'; a failed send deletes its claim. role_keys are the roles the email
-- named, so the same role is never sent twice. clicked_at is when the student first opened the app from
-- that email's link (from=daily-run), for the Monday readout.
-- daily_run_prefs: a student who stopped these emails (the link in every footer, or their profile in the
-- app). stopped_at NULL means they're on. how says where it changed: link, app or desk.
-- Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS daily_run_emails (
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  day DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent')),
  role_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  PRIMARY KEY (slug, day)
);

CREATE INDEX IF NOT EXISTS daily_run_emails_recent ON daily_run_emails (slug, created_at DESC);

CREATE TABLE IF NOT EXISTS daily_run_prefs (
  slug TEXT PRIMARY KEY REFERENCES students (slug) ON DELETE CASCADE,
  stopped_at TIMESTAMPTZ,
  how TEXT NOT NULL DEFAULT '' CHECK (how IN ('', 'link', 'app', 'desk')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
