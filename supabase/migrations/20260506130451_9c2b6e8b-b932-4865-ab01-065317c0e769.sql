
CREATE TABLE public.gas_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subcode text NOT NULL UNIQUE,
  description text,
  cylinders_per_pack integer NOT NULL DEFAULT 1,
  cylinder_capacity_liters numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gas_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view gas_packages"
ON public.gas_packages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage gas_packages"
ON public.gas_packages FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE TRIGGER update_gas_packages_updated_at
BEFORE UPDATE ON public.gas_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
