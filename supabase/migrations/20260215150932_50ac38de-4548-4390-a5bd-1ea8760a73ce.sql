
CREATE OR REPLACE FUNCTION public.get_production_efficiency(p_year integer, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
 RETURNS TABLE(total_orders bigint, completed_orders bigint, pending_orders bigint, cancelled_orders bigint, efficiency_rate numeric, total_cylinders bigint, completed_cylinders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_admin() OR has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and supervisors can access production efficiency data';
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
    COALESCE(SUM(cylinder_count) FILTER (WHERE status != 'cancelled'), 0)::bigint as total_cylinders,
    COALESCE(SUM(cylinder_count) FILTER (WHERE status = 'completed'), 0)::bigint as completed_cylinders
  FROM gas_cylinder_orders gco
  WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
    AND gco.scheduled_date <= make_date(p_year, 12, 31)
    AND (p_location IS NULL OR gco.location::text = p_location)
    AND (NOT p_exclude_digital OR NOT EXISTS (
      SELECT 1 FROM gas_types gt 
      WHERE gt.id = gco.gas_type_id AND gt.is_digital = true
    ));
END;
$function$;
