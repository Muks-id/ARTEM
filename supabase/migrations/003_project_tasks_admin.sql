ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revision_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS revision_date DATE;

UPDATE public.tasks
SET project_name = 'Proyek lama'
WHERE project_name = '';

UPDATE public.tasks
SET completed_at = created_at
WHERE status = 'selesai' AND completed_at IS NULL;

DROP POLICY IF EXISTS "Members can delete their own tasks" ON public.tasks;
REVOKE DELETE ON TABLE public.tasks FROM authenticated;