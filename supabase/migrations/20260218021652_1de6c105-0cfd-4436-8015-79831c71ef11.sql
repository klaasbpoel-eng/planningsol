
-- Create section type enum
CREATE TYPE public.toolbox_section_type AS ENUM ('text', 'image', 'video', 'file', 'quiz', 'checklist');

-- Create toolbox status enum
CREATE TYPE public.toolbox_status AS ENUM ('draft', 'published', 'archived');

-- Extend toolboxes table
ALTER TABLE public.toolboxes 
  ADD COLUMN status public.toolbox_status NOT NULL DEFAULT 'published',
  ADD COLUMN published_at timestamptz,
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN cover_image_url text,
  ADD COLUMN estimated_duration_minutes integer,
  ADD COLUMN is_mandatory boolean NOT NULL DEFAULT false;

-- Create toolbox_sections table
CREATE TABLE public.toolbox_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  toolbox_id uuid NOT NULL REFERENCES public.toolboxes(id) ON DELETE CASCADE,
  section_type public.toolbox_section_type NOT NULL DEFAULT 'text',
  title text,
  content text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create toolbox_completions table
CREATE TABLE public.toolbox_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  toolbox_id uuid NOT NULL REFERENCES public.toolboxes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  score integer,
  UNIQUE(toolbox_id, user_id)
);

-- Enable RLS
ALTER TABLE public.toolbox_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toolbox_completions ENABLE ROW LEVEL SECURITY;

-- RLS for toolbox_sections: everyone can read sections of published toolboxes, admins can manage all
CREATE POLICY "Admins can manage toolbox sections"
  ON public.toolbox_sections FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can view sections of published toolboxes"
  ON public.toolbox_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.toolboxes t 
      WHERE t.id = toolbox_sections.toolbox_id 
      AND t.status = 'published'
    )
  );

-- RLS for toolbox_completions: users can manage own, admins can view all
CREATE POLICY "Users can insert own completions"
  ON public.toolbox_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own completions"
  ON public.toolbox_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all completions"
  ON public.toolbox_completions FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can delete completions"
  ON public.toolbox_completions FOR DELETE
  USING (is_admin());

-- Update existing toolboxes RLS to filter by status for non-admins
-- First drop the existing permissive policy for authenticated users
DROP POLICY IF EXISTS "Authenticated users can view toolboxes" ON public.toolboxes;

-- Re-create: non-admins only see published toolboxes
CREATE POLICY "Authenticated users can view published toolboxes"
  ON public.toolboxes FOR SELECT
  USING (status = 'published' OR is_admin());

-- Update trigger for toolbox_sections
CREATE TRIGGER update_toolbox_sections_updated_at
  BEFORE UPDATE ON public.toolbox_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Set published_at for existing toolboxes
UPDATE public.toolboxes SET published_at = created_at WHERE status = 'published';
