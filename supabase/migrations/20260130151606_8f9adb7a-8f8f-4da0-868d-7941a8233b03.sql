-- Create function to get yearly order totals by customer
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
AS $function$
BEGIN
  RETURN QUERY
  WITH cylinder_totals AS (
    SELECT 
      gco.customer_id,
      gco.customer_name,
      COALESCE(SUM(gco.cylinder_count), 0)::bigint as cylinders
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
      AND gco.scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY gco.customer_id, gco.customer_name
  ),
  dry_ice_totals AS (
    SELECT 
      dio.customer_id,
      dio.customer_name,
      COALESCE(SUM(dio.quantity_kg), 0)::numeric as dry_ice
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, 1, 1)
      AND dio.scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY dio.customer_id, dio.customer_name
  ),
  combined AS (
    SELECT 
      COALESCE(c.customer_id, d.customer_id) as cust_id,
      COALESCE(c.customer_name, d.customer_name) as cust_name,
      COALESCE(c.cylinders, 0) as cyl,
      COALESCE(d.dry_ice, 0) as ice
    FROM cylinder_totals c
    FULL OUTER JOIN dry_ice_totals d 
      ON c.customer_id = d.customer_id OR c.customer_name = d.customer_name
  )
  SELECT 
    combined.cust_id as customer_id,
    combined.cust_name as customer_name,
    combined.cyl as total_cylinders,
    combined.ice as total_dry_ice_kg
  FROM combined
  ORDER BY (combined.cyl + combined.ice) DESC;
END;
$function$;