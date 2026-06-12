
-- 1. Enum voor type opslagplaats
DO $$ BEGIN
  CREATE TYPE public.storage_place_type AS ENUM ('permanent', 'temporary', 'crossdock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Enum voor status uitbreidingsaanvragen
DO $$ BEGIN
  CREATE TYPE public.pgs_expansion_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. storage_places
CREATE TABLE IF NOT EXISTS public.storage_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location production_location NOT NULL DEFAULT 'sol_emmen',
  name text NOT NULL,
  code text,
  place_type storage_place_type NOT NULL DEFAULT 'permanent',
  max_residence_hours numeric,
  pgs_guideline text NOT NULL DEFAULT 'PGS 15',
  description text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_places TO authenticated;
GRANT ALL ON public.storage_places TO service_role;

ALTER TABLE public.storage_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage storage_places"
ON public.storage_places FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Supervisors view storage_places at their location"
ON public.storage_places FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND (
    get_user_production_location(auth.uid()) IS NULL
    OR location = get_user_production_location(auth.uid())
  )
);

CREATE POLICY "Operators view storage_places at their location"
ON public.storage_places FOR SELECT
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND (
    get_user_production_location(auth.uid()) IS NULL
    OR location = get_user_production_location(auth.uid())
  )
);

CREATE TRIGGER trg_storage_places_updated_at
BEFORE UPDATE ON public.storage_places
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_storage_places_location ON public.storage_places(location);

-- 4. Link storage_place_id naar pgs_substances en bulk_storage_tanks
ALTER TABLE public.pgs_substances
  ADD COLUMN IF NOT EXISTS storage_place_id uuid REFERENCES public.storage_places(id) ON DELETE SET NULL;

ALTER TABLE public.bulk_storage_tanks
  ADD COLUMN IF NOT EXISTS storage_place_id uuid REFERENCES public.storage_places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pgs_substances_storage_place ON public.pgs_substances(storage_place_id);
CREATE INDEX IF NOT EXISTS idx_bulk_storage_tanks_storage_place ON public.bulk_storage_tanks(storage_place_id);

-- 5. pgs_expansion_requests
CREATE TABLE IF NOT EXISTS public.pgs_expansion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gas_type_id uuid REFERENCES public.gas_types(id) ON DELETE SET NULL,
  substance_name text NOT NULL,
  location production_location NOT NULL,
  target_storage_place_id uuid REFERENCES public.storage_places(id) ON DELETE SET NULL,
  current_permitted_kg numeric NOT NULL DEFAULT 0,
  requested_permitted_kg numeric NOT NULL DEFAULT 0,
  motivation text,
  status pgs_expansion_status NOT NULL DEFAULT 'draft',
  requested_by uuid,
  requested_at timestamptz,
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgs_expansion_requests TO authenticated;
GRANT ALL ON public.pgs_expansion_requests TO service_role;

ALTER TABLE public.pgs_expansion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pgs_expansion_requests"
ON public.pgs_expansion_requests FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Supervisors manage pgs_expansion_requests at their location"
ON public.pgs_expansion_requests FOR ALL
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND (
    get_user_production_location(auth.uid()) IS NULL
    OR location = get_user_production_location(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND (
    get_user_production_location(auth.uid()) IS NULL
    OR location = get_user_production_location(auth.uid())
  )
);

CREATE POLICY "Operators view pgs_expansion_requests at their location"
ON public.pgs_expansion_requests FOR SELECT
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND (
    get_user_production_location(auth.uid()) IS NULL
    OR location = get_user_production_location(auth.uid())
  )
);

CREATE TRIGGER trg_pgs_expansion_requests_updated_at
BEFORE UPDATE ON public.pgs_expansion_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pgs_expansion_requests_location ON public.pgs_expansion_requests(location);
CREATE INDEX IF NOT EXISTS idx_pgs_expansion_requests_status ON public.pgs_expansion_requests(status);
