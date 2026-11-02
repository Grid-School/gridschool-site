-- The briefing lead magnet (briefing/) and the parent handoff (parents/): server/briefing_api.py, rules in briefing.py.
-- One row per address that asked for the briefing; one row per handoff a parent sent to their graduate. Each address
-- gets the briefing link at most once a week; a graduate gets at most one handoff email a month, and never after
-- "stop".
CREATE TABLE IF NOT EXISTS briefing_leads (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  who TEXT NOT NULL DEFAULT 'other' CHECK (who IN ('grad', 'student', 'parent', 'other')),
  source TEXT NOT NULL DEFAULT '',
  visitor TEXT NOT NULL DEFAULT '',
  link_sent_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS briefing_leads_email ON briefing_leads ((lower(email)));

CREATE TABLE IF NOT EXISTS parent_handoffs (
  id BIGSERIAL PRIMARY KEY,
  parent_email TEXT NOT NULL,
  parent_name TEXT NOT NULL DEFAULT '',
  grad_email TEXT NOT NULL,
  grad_first TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parent_handoffs_grad ON parent_handoffs ((lower(grad_email)), created_at DESC);
