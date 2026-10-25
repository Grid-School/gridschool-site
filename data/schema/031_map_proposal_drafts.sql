-- What the coach's assistant drafted for each "Ask your coach" in a suggestion (server/map_ask_draft.py):
-- {<ask op id>: {"ops": [...], "why": "...", "at": "...", "error": "..."}}. The coach keeps, edits or drops each
-- drafted change in the console like any other; nothing here reaches the student's map until a publish.
-- Additive; safe to re-run.

ALTER TABLE map_proposals ADD COLUMN IF NOT EXISTS drafts JSONB NOT NULL DEFAULT '{}'::jsonb;
