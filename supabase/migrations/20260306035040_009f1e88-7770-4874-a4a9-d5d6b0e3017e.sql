
-- Create bulk storage tanks table
CREATE TABLE public.bulk_storage_tanks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gas_type_id uuid REFERENCES public.gas_types(id),
  location public.production_location NOT NULL DEFAULT 'sol_emmen'::production_location,
  tank_name text NOT NULL,
  tank_number text,
  capacity_kg numeric NOT NULL DEFAULT 0,
  current_level_kg numeric NOT NULL DEFAULT 0,
  last_inspection_date date,
  next_inspection_date date,
  pgs_guideline text NOT NULL DEFAULT '',
  un_number text,
  hazard_symbols text[] DEFAULT '{}'::text[],
  storage_class text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_storage_tanks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can do everything on bulk_storage_tanks"
  ON public.bulk_storage_tanks FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Operators can view bulk_storage_tanks at their location"
  ON public.bulk_storage_tanks FOR SELECT
  USING (
    has_role(auth.uid(), 'operator'::app_role) AND (
      (get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid()))
      OR get_user_production_location(auth.uid()) IS NULL
    )
  );

CREATE POLICY "Supervisors can view bulk_storage_tanks at their location"
  ON public.bulk_storage_tanks FOR SELECT
  USING (
    has_role(auth.uid(), 'supervisor'::app_role) AND (
      (get_user_production_location(auth.uid()) IS NOT NULL AND location = get_user_production_location(auth.uid()))
      OR get_user_production_location(auth.uid()) IS NULL
    )
  );

-- Index
CREATE INDEX idx_bulk_storage_tanks_location ON public.bulk_storage_tanks(location);
CREATE INDEX idx_bulk_storage_tanks_gas_type ON public.bulk_storage_tanks(gas_type_id);
