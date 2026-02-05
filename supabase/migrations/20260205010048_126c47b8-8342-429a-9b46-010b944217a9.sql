-- Function to get daily production totals for a date period (for charts)
-- Returns aggregated cylinders and dry_ice per day within the given range
CREATE OR REPLACE FUNCTION public.get_daily_production_by_period(
  p_from_date date,
  p_to_date date,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  production_date date,
  cylinder_count bigint,
  dry_ice_kg numeric
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
  WITH cylinder_data AS (
    SELECT 
      gco.scheduled_date as pdate,
      COALESCE(SUM(gco.cylinder_count), 0)::bigint as cylinders
    FROM public.gas_cylinder_orders gco
    WHERE gco.scheduled_date >= p_from_date
      AND gco.scheduled_date <= p_to_date
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.scheduled_date
  ),
  dry_ice_data AS (
    SELECT 
      dio.scheduled_date as pdate,
      COALESCE(SUM(dio.quantity_kg), 0)::numeric as dry_ice
    FROM public.dry_ice_orders dio
    WHERE dio.scheduled_date >= p_from_date
      AND dio.scheduled_date <= p_to_date
      AND dio.status != 'cancelled'
      AND (p_location IS NULL OR dio.location::text = p_location)
    GROUP BY dio.scheduled_date
  )
  SELECT 
    COALESCE(c.pdate, d.pdate) as production_date,
    COALESCE(c.cylinders, 0)::bigint as cylinder_count,
    COALESCE(d.dry_ice, 0)::numeric as dry_ice_kg
  FROM cylinder_data c
  FULL OUTER JOIN dry_ice_data d ON c.pdate = d.pdate
  ORDER BY production_date;
END;
$$;

-- Function to get gas type distribution for a date period
CREATE OR REPLACE FUNCTION public.get_gas_type_distribution_by_period(
  p_from_date date,
  p_to_date date,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  gas_type_id uuid,
  gas_type_name text,
  gas_type_color text,
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
    gt.id as gas_type_id,
    COALESCE(gt.name, 'Onbekend') as gas_type_name,
    COALESCE(gt.color, '#3b82f6') as gas_type_color,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM public.gas_cylinder_orders gco
  LEFT JOIN public.gas_types gt ON gco.gas_type_id = gt.id
  WHERE gco.scheduled_date >= p_from_date
    AND gco.scheduled_date <= p_to_date
    AND gco.status != 'cancelled'
    AND (p_location IS NULL OR gco.location::text = p_location)
  GROUP BY gt.id, gt.name, gt.color
  ORDER BY total_cylinders DESC;
END;
$$;