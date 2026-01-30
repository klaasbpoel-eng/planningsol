-- Create function to get monthly cylinder totals grouped by gas type
CREATE OR REPLACE FUNCTION public.get_monthly_cylinder_totals_by_gas_type(p_year integer)
RETURNS TABLE(
  month integer,
  gas_type_id uuid,
  gas_type_name text,
  gas_type_color text,
  total_cylinders bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM gco.scheduled_date)::integer as month,
    gt.id as gas_type_id,
    gt.name as gas_type_name,
    gt.color as gas_type_color,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM gas_cylinder_orders gco
  LEFT JOIN gas_types gt ON gco.gas_type_id = gt.id
  WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
    AND gco.scheduled_date <= make_date(p_year, 12, 31)
  GROUP BY EXTRACT(MONTH FROM gco.scheduled_date), gt.id, gt.name, gt.color
  ORDER BY month, gas_type_name;
END;
$$;