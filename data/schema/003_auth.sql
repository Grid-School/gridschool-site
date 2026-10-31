-- Student login. Invite + password. Tokens stay server-side.
-- Apply on account 643600678330 only. Spec: ops/student-data.md

ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS invite_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS paid TEXT NOT NULL DEFAULT 'deposit';

-- 'comped' is a free sprint seat (048_sprint.sql). Every schema file runs on every boot, in order, so this
-- line must allow every value a later file adds, or a boot would fail on the rows that use it.
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_paid_check;
ALTER TABLE students ADD CONSTRAINT students_paid_check
  CHECK (paid IN ('deposit', 'paid', 'paused', 'comped'));
