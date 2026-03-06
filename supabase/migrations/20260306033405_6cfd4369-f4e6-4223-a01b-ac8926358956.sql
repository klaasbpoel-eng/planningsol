
-- Create pgs_substances table
CREATE TABLE public.pgs_substances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gas_type_id uuid REFERENCES public.gas_types(id) ON DELETE SET NULL,
  location public.production_location NOT NULL DEFAULT 'sol_emmen',
  pgs_guideline text NOT NULL DEFAULT '',
  max_allowed_kg numeric NOT NULL DEFAULT 0,
  current_stock_kg numeric NOT NULL DEFAULT 0,
  storage_class text,
  hazard_symbols text[] DEFAULT '{}',
  un_number text,
  cas_number text,
  risk_phrases text,
  safety_phrases text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pgs_substances ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admins can do everything on pgs_substances"
  ON public.pgs_substances FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supervisors: read only on their location
CREATE POLICY "Supervisors can view pgs_substances at their location"
  ON public.pgs_substances FOR SELECT
  USING (
    public.has_role(auth.uid(), 'supervisor') AND (
      (public.get_user_production_location(auth.uid()) IS NOT NULL AND location = public.get_user_production_location(auth.uid()))
      OR public.get_user_production_location(auth.uid()) IS NULL
    )
  );

-- Operators: read only on their location
CREATE POLICY "Operators can view pgs_substances at their location"
  ON public.pgs_substances FOR SELECT
  USING (
    public.has_role(auth.uid(), 'operator') AND (
      (public.get_user_production_location(auth.uid()) IS NOT NULL AND location = public.get_user_production_location(auth.uid()))
      OR public.get_user_production_location(auth.uid()) IS NULL
    )
  );
