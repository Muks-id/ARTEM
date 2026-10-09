CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_one_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_two_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT direct_conversations_distinct_members
    CHECK (member_one_id < member_two_id),
  CONSTRAINT direct_conversations_member_pair_unique
    UNIQUE (member_one_id, member_two_id)
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT direct_messages_distinct_members CHECK (sender_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS public.direct_message_hides (
  message_id UUID NOT NULL
    REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS direct_messages_conversation_created_idx
  ON public.direct_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS direct_messages_recipient_unread_idx
  ON public.direct_messages (recipient_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS direct_message_hides_user_idx
  ON public.direct_message_hides (user_id, message_id);

ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_hides ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.direct_conversations TO authenticated;
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;
GRANT UPDATE (read_at) ON public.direct_messages TO authenticated;
GRANT SELECT, INSERT ON public.direct_message_hides TO authenticated;

DROP POLICY IF EXISTS "Members can read their direct conversations"
  ON public.direct_conversations;
CREATE POLICY "Members can read their direct conversations"
  ON public.direct_conversations FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'sub' IN (member_one_id, member_two_id));

DROP POLICY IF EXISTS "Members can create their direct conversations"
  ON public.direct_conversations;
CREATE POLICY "Members can create their direct conversations"
  ON public.direct_conversations FOR INSERT TO authenticated
  WITH CHECK (
    member_one_id < member_two_id
    AND auth.jwt() ->> 'sub' IN (member_one_id, member_two_id)
  );

DROP POLICY IF EXISTS "Members can read their direct messages"
  ON public.direct_messages;
CREATE POLICY "Members can read their direct messages"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (
    auth.jwt() ->> 'sub' IN (sender_id, recipient_id)
    AND EXISTS (
      SELECT 1
      FROM public.direct_conversations conversation
      WHERE conversation.id = conversation_id
        AND auth.jwt() ->> 'sub' IN (
          conversation.member_one_id,
          conversation.member_two_id
        )
    )
  );

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
  );

DROP POLICY IF EXISTS "Recipients can mark their direct messages read"
  ON public.direct_messages;
CREATE POLICY "Recipients can mark their direct messages read"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'sub' = recipient_id)
  WITH CHECK (auth.jwt() ->> 'sub' = recipient_id AND read_at IS NOT NULL);

DROP POLICY IF EXISTS "Members can read their hidden direct messages"
  ON public.direct_message_hides;
CREATE POLICY "Members can read their hidden direct messages"
  ON public.direct_message_hides FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Members can hide direct messages for themselves"
  ON public.direct_message_hides;
CREATE POLICY "Members can hide direct messages for themselves"
  ON public.direct_message_hides FOR INSERT TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'sub' = user_id
    AND EXISTS (
      SELECT 1
      FROM public.direct_messages message
      WHERE message.id = message_id
        AND auth.jwt() ->> 'sub' IN (message.sender_id, message.recipient_id)
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
END;
$$;
