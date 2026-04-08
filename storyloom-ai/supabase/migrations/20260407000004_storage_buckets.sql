-- ============================================================
-- Migration 004 — Storage buckets
--
-- Two buckets:
--   character-photos  — user-uploaded reference photos (private)
--   scene-images      — AI-generated scene images (public CDN)
-- ============================================================

-- character-photos: private — only the owning user can read/write
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-photos',
  'character-photos',
  false,                          -- private
  5242880,                        -- 5 MB
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- scene-images: public CDN — readable by anyone (images are served via CDN URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scene-images',
  'scene-images',
  true,                           -- public CDN
  10485760,                       -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;


-- ---- Storage RLS policies ---------------------------------

-- character-photos: users can upload to their own folder
CREATE POLICY "char_photos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'character-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "char_photos_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'character-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "char_photos_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'character-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all character photos (moderation)
CREATE POLICY "char_photos_select_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'character-photos'
    AND public.is_admin()
  );

-- scene-images: backend service_role writes; anyone can read (public bucket)
-- Public bucket objects are served via the CDN automatically.
-- Backend uses service_role key for uploads — no client INSERT policy needed.

-- Users can delete their own story's scene images
CREATE POLICY "scene_images_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'scene-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
