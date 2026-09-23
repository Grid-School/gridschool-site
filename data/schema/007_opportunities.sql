-- Vetted LinkedIn leaders, their fresh posts, and per-student delivery history.

CREATE TABLE IF NOT EXISTS opportunity_leaders (
  profile_url TEXT PRIMARY KEY,
  urn TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  headline TEXT NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL,
  followers INTEGER,
  company_name TEXT NOT NULL DEFAULT '',
  company_url TEXT NOT NULL DEFAULT '',
  employee_count INTEGER,
  language TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
  qualification_reason TEXT NOT NULL DEFAULT '',
  source JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_polled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_leaders_status_poll
  ON opportunity_leaders (status, last_polled_at);

CREATE TABLE IF NOT EXISTS opportunity_posts (
  post_id TEXT PRIMARY KEY,
  profile_url TEXT NOT NULL REFERENCES opportunity_leaders (profile_url) ON DELETE CASCADE,
  url TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_headline TEXT NOT NULL,
  text TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  comments INTEGER NOT NULL DEFAULT 0,
  reactions INTEGER NOT NULL DEFAULT 0,
  topic TEXT NOT NULL,
  gap TEXT NOT NULL,
  gap_label TEXT NOT NULL,
  reason TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_posts_fresh_score
  ON opportunity_posts (published_at DESC, score DESC);

CREATE TABLE IF NOT EXISTS opportunity_assignments (
  post_id TEXT NOT NULL REFERENCES opportunity_posts (post_id) ON DELETE CASCADE,
  student_slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'assigned'
    CHECK (state IN ('assigned', 'opened', 'commented', 'skipped')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (post_id, student_slug)
);

CREATE INDEX IF NOT EXISTS opportunity_assignments_student_recent
  ON opportunity_assignments (student_slug, assigned_at DESC);

CREATE INDEX IF NOT EXISTS opportunity_assignments_post
  ON opportunity_assignments (post_id);
