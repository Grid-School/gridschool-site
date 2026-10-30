-- The Monday readout (server/readout.py, readout_api.py): the funnel on one screen, totals only.
-- Additive; safe to re-run.
--
-- readout_spend: ad spend, the only number the readout can't read from our own tables.
--   source 'meta': one row per ad per day from the Marketing API insights (read-only token), re-pulled daily
--     for the last 7 days because Meta keeps settling them. ad_id is Meta's id, ad_name the name in Ads Manager.
--   source 'manual': the week's total typed in the console (POST /admin/readout/spend), one row per week on its
--     Monday, ad_id ''. A typed week wins over Meta's rows for that week.
-- readout_sent: each week the Monday job looked at, once: sent (Telegram + email), quiet (the "no traffic for 4
--   weeks" note) or skipped (nothing worth a message). A week whose Monday-to-Tuesday window passed with the
--   server down gets no row and no message.
--   The primary key is what stops a second send for the same week.

CREATE TABLE IF NOT EXISTS readout_spend (
  source TEXT NOT NULL CHECK (source IN ('meta', 'manual')),
  day DATE NOT NULL,
  ad_id TEXT NOT NULL DEFAULT '',
  ad_name TEXT NOT NULL DEFAULT '',
  cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, day, ad_id)
);

CREATE TABLE IF NOT EXISTS readout_sent (
  week TEXT PRIMARY KEY CHECK (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  kind TEXT NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivered JSONB NOT NULL DEFAULT '{}'::jsonb,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
