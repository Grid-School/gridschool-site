-- One row per reminder actually claimed for a student's 1:1 occurrence.
-- The claim is the dedupe: the per-minute job inserts before it sends, so a
-- restart or a second process can never email the same call twice.
-- Written by server/call_reminders.py.

CREATE TABLE IF NOT EXISTS call_reminders (
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL,
  channel TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, at, channel)
);
