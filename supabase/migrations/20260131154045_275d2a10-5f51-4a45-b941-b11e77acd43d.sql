-- Update bulk delete function to handle large datasets in batches to avoid statement timeout
CREATE OR REPLACE FUNCTION public.bulk_delete_orders_by_year(
  p_year integer,
  p_order_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '5min'
AS $$
DECLARE
  deleted_count integer := 0;
  batch_count integer;
  batch_size integer := 10000;
BEGIN
  -- Controleer of gebruiker admin is
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Alleen admins kunnen bulk operaties uitvoeren';
  END IF;

  IF p_order_type = 'cylinder' THEN
    -- Delete in batches to avoid statement timeout
    LOOP
      DELETE FROM gas_cylinder_orders 
      WHERE id IN (
        SELECT id FROM gas_cylinder_orders
        WHERE scheduled_date >= make_date(p_year, 1, 1)
          AND scheduled_date <= make_date(p_year, 12, 31)
        LIMIT batch_size
      );
      GET DIAGNOSTICS batch_count = ROW_COUNT;
      deleted_count := deleted_count + batch_count;
      EXIT WHEN batch_count = 0;
    END LOOP;
  ELSIF p_order_type = 'dry_ice' THEN
    -- Delete in batches to avoid statement timeout
    LOOP
      DELETE FROM dry_ice_orders 
      WHERE id IN (
        SELECT id FROM dry_ice_orders
        WHERE scheduled_date >= make_date(p_year, 1, 1)
          AND scheduled_date <= make_date(p_year, 12, 31)
        LIMIT batch_size
      );
      GET DIAGNOSTICS batch_count = ROW_COUNT;
      deleted_count := deleted_count + batch_count;
      EXIT WHEN batch_count = 0;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Ongeldig order type: %', p_order_type;
  END IF;

  RETURN deleted_count;
END;
$$;