-- Drop posts that cannot accept a comment. LinkedIn can close comments
-- after we already ranked the post as an opportunity.

ALTER TABLE opportunity_posts
  ADD COLUMN IF NOT EXISTS comments_open BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE opportunity_posts
SET comments_open = FALSE
WHERE post_id = '7508102173952737281';
