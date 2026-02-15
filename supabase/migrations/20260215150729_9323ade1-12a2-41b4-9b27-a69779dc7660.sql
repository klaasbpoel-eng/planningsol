
CREATE OR REPLACE FUNCTION public.get_production_efficiency_by_period(p_from_date date, p_to_date date, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
 RETURNS TABLE(total_orders bigint, completed_orders bigint, pending_orders bigint, cancelled_orders bigint, efficiency_rate numeric, total_cylinders bigint, completed_cylinders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_location text;
  v_effective_location text;
BEGIN
  IF public.is_admin() OR public.has_role(auth.uid(), 'supervisor') THEN
    v_effective_location := p_location;
  ELSIF public.has_role(auth.uid(), 'operator') THEN
    v_user_location := public.get_user_production_location(auth.uid())::text;
    IF v_user_location IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: No location assigned';
    END IF;
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
  FROM public.gas_cylinder_orders gco
  WHERE gco.scheduled_date >= p_from_date
    AND gco.scheduled_date <= p_to_date
    AND (v_effective_location IS NULL OR gco.location::text = v_effective_location)
    AND (NOT p_exclude_digital OR NOT EXISTS (
      SELECT 1 FROM public.gas_types gt 
      WHERE gt.id = gco.gas_type_id AND gt.is_digital = true
    ));
END;
$function$;
