CREATE OR REPLACE FUNCTION get_distinct_gas_type_ids_by_location(p_location TEXT)
RETURNS TABLE(gas_type_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT gco.gas_type_id
  FROM public.gas_cylinder_orders gco
  WHERE gco.location::text = p_location
    AND gco.gas_type_id IS NOT NULL;
$$;