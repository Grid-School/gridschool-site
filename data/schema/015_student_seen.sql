-- When a student last opened their own board (a read with their own token).
-- Admin reads never count. Throttled to one write per 5 minutes per student,
-- so the board's 15-second poll does not churn the row.
-- Written by server/persist_db.py mark_seen; shown on the desk as "last seen".

CREATE TABLE IF NOT EXISTS student_seen (
  slug TEXT PRIMARY KEY REFERENCES students (slug) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
