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
    -- Verzamel alle unieke klanten via UNION (geen OR in JOIN)
    SELECT DISTINCT customer_id as cid, customer_name as cname
    FROM gas_cylinder_orders
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
    UNION
    SELECT DISTINCT customer_id as cid, customer_name as cname
    FROM dry_ice_orders
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
  ),
  cylinder_totals AS (
    SELECT customer_id as cid, customer_name as cname,
      COALESCE(SUM(cylinder_count), 0)::bigint as cylinders
    FROM gas_cylinder_orders
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY customer_id, customer_name
  ),
  dry_ice_totals AS (
    SELECT customer_id as cid, customer_name as cname,
      COALESCE(SUM(quantity_kg), 0)::numeric as dry_ice
    FROM dry_ice_orders
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY customer_id, customer_name
  )
  SELECT 
    ac.cid as customer_id,
    ac.cname as customer_name,
    COALESCE(ct.cylinders, 0)::bigint as total_cylinders,
    COALESCE(dt.dry_ice, 0)::numeric as total_dry_ice_kg
  FROM all_customers ac
  LEFT JOIN cylinder_totals ct ON ac.cid = ct.cid AND ac.cname = ct.cname
  LEFT JOIN dry_ice_totals dt ON ac.cid = dt.cid AND ac.cname = dt.cname
  ORDER BY (COALESCE(ct.cylinders, 0) + COALESCE(dt.dry_ice, 0)) DESC;
END;
$$;