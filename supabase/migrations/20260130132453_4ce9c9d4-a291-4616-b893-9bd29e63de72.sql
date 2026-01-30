-- Create a function to get monthly order totals for year comparison reports
-- This aggregates data server-side to avoid the 1000 row limit

CREATE OR REPLACE FUNCTION get_monthly_order_totals(p_year integer, p_order_type text)
RETURNS TABLE (
  month integer,
  total_value numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_order_type = 'cylinder' THEN
    RETURN QUERY
    SELECT 
      EXTRACT(MONTH FROM scheduled_date)::integer as month,
      COALESCE(SUM(cylinder_count), 0)::numeric as total_value
    FROM gas_cylinder_orders 
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY EXTRACT(MONTH FROM scheduled_date)
    ORDER BY month;
  ELSIF p_order_type = 'dry_ice' THEN
    RETURN QUERY
    SELECT 
      EXTRACT(MONTH FROM scheduled_date)::integer as month,
      COALESCE(SUM(quantity_kg), 0)::numeric as total_value
    FROM dry_ice_orders 
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY EXTRACT(MONTH FROM scheduled_date)
    ORDER BY month;
  END IF;
END;
$$;