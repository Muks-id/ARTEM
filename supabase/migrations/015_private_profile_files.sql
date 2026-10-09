CREATE TABLE IF NOT EXISTS public.profile_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 180),
  content_type TEXT NOT NULL CHECK (
    content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profile_files_owner_created_idx
  ON public.profile_files (owner_id, created_at DESC);

ALTER TABLE public.profile_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their own profile files"
  ON public.profile_files;
CREATE POLICY "Members can read their own profile files"
  ON public.profile_files
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.jwt() ->> 'sub'));

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'profile-private-files',
  'profile-private-files',
  FALSE,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Members can read their own private profile files"
  ON storage.objects;
CREATE POLICY "Members can read their own private profile files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'profile-private-files'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "Members can upload their own private profile files"
  ON storage.objects;
CREATE POLICY "Members can upload their own private profile files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-private-files'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS "Members can delete their own private profile files"
  ON storage.objects;
CREATE POLICY "Members can delete their own private profile files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-private-files'
    AND (storage.foldername(name))[1] = (SELECT auth.jwt() ->> 'sub')
  );