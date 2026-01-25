-- Make assigned_to column nullable for tasks
ALTER TABLE public.tasks ALTER COLUMN assigned_to DROP NOT NULL;

-- Update RLS policy to handle null assigned_to
DROP POLICY IF EXISTS "Users can view assigned or created tasks" ON public.tasks;

CREATE POLICY "Users can view assigned or created tasks" 
ON public.tasks 
FOR SELECT 
USING (
  (assigned_to IS NOT NULL AND auth.uid() = assigned_to) 
  OR (auth.uid() = created_by) 
  OR is_admin()
);