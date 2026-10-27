-- Where you're going (server/path_engine.py, path_api.py): one record per seat with the student's answers
-- about now and later, the honest assessment the model wrote from them, and the titles they chose to
-- make resumes for. Versioned like the resume graph so two tabs never overwrite each other. Re-runnable.

CREATE TABLE IF NOT EXISTS career_paths (
  slug        text PRIMARY KEY REFERENCES students(slug) ON DELETE CASCADE,
  doc         jsonb NOT NULL DEFAULT '{}'::jsonb,
  version     integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
