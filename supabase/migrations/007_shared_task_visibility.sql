DROP POLICY IF EXISTS "Members can read their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated members can read all tasks" ON public.tasks;

CREATE POLICY "Authenticated members can read all tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'sub' IS NOT NULL);
