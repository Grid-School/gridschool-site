-- Prepared roles (server/role_pack.py), one per student per role. Written when
-- a student presses Prepare and by the overnight prefetch, so the morning run
-- opens with its top roles already read against their record. The board and
-- the desk read them; nothing else depends on them.

CREATE TABLE IF NOT EXISTS role_packs (
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  role JSONB NOT NULL DEFAULT '{}'::jsonb,
  pack JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'student' CHECK (source IN ('student', 'admin', 'overnight')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, role_key)
);

CREATE INDEX IF NOT EXISTS role_packs_recent ON role_packs (slug, created_at DESC);
