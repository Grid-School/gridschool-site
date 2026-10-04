-- Per-student maps. Each student is planned against their own goals instead of
-- the universal curriculum. A map has curriculum.json's shape (families,
-- phases, nodes, weekly). Every save is a new version; nothing is edited in
-- place, so a published plan can always be traced back. The board reads the
-- latest published version; drafts are the console's working copies.
-- Validated in server/maps.py before it is written.

CREATE TABLE IF NOT EXISTS student_maps (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  map JSONB NOT NULL,
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE INDEX IF NOT EXISTS student_maps_latest ON student_maps (slug, status, version DESC);
