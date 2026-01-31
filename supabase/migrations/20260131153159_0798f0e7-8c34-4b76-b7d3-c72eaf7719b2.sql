-- Create bulk delete RPC function for fast order deletion
CREATE OR REPLACE FUNCTION public.bulk_delete_orders_by_year(
  p_year integer,
  p_order_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Controleer of gebruiker admin is
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Alleen admins kunnen bulk operaties uitvoeren';
  END IF;

  IF p_order_type = 'cylinder' THEN
    DELETE FROM gas_cylinder_orders 
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
  ELSIF p_order_type = 'dry_ice' THEN
    DELETE FROM dry_ice_orders 
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Ongeldig order type: %', p_order_type;
  END IF;

  RETURN deleted_count;
END;
$$;