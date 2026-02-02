-- Database function to calculate production efficiency metrics
CREATE OR REPLACE FUNCTION public.get_production_efficiency(
  p_year integer,
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
SET search_path TO 'public'
AS $$
BEGIN
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
    COALESCE(SUM(cylinder_count) FILTER (WHERE status != 'cancelled'), 0)::bigint as total_cylinders,
    COALESCE(SUM(cylinder_count) FILTER (WHERE status = 'completed'), 0)::bigint as completed_cylinders
  FROM gas_cylinder_orders
  WHERE scheduled_date >= make_date(p_year, 1, 1)
    AND scheduled_date <= make_date(p_year, 12, 31)
    AND (p_location IS NULL OR location::text = p_location);
END;
$$;

-- Database function to get daily production totals for heat map
CREATE OR REPLACE FUNCTION public.get_daily_production_totals(
  p_year integer,
  p_month integer DEFAULT NULL,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  production_date date,
  cylinder_count bigint,
  dry_ice_kg numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH cylinder_data AS (
    SELECT 
      gco.scheduled_date as pdate,
      COALESCE(SUM(gco.cylinder_count), 0)::bigint as cylinders
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, COALESCE(p_month, 1), 1)
      AND gco.scheduled_date <= CASE 
        WHEN p_month IS NOT NULL THEN (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
        ELSE make_date(p_year, 12, 31)
      END
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.scheduled_date
  ),
  dry_ice_data AS (
    SELECT 
      dio.scheduled_date as pdate,
      COALESCE(SUM(dio.quantity_kg), 0)::numeric as dry_ice
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, COALESCE(p_month, 1), 1)
      AND dio.scheduled_date <= CASE 
        WHEN p_month IS NOT NULL THEN (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
        ELSE make_date(p_year, 12, 31)
      END
      AND dio.status != 'cancelled'
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

-- Database function for customer segmentation
CREATE OR REPLACE FUNCTION public.get_customer_segments(
  p_year integer,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  total_cylinders bigint,
  total_dry_ice_kg numeric,
  order_count bigint,
  first_order_date date,
  last_order_date date,
  avg_order_size numeric,
  tier text,
  trend text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  gold_threshold numeric;
  silver_threshold numeric;
BEGIN
  -- Calculate thresholds based on top percentiles
  SELECT 
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY total) as p90,
    PERCENTILE_CONT(0.7) WITHIN GROUP (ORDER BY total) as p70
  INTO gold_threshold, silver_threshold
  FROM (
    SELECT customer_id, SUM(cylinder_count)::numeric as total
    FROM gas_cylinder_orders
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
      AND status != 'cancelled'
      AND (p_location IS NULL OR location::text = p_location)
    GROUP BY customer_id
  ) sub;

  -- Use defaults if no data
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
$$;