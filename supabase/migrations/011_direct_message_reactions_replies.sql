ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID
  REFERENCES public.direct_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS direct_messages_reply_to_idx
  ON public.direct_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.direct_message_reactions (
  message_id UUID NOT NULL
    REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL
    CHECK (emoji IN ('👍', '❤️', '😂', '🎉', '👏', '🔥')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS direct_message_reactions_message_idx
  ON public.direct_message_reactions (message_id);

ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.direct_message_reactions TO authenticated;
GRANT UPDATE (read_at, reply_to_id) ON public.direct_messages TO authenticated;

DROP POLICY IF EXISTS "Members can send their own direct messages"
  ON public.direct_messages;
CREATE POLICY "Members can send their own direct messages"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'sub' = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.direct_conversations conversation
      WHERE conversation.id = conversation_id
        AND sender_id IN (conversation.member_one_id, conversation.member_two_id)
        AND recipient_id IN (conversation.member_one_id, conversation.member_two_id)
        AND sender_id <> recipient_id
    )
    AND (
      reply_to_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.direct_messages replied
        WHERE replied.id = reply_to_id
          AND replied.conversation_id = conversation_id
          AND auth.jwt() ->> 'sub' IN (replied.sender_id, replied.recipient_id)
      )
    )
  );

DROP POLICY IF EXISTS "Conversation members can read direct message reactions"
  ON public.direct_message_reactions;
CREATE POLICY "Conversation members can read direct message reactions"
  ON public.direct_message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.direct_messages message
      WHERE message.id = message_id
        AND (
          auth.jwt() ->> 'sub' = message.sender_id
          OR auth.jwt() ->> 'sub' = message.recipient_id
        )
    )
  );

DROP POLICY IF EXISTS "Members can add their own direct message reactions"
  ON public.direct_message_reactions;
CREATE POLICY "Members can add their own direct message reactions"
  ON public.direct_message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'sub' = user_id
    AND EXISTS (
      SELECT 1
      FROM public.direct_messages message
      WHERE message.id = message_id
        AND auth.jwt() ->> 'sub' IN (message.sender_id, message.recipient_id)
    )
  );

DROP POLICY IF EXISTS "Members can remove their own direct message reactions"
  ON public.direct_message_reactions;
CREATE POLICY "Members can remove their own direct message reactions"
  ON public.direct_message_reactions FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Participants can reply to direct messages"
  ON public.direct_messages;
CREATE POLICY "Participants can reply to direct messages"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'sub' = sender_id)
  WITH CHECK (
    auth.jwt() ->> 'sub' = sender_id
    AND (
      reply_to_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.direct_messages replied
        WHERE replied.id = reply_to_id
          AND replied.conversation_id = conversation_id
          AND auth.jwt() ->> 'sub' IN (replied.sender_id, replied.recipient_id)
      )
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'direct_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_reactions;
  END IF;
END;
$$;
