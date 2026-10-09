ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID
  REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_reply_to_idx
  ON public.messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id UUID NOT NULL
    REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL
    CHECK (emoji IN ('👍', '❤️', '😂', '🎉', '👏', '🔥')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
  ON public.message_reactions (message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;

DROP POLICY IF EXISTS "Members can read chat reactions"
  ON public.message_reactions;
CREATE POLICY "Members can read chat reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'sub' IS NOT NULL);

DROP POLICY IF EXISTS "Members can add their own chat reactions"
  ON public.message_reactions;
CREATE POLICY "Members can add their own chat reactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Members can remove their own chat reactions"
  ON public.message_reactions;
CREATE POLICY "Members can remove their own chat reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END;
$$;
