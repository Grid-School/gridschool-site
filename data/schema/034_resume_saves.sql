-- Saved resumes (server/resume_api.py): every version a student names and keeps, frozen as it printed,
-- with when it was made. Downloads (resume_exports) point at the version they came from, so a resume
-- can be downloaded again exactly as it was, and the console can see which version went out.

CREATE TABLE IF NOT EXISTS resume_saves (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model JSONB NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resume_saves_by_slug ON resume_saves (slug, created_at DESC);

ALTER TABLE resume_exports ADD COLUMN IF NOT EXISTS save_id BIGINT REFERENCES resume_saves (id) ON DELETE SET NULL;
