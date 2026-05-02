-- C4: Weekplanning templates
-- Nieuwe tabel om opgeslagen weekplanningen als herbruikbaar template te bewaren.

CREATE TABLE IF NOT EXISTS public.route_planning_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  assignments jsonb       NOT NULL DEFAULT '{}'::jsonb
    -- Snapshot van route_day_assignments: { [customer_key]: DayAssignment }
);

COMMENT ON TABLE public.route_planning_templates
  IS 'Opgeslagen weekplanning-templates voor routeplanning. Elke template bevat een snapshot van alle klant-toewijzingen.';

-- RLS
ALTER TABLE public.route_planning_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read route planning templates"
  ON public.route_planning_templates;
CREATE POLICY "Authenticated users can read route planning templates"
  ON public.route_planning_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage route planning templates"
  ON public.route_planning_templates;
CREATE POLICY "Authenticated users can manage route planning templates"
  ON public.route_planning_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_route_planning_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_planning_templates_updated_at
  ON public.route_planning_templates;
CREATE TRIGGER trg_route_planning_templates_updated_at
  BEFORE UPDATE ON public.route_planning_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_route_planning_templates_updated_at();
