-- Add parent_id column to task_types for hierarchical categories
ALTER TABLE public.task_types
ADD COLUMN parent_id uuid REFERENCES public.task_types(id) ON DELETE SET NULL;

-- Add index for better query performance on parent lookups
CREATE INDEX idx_task_types_parent_id ON public.task_types(parent_id);

-- Insert some example main categories and subcategories
INSERT INTO public.task_types (name, description, color, parent_id) VALUES
  ('Administratie', 'Administratieve taken', '#3b82f6', NULL),
  ('Technisch', 'Technische werkzaamheden', '#10b981', NULL),
  ('Klantcontact', 'Klantgerelateerde taken', '#f59e0b', NULL);

-- Insert subcategories (we need to reference the parent IDs)
WITH parents AS (
  SELECT id, name FROM public.task_types WHERE parent_id IS NULL
)
INSERT INTO public.task_types (name, description, color, parent_id)
SELECT 
  sub.name,
  sub.description,
  sub.color,
  p.id
FROM (VALUES
  ('Facturatie', 'Facturen verwerken', '#60a5fa', 'Administratie'),
  ('Rapportage', 'Rapporten opstellen', '#93c5fd', 'Administratie'),
  ('Onderhoud', 'Systeem onderhoud', '#34d399', 'Technisch'),
  ('Installatie', 'Nieuwe installaties', '#6ee7b7', 'Technisch'),
  ('Support', 'Klantenservice', '#fbbf24', 'Klantcontact'),
  ('Offerte', 'Offertes maken', '#fcd34d', 'Klantcontact')
) AS sub(name, description, color, parent_name)
JOIN parents p ON p.name = sub.parent_name;