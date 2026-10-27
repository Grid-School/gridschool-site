-- Two notes to a giver around the weekly one (server/gifts_api.py), each sent
-- once: nudged_at, when the gift sat unaccepted 3 days after its invite and the
-- giver got a message they could send; first_step_at, when the person who
-- accepted it (and shared their progress) finished their first step.
-- Additive; safe to re-run.

ALTER TABLE gifts ADD COLUMN IF NOT EXISTS nudged_at TIMESTAMPTZ;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS first_step_at TIMESTAMPTZ;
