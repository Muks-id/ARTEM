CREATE TABLE IF NOT EXISTS public.community_chat_reads (
  user_id TEXT PRIMARY KEY
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.community_chat_reads (user_id, last_read_at)
SELECT id, NOW()
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.community_chat_reads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.community_chat_reads TO authenticated;

DROP POLICY IF EXISTS "Members can read their own community chat read state"
  ON public.community_chat_reads;
CREATE POLICY "Members can read their own community chat read state"
  ON public.community_chat_reads FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Members can create their own community chat read state"
  ON public.community_chat_reads;
CREATE POLICY "Members can create their own community chat read state"
  ON public.community_chat_reads FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Members can update their own community chat read state"
  ON public.community_chat_reads;
CREATE POLICY "Members can update their own community chat read state"
  ON public.community_chat_reads FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id)
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);
