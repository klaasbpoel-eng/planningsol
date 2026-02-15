
-- Junction table: which customers are available at which production locations
CREATE TABLE public.customer_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (customer_id, location)
);

-- Enable RLS
ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage customer_locations"
  ON public.customer_locations
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Authenticated users can view (needed for order form filtering)
CREATE POLICY "Authenticated users can view customer_locations"
  ON public.customer_locations
  FOR SELECT
  USING (true);

-- Seed data: assign all active customers to both locations by default
INSERT INTO public.customer_locations (customer_id, location)
SELECT c.id, loc.location
FROM public.customers c
CROSS JOIN (VALUES ('sol_emmen'), ('sol_tilburg')) AS loc(location)
WHERE c.is_active = true;
