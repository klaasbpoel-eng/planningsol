-- Update the notify_task_assignment function to also notify on deadline changes
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  assigner_name TEXT;
  old_due_date DATE;
  new_due_date DATE;
BEGIN
  -- Get the name of the person who created/modified the task
  SELECT COALESCE(full_name, email, 'Iemand') INTO assigner_name
  FROM public.profiles
  WHERE user_id = NEW.created_by;
  
  -- Handle new task assignment
  IF (TG_OP = 'INSERT') THEN
    -- Don't notify if user assigns task to themselves
    IF NEW.assigned_to != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        NEW.assigned_to,
        'Nieuwe taak toegewezen',
        assigner_name || ' heeft je de taak "' || NEW.title || '" toegewezen.',
        '/kalender'
      );
    END IF;
  END IF;
  
  -- Handle reassignment (assigned_to changed)
  IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- Don't notify if user assigns task to themselves
    IF NEW.assigned_to != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        NEW.assigned_to,
        'Taak aan jou toegewezen',
        assigner_name || ' heeft de taak "' || NEW.title || '" aan jou toegewezen.',
        '/kalender'
      );
    END IF;
  END IF;
  
  -- Handle deadline change
  IF (TG_OP = 'UPDATE' AND OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
    -- Notify the assigned user about the deadline change (if they didn't change it themselves)
    IF NEW.assigned_to != NEW.created_by OR OLD.assigned_to = NEW.assigned_to THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        NEW.assigned_to,
        'Deadline gewijzigd',
        'De deadline van "' || NEW.title || '" is gewijzigd naar ' || to_char(NEW.due_date, 'DD-MM-YYYY') || '.',
        '/kalender'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS notify_task_assignment_trigger ON public.tasks;
CREATE TRIGGER notify_task_assignment_trigger
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();