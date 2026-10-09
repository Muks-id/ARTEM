CREATE OR REPLACE FUNCTION public.can_reference_direct_message(
  p_reply_to_id UUID,
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_reply_to_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.direct_messages AS replied
      WHERE replied.id = p_reply_to_id
        AND replied.conversation_id = p_conversation_id
        AND auth.jwt() ->> 'sub' IN (replied.sender_id, replied.recipient_id)
    );
$$;

REVOKE ALL ON FUNCTION public.can_reference_direct_message(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_reference_direct_message(UUID, UUID)
  TO authenticated;

DROP POLICY IF EXISTS "Members can send their own direct messages"
  ON public.direct_messages;
CREATE POLICY "Members can send their own direct messages"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'sub' = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.direct_conversations AS conversation
      WHERE conversation.id = conversation_id
        AND sender_id IN (conversation.member_one_id, conversation.member_two_id)
        AND recipient_id IN (conversation.member_one_id, conversation.member_two_id)
        AND sender_id <> recipient_id
    )
    AND (
      reply_to_id IS NULL
      OR public.can_reference_direct_message(reply_to_id, conversation_id)
    )
  );

DROP POLICY IF EXISTS "Participants can reply to direct messages"
  ON public.direct_messages;
CREATE POLICY "Participants can reply to direct messages"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'sub' = sender_id)
  WITH CHECK (
    auth.jwt() ->> 'sub' = sender_id
    AND (
      reply_to_id IS NULL
      OR public.can_reference_direct_message(reply_to_id, conversation_id)
    )
  );
