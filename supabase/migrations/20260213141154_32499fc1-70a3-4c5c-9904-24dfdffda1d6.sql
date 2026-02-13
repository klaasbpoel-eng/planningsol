
-- Create table for gas mixture recipes
CREATE TABLE public.gas_mixture_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  target_pressure INTEGER NOT NULL DEFAULT 200,
  cylinder_volume INTEGER NOT NULL DEFAULT 50,
  n2_percentage NUMERIC NOT NULL DEFAULT 0,
  co2_percentage NUMERIC NOT NULL DEFAULT 0,
  ar_percentage NUMERIC NOT NULL DEFAULT 0,
  o2_percentage NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gas_mixture_recipes ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all recipes"
  ON public.gas_mixture_recipes FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can create recipes"
  ON public.gas_mixture_recipes FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update recipes"
  ON public.gas_mixture_recipes FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete recipes"
  ON public.gas_mixture_recipes FOR DELETE
  USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_gas_mixture_recipes_updated_at
  BEFORE UPDATE ON public.gas_mixture_recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
