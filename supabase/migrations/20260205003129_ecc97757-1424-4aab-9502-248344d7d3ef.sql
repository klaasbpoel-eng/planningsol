-- Create function to get production efficiency by date period
CREATE OR REPLACE FUNCTION public.get_production_efficiency_by_period(
  p_from_date date,
  p_to_date date,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  total_orders bigint,
  completed_orders bigint,
  pending_orders bigint,
  cancelled_orders bigint,
  efficiency_rate numeric,
  total_cylinders bigint,
  completed_cylinders bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_orders,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_orders,
    COUNT(*) FILTER (WHERE status = 'cancelled')::bigint as cancelled_orders,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status != 'cancelled') = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::numeric * 100 / 
        NULLIF(COUNT(*) FILTER (WHERE status != 'cancelled'), 0), 1
      )
    END as efficiency_rate,
    COALESCE(SUM(cylinder_count) FILTER (WHERE status != 'cancelled'), 0)::bigint,
    COALESCE(SUM(cylinder_count) FILTER (WHERE status = 'completed'), 0)::bigint
  FROM public.gas_cylinder_orders
  WHERE scheduled_date >= p_from_date
    AND scheduled_date <= p_to_date
    AND (p_location IS NULL OR location::text = p_location);
END;
$$;

-- Create function to get customer totals by date period
CREATE OR REPLACE FUNCTION public.get_customer_totals_by_period(
  p_from_date date,
  p_to_date date,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  total_cylinders bigint,
  total_dry_ice_kg numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH cylinder_totals AS (
    SELECT 
      gco.customer_id as cid, 
      gco.customer_name as cname,
      COALESCE(SUM(gco.cylinder_count), 0)::bigint as cylinders
    FROM public.gas_cylinder_orders gco
    WHERE gco.scheduled_date >= p_from_date
      AND gco.scheduled_date <= p_to_date
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.customer_id, gco.customer_name
  ),
  dry_ice_totals AS (
    SELECT 
      dio.customer_id as cid, 
      dio.customer_name as cname,
      COALESCE(SUM(dio.quantity_kg), 0)::numeric as dry_ice
    FROM public.dry_ice_orders dio
    WHERE dio.scheduled_date >= p_from_date
      AND dio.scheduled_date <= p_to_date
      AND dio.status != 'cancelled'
      AND (p_location IS NULL OR dio.location::text = p_location)
    GROUP BY dio.customer_id, dio.customer_name
  )
  SELECT 
    COALESCE(c.cid, d.cid) as customer_id,
    COALESCE(c.cname, d.cname) as customer_name,
    COALESCE(c.cylinders, 0)::bigint as total_cylinders,
    COALESCE(d.dry_ice, 0)::numeric as total_dry_ice_kg
  FROM cylinder_totals c
  FULL OUTER JOIN dry_ice_totals d ON c.cid = d.cid
  ORDER BY COALESCE(c.cylinders, 0) DESC;
END;
$$;