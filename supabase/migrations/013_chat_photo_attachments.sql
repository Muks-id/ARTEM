ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attachment_downloaded_at TIMESTAMPTZ;

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachment_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attachment_downloaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS messages_expiring_attachments_idx
  ON public.messages (attachment_expires_at)
  WHERE attachment_storage_path IS NOT NULL
    AND attachment_downloaded_at IS NULL;

CREATE INDEX IF NOT EXISTS direct_messages_expiring_attachments_idx
  ON public.direct_messages (attachment_expires_at)
  WHERE attachment_storage_path IS NOT NULL
    AND attachment_downloaded_at IS NULL;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'chat-photos',
  'chat-photos',
  false,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
