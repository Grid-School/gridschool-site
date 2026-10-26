-- Screenshots of looks the student likes (Who you are, chunk c7 styleShots): a fourth upload kind,
-- 'style', in profile_images. Up to six per student (images_api.MAX_STYLE); seeds.taste.shots lists them
-- and the banner generator reads them next. Re-runnable: the constraint is replaced, never duplicated.

ALTER TABLE profile_images DROP CONSTRAINT IF EXISTS profile_images_kind_check;
ALTER TABLE profile_images ADD CONSTRAINT profile_images_kind_check
  CHECK (kind IN ('face', 'photo_current', 'banner_current', 'style', 'headshot', 'banner'));
