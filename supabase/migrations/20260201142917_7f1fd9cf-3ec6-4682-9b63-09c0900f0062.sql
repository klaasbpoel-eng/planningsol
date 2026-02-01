-- Allow Supervisors to view all orders at their location
CREATE POLICY "Supervisors can view orders at their location"
ON public.gas_cylinder_orders FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR
    get_user_production_location(auth.uid()) IS NULL
  )
);

-- Allow Operators to view all orders at their location  
CREATE POLICY "Operators can view orders at their location"
ON public.gas_cylinder_orders FOR SELECT
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR
    get_user_production_location(auth.uid()) IS NULL
  )
);

-- Allow Supervisors to view all dry ice orders at their location
CREATE POLICY "Supervisors can view dry ice orders at their location"
ON public.dry_ice_orders FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR
    get_user_production_location(auth.uid()) IS NULL
  )
);

-- Allow Operators to view all dry ice orders at their location
CREATE POLICY "Operators can view dry ice orders at their location"  
ON public.dry_ice_orders FOR SELECT
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR
    get_user_production_location(auth.uid()) IS NULL
  )
);