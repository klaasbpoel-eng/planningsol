-- Fix 1: Drop and recreate profiles_limited view with security_invoker
DROP VIEW IF EXISTS public.profiles_limited;

CREATE VIEW public.profiles_limited
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  full_name,
  email,
  department,
  job_title
FROM public.profiles;

-- Grant access to authenticated users only
GRANT SELECT ON public.profiles_limited TO authenticated;

-- Fix 2: Add CHECK constraints for status and priority on tasks table
-- First check if constraints exist
DO $$
BEGIN
  -- Add status constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_check'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
      CHECK (status IN ('pending', 'in_progress', 'completed'));
  END IF;
  
  -- Add priority constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_check'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check 
      CHECK (priority IN ('low', 'medium', 'high'));
  END IF;
END $$;

-- Fix 3: Update the notify_task_assignment function to not reference title
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigner_name TEXT;
  task_name TEXT;
BEGIN
  -- Get the name of the person who created/modified the task
  SELECT COALESCE(p.full_name, p.email, 'Iemand') INTO assigner_name
  FROM public.profiles p
  WHERE p.user_id = NEW.created_by;
  
  -- FALLBACK: If no profile exists, set a default name
  IF assigner_name IS NULL THEN
    assigner_name := 'Iemand';
  END IF;
  
  -- Get task type name if available, otherwise use generic name
  SELECT COALESCE(tt.name, 'een taak') INTO task_name
  FROM public.task_types tt
  WHERE tt.id = NEW.type_id;
  
  IF task_name IS NULL THEN
    task_name := 'een taak';
  END IF;
  
  -- Handle new task assignment
  IF (TG_OP = 'INSERT') THEN
    IF NEW.assigned_to != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        NEW.assigned_to,
        'Nieuwe taak toegewezen',
        assigner_name || ' heeft je ' || task_name || ' toegewezen.',
        '/kalender'
      );
    END IF;
  END IF;
  
  -- Handle reassignment
  IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    IF NEW.assigned_to != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        NEW.assigned_to,
        'Taak aan jou toegewezen',
        assigner_name || ' heeft ' || task_name || ' aan jou toegewezen.',
        '/kalender'
      );
    END IF;
  END IF;
  
  -- Handle deadline change
  IF (TG_OP = 'UPDATE' AND OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
    IF NEW.assigned_to != NEW.created_by OR OLD.assigned_to = NEW.assigned_to THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        NEW.assigned_to,
        'Deadline gewijzigd',
        'De deadline van ' || task_name || ' is gewijzigd naar ' || to_char(NEW.due_date, 'DD-MM-YYYY') || '.',
        '/kalender'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;