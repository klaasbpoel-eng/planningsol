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
  WITH all_customers AS (
    SELECT DISTINCT gco.customer_id as cid, gco.customer_name as cname
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
      AND gco.scheduled_date <= make_date(p_year, 12, 31)
    UNION
    SELECT DISTINCT dio.customer_id as cid, dio.customer_name as cname
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, 1, 1)
      AND dio.scheduled_date <= make_date(p_year, 12, 31)
  ),
  cylinder_totals AS (
    SELECT gco.customer_id as cid, gco.customer_name as cname,
      COALESCE(SUM(gco.cylinder_count), 0)::bigint as cylinders
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
      AND gco.scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY gco.customer_id, gco.customer_name
  ),
  dry_ice_totals AS (
    SELECT dio.customer_id as cid, dio.customer_name as cname,
      COALESCE(SUM(dio.quantity_kg), 0)::numeric as dry_ice
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, 1, 1)
      AND dio.scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY dio.customer_id, dio.customer_name
  )
  SELECT 
    ac.cid,
    ac.cname,
    COALESCE(ct.cylinders, 0)::bigint,
    COALESCE(dt.dry_ice, 0)::numeric
  FROM all_customers ac
  LEFT JOIN cylinder_totals ct ON ac.cid = ct.cid AND ac.cname = ct.cname
  LEFT JOIN dry_ice_totals dt ON ac.cid = dt.cid AND ac.cname = dt.cname
  ORDER BY (COALESCE(ct.cylinders, 0) + COALESCE(dt.dry_ice, 0)) DESC;
END;
$$;