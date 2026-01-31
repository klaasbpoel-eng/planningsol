CREATE OR REPLACE FUNCTION public.get_yearly_totals_by_customer(p_year integer)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  total_cylinders bigint,
  total_dry_ice_kg numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH cylinder_totals AS (
    SELECT 
      gco.customer_id as cid, 
      gco.customer_name as cname,
      SUM(gco.cylinder_count)::bigint as cylinders
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
      AND gco.scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY gco.customer_id, gco.customer_name
  ),
  dry_ice_totals AS (
    SELECT 
      dio.customer_id as cid, 
      dio.customer_name as cname,
      SUM(dio.quantity_kg)::numeric as dry_ice
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, 1, 1)
      AND dio.scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY dio.customer_id, dio.customer_name
  ),
  combined AS (
    SELECT cid, cname, cylinders, 0::numeric as dry_ice FROM cylinder_totals
    UNION ALL
    SELECT cid, cname, 0::bigint as cylinders, dry_ice FROM dry_ice_totals
  )
  SELECT 
    c.cid,
    c.cname,
    SUM(c.cylinders)::bigint,
    SUM(c.dry_ice)::numeric
  FROM combined c
  GROUP BY c.cid, c.cname
  ORDER BY (SUM(c.cylinders) + SUM(c.dry_ice)) DESC;
END;
$$;