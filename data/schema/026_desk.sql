-- Aden's own record of each person, prospect to alumni (server/desk.py): pipeline stage, what the sales call
-- taught us (so nobody is asked twice), actions, questions and the history of what was done.
-- Admin-only. Kept apart from students.instructor on purpose: a student can read their own instructor record,
-- and this holds money terms and private context.
-- kind 'lead' is keyed by leads.id; on enrollment the record moves to kind 'seat' keyed by the new slug.

CREATE TABLE IF NOT EXISTS desk_records (
  kind TEXT NOT NULL CHECK (kind IN ('seat', 'lead')),
  ref TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, ref)
);
