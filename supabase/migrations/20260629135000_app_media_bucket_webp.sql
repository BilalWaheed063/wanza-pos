-- App media bucket for product images, logos and other site images.
-- Supports JPG, PNG and WebP. WebP is recommended for better loading performance.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-media',
  'app-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "app_media_public_read" ON storage.objects;
CREATE POLICY "app_media_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-media');

DROP POLICY IF EXISTS "app_media_authenticated_upload" ON storage.objects;
CREATE POLICY "app_media_authenticated_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-media');

DROP POLICY IF EXISTS "app_media_authenticated_update" ON storage.objects;
CREATE POLICY "app_media_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'app-media')
WITH CHECK (bucket_id = 'app-media');

DROP POLICY IF EXISTS "app_media_authenticated_delete" ON storage.objects;
CREATE POLICY "app_media_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'app-media');