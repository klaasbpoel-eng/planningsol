
DROP TABLE IF EXISTS public.gas_packages;

CREATE TABLE public.gas_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_capacity_liters numeric NOT NULL UNIQUE,
  cylinders_per_pack integer NOT NULL DEFAULT 1,
  single_cylinder_liters numeric NOT NULL DEFAULT 50,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gas_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view gas_packages"
ON public.gas_packages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage gas_packages"
ON public.gas_packages FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER update_gas_packages_updated_at
BEFORE UPDATE ON public.gas_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.gas_packages (bundle_capacity_liters, cylinders_per_pack, single_cylinder_liters, description) VALUES
  (800, 16, 50, '16x 50L bundel'),
  (600, 12, 50, '12x 50L bundel'),
  (300, 6, 50, '6x 50L pakket'),
  (200, 4, 50, '4x 50L pakket'),
  (150, 3, 50, '3x 50L pakket'),
  (100, 2, 50, '2x 50L pakket');
