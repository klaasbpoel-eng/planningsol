-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL,
  due_date DATE NOT NULL,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view tasks
CREATE POLICY "Authenticated users can view all tasks"
ON public.tasks
FOR SELECT
USING (true);

-- Only admins can create tasks
CREATE POLICY "Admins can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (is_admin());

-- Only admins can update tasks
CREATE POLICY "Admins can update tasks"
ON public.tasks
FOR UPDATE
USING (is_admin());

-- Only admins can delete tasks
CREATE POLICY "Admins can delete tasks"
ON public.tasks
FOR DELETE
USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();