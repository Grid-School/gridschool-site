-- Profile images (server/images_api.py, images_gen.py; ops/launch-tracks.md Track 5).
-- A student's face photos, their current banner and photo, and the headshots and banners made from
-- them. Stored here, never in a public bucket: a face photo is only ever served to its own student
-- (or the admin) through an authenticated GET.
--
-- id       up_<random> for an upload (the same ref an intake upload answer holds), gen_<random> for a
--          generated option
-- kind     face | photo_current | banner_current (uploads); headshot | banner (generated options)
-- batch    the generation run the option came from: three options are made together
-- picked   the one headshot and the one banner the student chose (at most one of each)

CREATE TABLE IF NOT EXISTS profile_images (
  id TEXT PRIMARY KEY CHECK (id ~ '^(up|gen)_[A-Za-z0-9_-]{8,64}$'),
  slug TEXT NOT NULL REFERENCES students (slug) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('face', 'photo_current', 'banner_current', 'headshot', 'banner')),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 5242880),
  bytes BYTEA NOT NULL,
  batch TEXT,
  picked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (octet_length(bytes) = size),
  CHECK (picked = false OR kind IN ('headshot', 'banner'))
);

CREATE INDEX IF NOT EXISTS profile_images_by_slug ON profile_images (slug, kind, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS profile_images_one_pick ON profile_images (slug, kind) WHERE picked;
