-- Add location-based RLS policies for operators and supervisors on gas_cylinder_orders
-- These mirror the existing policies on dry_ice_orders

-- Policy for Operators: can view gas cylinder orders at their assigned location
CREATE POLICY "Operators can view gas cylinder orders at their location"
ON public.gas_cylinder_orders
FOR SELECT
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR get_user_production_location(auth.uid()) IS NULL
  )
);

-- Policy for Supervisors: can view gas cylinder orders at their assigned location
CREATE POLICY "Supervisors can view gas cylinder orders at their location"
ON public.gas_cylinder_orders
FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR get_user_production_location(auth.uid()) IS NULL
  )
);