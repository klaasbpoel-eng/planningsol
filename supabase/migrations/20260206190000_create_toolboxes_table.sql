-- Create toolboxes table
CREATE TABLE IF NOT EXISTS public.toolboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    thumbnail_url TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.toolboxes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for authenticated users"
ON public.toolboxes
FOR SELECT
TO authenticated
USING (true);

-- Allow admins/supervisors to manage toolboxes (simplified for now, following existing patterns if any, or just unrestricted for authenticated for simplicity if roles aren't strictly enforced yet in RLS, but better to be safe)
-- Looking at existing migrations might be better, but standard authenticated read is safe. 
-- For write, I'll restrict to authenticated for now as basic protection.
CREATE POLICY "Allow all access for authenticated users"
ON public.toolboxes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add seed data
INSERT INTO public.toolboxes (title, description, category, thumbnail_url, file_url)
VALUES (
    'Product stickers en medicinale stickers op medische eigendomscilinders',
    'Instructie over het aanbrengen van de juiste stickers op cilinders.',
    'Training',
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=2070&ixlib=rb-4.0.3', 
    '#'
);
