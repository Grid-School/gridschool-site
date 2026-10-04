-- Video plans for the console Video view. One row per video; the document is
-- the plan Aden fills before and after filming. The formula it is planned
-- against lives in git (site/data/video/formula.json), not here. Seed plans in
-- site/data/video/plans/ are inserted once at boot and never overwrite edits.

CREATE TABLE IF NOT EXISTS video_plans (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{1,60}$'),
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
