-- Function to get gas category distribution for a date period
CREATE OR REPLACE FUNCTION public.get_gas_category_distribution_by_period(
  p_from_date date,
  p_to_date date,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  category_id uuid,
  category_name text,
  total_cylinders bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    gtc.id as category_id,
    COALESCE(gtc.name, 'Geen categorie') as category_name,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM public.gas_cylinder_orders gco
  LEFT JOIN public.gas_types gt ON gco.gas_type_id = gt.id
  LEFT JOIN public.gas_type_categories gtc ON gt.category_id = gtc.id
  WHERE gco.scheduled_date >= p_from_date
    AND gco.scheduled_date <= p_to_date
    AND gco.status != 'cancelled'
    AND (p_location IS NULL OR gco.location::text = p_location)
  GROUP BY gtc.id, gtc.name
  ORDER BY total_cylinders DESC;
END;
$$;
