-- Nieuwe functie voor maandelijkse totalen per cilindergrootte
CREATE OR REPLACE FUNCTION public.get_monthly_cylinder_totals_by_size(
  p_year integer, 
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  month integer, 
  cylinder_size text, 
  total_cylinders bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM gco.scheduled_date)::integer as month,
    gco.cylinder_size,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM gas_cylinder_orders gco
  WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
    AND gco.scheduled_date <= make_date(p_year, 12, 31)
    AND (p_location IS NULL OR gco.location::text = p_location)
  GROUP BY EXTRACT(MONTH FROM gco.scheduled_date), gco.cylinder_size
  ORDER BY month, cylinder_size;
END;
$function$