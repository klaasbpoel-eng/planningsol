-- Add UPDATE and DELETE RLS policies for operators and supervisors on gas_cylinder_orders

-- Policy for Operators: can update gas cylinder orders at their assigned location
CREATE POLICY "Operators can update gas cylinder orders at their location"
ON public.gas_cylinder_orders
FOR UPDATE
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR get_user_production_location(auth.uid()) IS NULL
  )
);

-- Policy for Operators: can delete gas cylinder orders at their assigned location
CREATE POLICY "Operators can delete gas cylinder orders at their location"
ON public.gas_cylinder_orders
FOR DELETE
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR get_user_production_location(auth.uid()) IS NULL
  )
);

-- Policy for Supervisors: can update gas cylinder orders at their assigned location
CREATE POLICY "Supervisors can update gas cylinder orders at their location"
ON public.gas_cylinder_orders
FOR UPDATE
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR get_user_production_location(auth.uid()) IS NULL
  )
);

-- Policy for Supervisors: can delete gas cylinder orders at their assigned location
CREATE POLICY "Supervisors can delete gas cylinder orders at their location"
ON public.gas_cylinder_orders
FOR DELETE
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR get_user_production_location(auth.uid()) IS NULL
  )
);