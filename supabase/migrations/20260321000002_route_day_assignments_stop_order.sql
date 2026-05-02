-- B4: Handmatige rijvolgorde per dag
-- Voegt stop_order jsonb toe aan route_day_assignments.
-- Formaat: { "1": 3, "2": 1, "3": 5 } (dag → handmatige stop-positie)

ALTER TABLE public.route_day_assignments
  ADD COLUMN IF NOT EXISTS stop_order jsonb;

COMMENT ON COLUMN public.route_day_assignments.stop_order
  IS 'Handmatige rijvolgorde per weekdag. Formaat: {"1": 0, "3": 2, ...} (dagindex → positie).';
