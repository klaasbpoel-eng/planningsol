
CREATE OR REPLACE FUNCTION public.get_customer_segments(p_year integer, p_location text DEFAULT NULL::text, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date)
 RETURNS TABLE(customer_id uuid, customer_name text, total_cylinders bigint, total_dry_ice_kg numeric, order_count bigint, first_order_date date, last_order_date date, avg_order_size numeric, tier text, trend text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  gold_threshold numeric;
  silver_threshold numeric;
  v_from_date date;
  v_to_date date;
  v_prev_from_date date;
  v_prev_to_date date;
BEGIN
  IF NOT (is_admin() OR has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and supervisors can access customer segments';
  END IF;

  -- Use date range if provided, otherwise fall back to full year
  v_from_date := COALESCE(p_from_date, make_date(p_year, 1, 1));
  v_to_date := COALESCE(p_to_date, make_date(p_year, 12, 31));
  
  -- Calculate equivalent previous period for trend analysis
  v_prev_from_date := v_from_date - (v_to_date - v_from_date + 1);
  v_prev_to_date := v_from_date - 1;

  SELECT 
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY total) as p90,
    PERCENTILE_CONT(0.7) WITHIN GROUP (ORDER BY total) as p70
  INTO gold_threshold, silver_threshold
  FROM (
    SELECT gco.customer_id, SUM(gco.cylinder_count)::numeric as total
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= v_from_date
      AND gco.scheduled_date <= v_to_date
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.customer_id
  ) sub;

  gold_threshold := COALESCE(gold_threshold, 1000);
  silver_threshold := COALESCE(silver_threshold, 500);

  RETURN QUERY
  WITH current_period AS (
    SELECT 
      gco.customer_id,
      gco.customer_name,
      SUM(gco.cylinder_count)::bigint as cylinders,
      COUNT(*)::bigint as orders,
      MIN(gco.scheduled_date) as first_date,
      MAX(gco.scheduled_date) as last_date
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= v_from_date
      AND gco.scheduled_date <= v_to_date
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.customer_id, gco.customer_name
  ),
  previous_period AS (
    SELECT 
      gco.customer_id,
      SUM(gco.cylinder_count)::bigint as cylinders
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= v_prev_from_date
      AND gco.scheduled_date <= v_prev_to_date
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.customer_id
  ),
  dry_ice_totals AS (
    SELECT 
      dio.customer_id,
      SUM(dio.quantity_kg)::numeric as dry_ice
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= v_from_date
      AND dio.scheduled_date <= v_to_date
      AND dio.status != 'cancelled'
      AND (p_location IS NULL OR dio.location::text = p_location)
    GROUP BY dio.customer_id
  )
  SELECT 
    cp.customer_id,
    cp.customer_name,
    cp.cylinders as total_cylinders,
    COALESCE(di.dry_ice, 0) as total_dry_ice_kg,
    cp.orders as order_count,
    cp.first_date as first_order_date,
    cp.last_date as last_order_date,
    ROUND(cp.cylinders::numeric / NULLIF(cp.orders, 0), 1) as avg_order_size,
    CASE 
      WHEN cp.cylinders >= gold_threshold THEN 'gold'
      WHEN cp.cylinders >= silver_threshold THEN 'silver'
      ELSE 'bronze'
    END as tier,
    CASE 
      WHEN pp.cylinders IS NULL THEN 'new'
      WHEN cp.cylinders > pp.cylinders * 1.1 THEN 'growing'
      WHEN cp.cylinders < pp.cylinders * 0.9 THEN 'declining'
      ELSE 'stable'
    END as trend
  FROM current_period cp
  LEFT JOIN previous_period pp ON cp.customer_id = pp.customer_id
  LEFT JOIN dry_ice_totals di ON cp.customer_id = di.customer_id
  ORDER BY cp.cylinders DESC;
END;
$function$;
