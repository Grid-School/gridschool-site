-- An approved leader must continue to satisfy every deterministic boundary.
-- Earlier upserts preserved approval after later enrichment disproved it.

UPDATE opportunity_leaders
SET status = 'rejected',
    qualification_reason = CASE
      WHEN followers IS NULL THEN 'follower count is unknown'
      WHEN followers NOT BETWEEN 2000 AND 50000
        THEN 'follower count is outside 2,000 to 50,000'
      WHEN employee_count IS NULL THEN 'company employee count is unknown'
      WHEN employee_count NOT BETWEEN 2 AND 300
        THEN 'company size is outside 2 to 300'
      ELSE 'stored qualification no longer passes'
    END,
    updated_at = now()
WHERE status = 'approved'
  AND (
    followers IS NULL
    OR followers NOT BETWEEN 2000 AND 50000
    OR employee_count IS NULL
    OR employee_count NOT BETWEEN 2 AND 300
  );
