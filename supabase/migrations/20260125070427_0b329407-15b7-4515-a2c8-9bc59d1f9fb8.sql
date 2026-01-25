CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigner_name TEXT;
BEGIN
  -- Get the name of the person who created/modified the task
  SELECT COALESCE(p.full_name, p.email, 'Iemand') INTO assigner_name
  FROM public.profiles p
  WHERE p.user_id = NEW.created_by;
  
  -- FALLBACK: If no profile exists, set a default name
  IF assigner_name IS NULL THEN
    assigner_name := 'Iemand';
  END IF;
  
  -- Handle new task assignment
  IF (TG_OP = 'INSERT') THEN
    IF NEW.assigned_to != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        NEW.assigned_to,
        'Nieuwe taak toegewezen',
        assigner_name || ' heeft je de taak "' || COALESCE(NEW.title, 'Onbekende taak') || '" toegewezen.',
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
        assigner_name || ' heeft de taak "' || COALESCE(NEW.title, 'Onbekende taak') || '" aan jou toegewezen.',
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
        'De deadline van "' || COALESCE(NEW.title, 'Onbekende taak') || '" is gewijzigd naar ' || to_char(NEW.due_date, 'DD-MM-YYYY') || '.',
        '/kalender'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;