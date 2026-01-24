-- Create task_types table
CREATE TABLE public.task_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#06b6d4',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

-- Anyone can view active task types
CREATE POLICY "Anyone can view active task types"
ON public.task_types
FOR SELECT
USING (is_active = true);

-- Admins can view all task types
CREATE POLICY "Admins can view all task types"
ON public.task_types
FOR SELECT
USING (is_admin());

-- Only admins can create task types
CREATE POLICY "Admins can insert task types"
ON public.task_types
FOR INSERT
WITH CHECK (is_admin());

-- Only admins can update task types
CREATE POLICY "Admins can update task types"
ON public.task_types
FOR UPDATE
USING (is_admin());

-- Only admins can delete task types
CREATE POLICY "Admins can delete task types"
ON public.task_types
FOR DELETE
USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_task_types_updated_at
BEFORE UPDATE ON public.task_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add type_id column to tasks table
ALTER TABLE public.tasks ADD COLUMN type_id UUID REFERENCES public.task_types(id);

-- Insert default task types
INSERT INTO public.task_types (name, color, description) VALUES
  ('Algemeen', '#06b6d4', 'Algemene taken'),
  ('Vergadering', '#8b5cf6', 'Vergaderingen en meetings'),
  ('Deadline', '#ef4444', 'Deadlines en belangrijke data'),
  ('Training', '#22c55e', 'Trainingen en opleidingen');