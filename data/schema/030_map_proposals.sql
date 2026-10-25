-- Suggested map changes (server/map_proposals.py, data/map-proposal.mjs). A student proposes changes to their own
-- map; Aden keeps some, edits and publishes, or declines. Like a git branch over student_maps (which never edits a
-- version): base_version is the published version the student was looking at, ops is the change set, and a merge
-- names the new version it became. The live map is never touched by a suggestion; only a publish changes it.
-- One open suggestion per student: sending again supersedes the open one. Rows are never deleted, so the history of
-- who asked for what, and what came of it, stays. Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS map_proposals (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  base_version INTEGER,
  ops JSONB NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'merged', 'declined', 'withdrawn', 'superseded')),
  reply TEXT NOT NULL DEFAULT '',
  kept JSONB,
  merged_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS map_proposals_slug ON map_proposals (slug, id DESC);
