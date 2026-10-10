-- The radar gains Hacker News "Who is hiring?" as one more source
-- (server/roles/feeds/hn.py): a board with ats = 'hn'. The CHECK on ats is
-- replaced; dropping first keeps this file re-runnable.

ALTER TABLE role_boards DROP CONSTRAINT IF EXISTS role_boards_ats_check;
ALTER TABLE role_boards ADD CONSTRAINT role_boards_ats_check CHECK (ats IN ('greenhouse', 'lever', 'ashby', 'hn'));
