
CREATE OR REPLACE FUNCTION public.get_customer_segments(p_year integer, p_location text DEFAULT NULL::text)
 RETURNS TABLE(customer_id uuid, customer_name text, total_cylinders bigint, total_dry_ice_kg numeric, order_count bigint, first_order_date date, last_order_date date, avg_order_size numeric, tier text, trend text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  gold_threshold numeric;
  silver_threshold numeric;
BEGIN
  IF NOT (is_admin() OR has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and supervisors can access customer segments';
  END IF;

  SELECT 
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY total) as p90,
    PERCENTILE_CONT(0.7) WITHIN GROUP (ORDER BY total) as p70
  INTO gold_threshold, silver_threshold
  FROM (
    SELECT gco.customer_id, SUM(gco.cylinder_count)::numeric as total
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
      AND gco.scheduled_date <= make_date(p_year, 12, 31)
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.customer_id
  ) sub;

  gold_threshold := COALESCE(gold_threshold, 1000);
  silver_threshold := COALESCE(silver_threshold, 500);

  RETURN QUERY
  WITH current_year AS (
    SELECT 
      gco.customer_id,
      gco.customer_name,
      SUM(gco.cylinder_count)::bigint as cylinders,
      COUNT(*)::bigint as orders,
      MIN(gco.scheduled_date) as first_date,
      MAX(gco.scheduled_date) as last_date
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
      AND gco.scheduled_date <= make_date(p_year, 12, 31)
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.customer_id, gco.customer_name
  ),
  previous_year AS (
    SELECT 
      gco.customer_id,
      SUM(gco.cylinder_count)::bigint as cylinders
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year - 1, 1, 1)
      AND gco.scheduled_date <= make_date(p_year - 1, 12, 31)
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.customer_id
  ),
  dry_ice_totals AS (
    SELECT 
      dio.customer_id,
      SUM(dio.quantity_kg)::numeric as dry_ice
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, 1, 1)
      AND dio.scheduled_date <= make_date(p_year, 12, 31)
      AND dio.status != 'cancelled'
      AND (p_location IS NULL OR dio.location::text = p_location)
    GROUP BY dio.customer_id
  )
  SELECT 
    cy.customer_id,
    cy.customer_name,
    cy.cylinders as total_cylinders,
    COALESCE(di.dry_ice, 0) as total_dry_ice_kg,
    cy.orders as order_count,
    cy.first_date as first_order_date,
    cy.last_date as last_order_date,
    ROUND(cy.cylinders::numeric / NULLIF(cy.orders, 0), 1) as avg_order_size,
    CASE 
      WHEN cy.cylinders >= gold_threshold THEN 'gold'
      WHEN cy.cylinders >= silver_threshold THEN 'silver'
      ELSE 'bronze'
    END as tier,
    CASE 
      WHEN py.cylinders IS NULL THEN 'new'
      WHEN cy.cylinders > py.cylinders * 1.1 THEN 'growing'
      WHEN cy.cylinders < py.cylinders * 0.9 THEN 'declining'
      ELSE 'stable'
    END as trend
  FROM current_year cy
  LEFT JOIN previous_year py ON cy.customer_id = py.customer_id
  LEFT JOIN dry_ice_totals di ON cy.customer_id = di.customer_id
  ORDER BY cy.cylinders DESC;
END;
$function$;
