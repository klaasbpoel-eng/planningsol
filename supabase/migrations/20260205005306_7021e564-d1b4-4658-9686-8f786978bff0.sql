-- Create RPC function for dry ice efficiency by period
-- Similar to get_production_efficiency_by_period but for dry ice orders
CREATE OR REPLACE FUNCTION public.get_dry_ice_efficiency_by_period(
  p_from_date date,
  p_to_date date,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  total_orders bigint,
  completed_orders bigint,
  pending_orders bigint,
  cancelled_orders bigint,
  efficiency_rate numeric,
  total_kg numeric,
  completed_kg numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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
    COALESCE(SUM(quantity_kg) FILTER (WHERE status != 'cancelled'), 0)::numeric as total_kg,
    COALESCE(SUM(quantity_kg) FILTER (WHERE status = 'completed'), 0)::numeric as completed_kg
  FROM public.dry_ice_orders
  WHERE scheduled_date >= p_from_date
    AND scheduled_date <= p_to_date
    AND (p_location IS NULL OR location::text = p_location);
END;
$$;