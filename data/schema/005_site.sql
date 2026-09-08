-- One row of runtime site overrides: links and short node copy the admin can
-- edit without a deploy. The document is public to read (its contents render
-- on public pages anyway) and admin-only to write. ops/site-pull.mjs mirrors
-- it into site/data/site-overrides.json so the repo can see what is live.

CREATE TABLE IF NOT EXISTS site_overrides (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_overrides (id, doc) VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
