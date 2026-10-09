ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT 'drafter';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_position_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_position_check
  CHECK (position IN ('drafter', 'admin', 'supervisi'));
