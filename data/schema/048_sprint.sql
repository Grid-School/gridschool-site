-- The free proof sprint (server/sprint.py, sprint_api.py, ops/sprint-intake-plan.md). Additive; safe to re-run.
--
-- students.paid gains 'comped': a sprint seat has every Complete feature (plan 'complete', so the prep runner,
-- the daily run and the videos all apply) but nobody paid for it. Revenue counts read billing_seats, which a
-- comped seat never has, so it is never a paying customer in the readout. 003_auth.sql re-adds this constraint
-- on every boot, so it lists 'comped' too; this repeats it so the order of the files never matters.
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_paid_check;
ALTER TABLE students ADD CONSTRAINT students_paid_check
  CHECK (paid IN ('deposit', 'paid', 'paused', 'comped'));

-- sprint_seats: one row per person per sprint, from their application to the end. status:
--   applied   eligible after the sprint step, the agreement not signed yet
--   member    in the sprint now (wave, starts, ends); granted_at when the seat was set up
--   waitlist  eligible but the cap is reached (auto), or held for the coach to decide (auto false: experienced)
--   declined  not eligible (code, reason), or declined by the coach; they keep the free map
--   released  quiet for 7 days, or released by the coach; the seat went back to free, progress kept
--   ended     the sprint ended for them (sprint_api.end_sprint)
-- upgraded: the sprint turned a free seat into a comped Complete one, so the end (or a release) turns it back.
-- A seat that was already Complete or Residency (the current students) is never changed by the sprint.
-- facts are what the decision read (from the check, the seat's answers and the sprint step); answers are the
-- sprint step itself (titles, clinic, who would pay). review is what they wrote on the map's last step.
CREATE TABLE IF NOT EXISTS sprint_seats (
  cohort TEXT NOT NULL,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('applied', 'member', 'waitlist', 'declined', 'released', 'ended')),
  code TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  auto BOOLEAN NOT NULL DEFAULT true,
  wave TEXT,
  starts DATE,
  ends DATE,
  check_id TEXT,
  source TEXT NOT NULL DEFAULT '',
  facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  titles JSONB NOT NULL DEFAULT '[]'::jsonb,
  clinic TEXT NOT NULL DEFAULT '',
  upgraded BOOLEAN NOT NULL DEFAULT false,
  decided_by TEXT NOT NULL DEFAULT 'auto',
  review JSONB,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  waitlisted_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort, slug)
);

CREATE INDEX IF NOT EXISTS sprint_seats_status ON sprint_seats (cohort, status, waitlisted_at);

-- sprint_commitments: each time someone agrees. The full name they typed, when, from where, the exact text and
-- its version, and the options they chose (quote consent, clinic, who would pay). Never updated, only added to.
CREATE TABLE IF NOT EXISTS sprint_commitments (
  id BIGSERIAL PRIMARY KEY,
  cohort TEXT NOT NULL,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL,
  text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS sprint_commitments_seat ON sprint_commitments (cohort, slug, signed_at DESC);

-- sprint_emails: one row per email per member, claimed before it goes (INSERT ... ON CONFLICT DO NOTHING), so a
-- restart or a deploy never sends one twice. key is the email's own id: welcome, activate-3, monday-2026-11-09,
-- warn:2026-11-12 (one per quiet stretch). A failed send deletes its claim so the next run retries it.
CREATE TABLE IF NOT EXISTS sprint_emails (
  cohort TEXT NOT NULL,
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  key TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent')),
  subject TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  PRIMARY KEY (cohort, slug, key)
);
