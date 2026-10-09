-- Artem Geng community portal schema for Clerk third-party authentication.
-- Configure Clerk as a Supabase third-party auth provider before using the app.

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  email TEXT NOT NULL,
  bio TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'belum_dikerjakan'
    CHECK (status IN ('belum_dikerjakan', 'dikerjakan', 'selesai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_user_created_idx
  ON public.tasks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_created_idx
  ON public.messages (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- Expose only community-safe profile fields. The view owner can read profiles
-- under RLS, but callers cannot select private email/bio fields through it.
CREATE OR REPLACE VIEW public.member_directory
  WITH (security_invoker = false)
AS
  SELECT id, full_name, username, avatar_url
  FROM public.profiles;

GRANT SELECT ON public.member_directory TO authenticated;
REVOKE ALL ON public.member_directory FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;

DROP POLICY IF EXISTS "Authenticated members can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Members can read their own profile" ON public.profiles;
CREATE POLICY "Members can read their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'sub' = id);

DROP POLICY IF EXISTS "Members can create their own profile" ON public.profiles;
CREATE POLICY "Members can create their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'sub' = id);

DROP POLICY IF EXISTS "Members can update their own profile" ON public.profiles;
CREATE POLICY "Members can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'sub' = id)
  WITH CHECK (auth.jwt() ->> 'sub' = id);

DROP POLICY IF EXISTS "Members can read their own tasks" ON public.tasks;
CREATE POLICY "Members can read their own tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Members can create their own tasks" ON public.tasks;
CREATE POLICY "Members can create their own tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Members can update their own tasks" ON public.tasks;
CREATE POLICY "Members can update their own tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id)
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Members can delete their own tasks" ON public.tasks;
CREATE POLICY "Members can delete their own tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Authenticated members can read chat messages" ON public.messages;
CREATE POLICY "Authenticated members can read chat messages"
  ON public.messages FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'sub' IS NOT NULL);

DROP POLICY IF EXISTS "Members can send messages as themselves" ON public.messages;
CREATE POLICY "Members can send messages as themselves"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'sub' = sender_id);

-- Add messages to Supabase Realtime only once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END;
$$;
