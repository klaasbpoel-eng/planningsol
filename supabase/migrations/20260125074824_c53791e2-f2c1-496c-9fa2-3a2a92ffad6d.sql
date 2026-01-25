-- Add sort_order column to task_types for drag-and-drop ordering
ALTER TABLE public.task_types 
ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Initialize sort_order based on current name ordering
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY COALESCE(parent_id, '00000000-0000-0000-0000-000000000000')
    ORDER BY name
  ) as rn
  FROM public.task_types
)
UPDATE public.task_types
SET sort_order = ordered.rn
FROM ordered
WHERE public.task_types.id = ordered.id;

-- Create index for efficient ordering queries
CREATE INDEX idx_task_types_sort_order ON public.task_types(parent_id, sort_order);