-- Per-student Discord user ID, so board events can ping the student where
-- they already live (webhook mention) before email ever gets involved.
ALTER TABLE students ADD COLUMN IF NOT EXISTS discord text NOT NULL DEFAULT '';
