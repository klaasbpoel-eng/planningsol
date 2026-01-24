-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications (via trigger)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create function to notify on task assignment
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigner_name TEXT;
BEGIN
  -- Only notify if assigned_to changed or is a new insert
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- Get the name of the person who assigned the task
    SELECT COALESCE(full_name, email, 'Iemand') INTO assigner_name
    FROM public.profiles
    WHERE user_id = NEW.created_by;
    
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
  
  RETURN NEW;
END;
$$;

-- Create trigger for task assignments
CREATE TRIGGER on_task_assignment
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();