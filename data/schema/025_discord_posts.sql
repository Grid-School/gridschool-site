-- What the community jobs have posted to Discord, so nothing posts twice (server/community_jobs.py).
-- job: drop (one row per role key and per posting fingerprint), drop-day, hiring (week), sendday (date),
-- win (seat:app:stage, one share per outcome, only ever written when the student tapped Share).
-- Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS discord_posts (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  job TEXT NOT NULL,
  key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  UNIQUE (job, key)
);
