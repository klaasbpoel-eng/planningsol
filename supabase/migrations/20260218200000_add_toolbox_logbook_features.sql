-- Add validity_months to toolboxes table
ALTER TABLE public.toolboxes 
ADD COLUMN IF NOT EXISTS validity_months integer NOT NULL DEFAULT 12;

-- Update existing toolboxes to have 12 months validity (already covered by DEFAULT, but good to be explicit if needed, though DEFAULT handles new rows and existing rows if using a simple ADD COLUMN with DEFAULT in Postgres fills it)
-- In Postgres, ADD COLUMN ... DEFAULT ... fills existing rows.

-- Create an index on toolbox_completions for faster filtering/sorting in the logbook
CREATE INDEX IF NOT EXISTS idx_toolbox_completions_user_id ON public.toolbox_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_toolbox_completions_toolbox_id ON public.toolbox_completions(toolbox_id);
CREATE INDEX IF NOT EXISTS idx_toolbox_completions_completed_at ON public.toolbox_completions(completed_at);

-- Add comment
COMMENT ON COLUMN public.toolboxes.validity_months IS 'Validity period in months. Default is 12.';
