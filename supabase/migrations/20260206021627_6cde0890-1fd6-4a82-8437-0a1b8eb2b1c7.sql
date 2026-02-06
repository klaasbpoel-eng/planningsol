-- Update get_production_efficiency_by_period to allow operators access to their location
CREATE OR REPLACE FUNCTION public.get_production_efficiency_by_period(p_from_date date, p_to_date date, p_location text DEFAULT NULL::text)
 RETURNS TABLE(total_orders bigint, completed_orders bigint, pending_orders bigint, cancelled_orders bigint, efficiency_rate numeric, total_cylinders bigint, completed_cylinders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_location text;
  v_effective_location text;
BEGIN
  -- Admins and supervisors have full access
  IF public.is_admin() OR public.has_role(auth.uid(), 'supervisor') THEN
    v_effective_location := p_location;
  -- Operators are restricted to their own location
  ELSIF public.has_role(auth.uid(), 'operator') THEN
    v_user_location := public.get_user_production_location(auth.uid())::text;
    IF v_user_location IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: No location assigned';
    END IF;
    -- Force the location to operator's own location
    v_effective_location := v_user_location;
  ELSE
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
    COALESCE(SUM(cylinder_count) FILTER (WHERE status != 'cancelled'), 0)::bigint,
    COALESCE(SUM(cylinder_count) FILTER (WHERE status = 'completed'), 0)::bigint
  FROM public.gas_cylinder_orders
  WHERE scheduled_date >= p_from_date
    AND scheduled_date <= p_to_date
    AND (v_effective_location IS NULL OR location::text = v_effective_location);
END;
$function$;

-- Update get_dry_ice_efficiency_by_period to allow operators access to their location
CREATE OR REPLACE FUNCTION public.get_dry_ice_efficiency_by_period(p_from_date date, p_to_date date, p_location text DEFAULT NULL::text)
 RETURNS TABLE(total_orders bigint, completed_orders bigint, pending_orders bigint, cancelled_orders bigint, efficiency_rate numeric, total_kg numeric, completed_kg numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_location text;
  v_effective_location text;
BEGIN
  -- Admins and supervisors have full access
  IF public.is_admin() OR public.has_role(auth.uid(), 'supervisor') THEN
    v_effective_location := p_location;
  -- Operators are restricted to their own location
  ELSIF public.has_role(auth.uid(), 'operator') THEN
    v_user_location := public.get_user_production_location(auth.uid())::text;
    IF v_user_location IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: No location assigned';
    END IF;
    -- Force the location to operator's own location
    v_effective_location := v_user_location;
  ELSE
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
    AND (v_effective_location IS NULL OR location::text = v_effective_location);
END;
$function$;