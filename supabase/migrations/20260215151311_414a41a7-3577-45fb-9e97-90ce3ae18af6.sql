
CREATE OR REPLACE FUNCTION public.get_gas_type_distribution_by_period(p_from_date date, p_to_date date, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
 RETURNS TABLE(gas_type_id uuid, gas_type_name text, gas_type_color text, total_cylinders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    gt.id as gas_type_id,
    COALESCE(gt.name, 'Onbekend') as gas_type_name,
    COALESCE(gt.color, '#3b82f6') as gas_type_color,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM public.gas_cylinder_orders gco
  LEFT JOIN public.gas_types gt ON gco.gas_type_id = gt.id
  WHERE gco.scheduled_date >= p_from_date
    AND gco.scheduled_date <= p_to_date
    AND gco.status != 'cancelled'
    AND (p_location IS NULL OR gco.location::text = p_location)
    AND (NOT p_exclude_digital OR gt.is_digital IS NOT TRUE)
  GROUP BY gt.id, gt.name, gt.color
  ORDER BY total_cylinders DESC;
END;
$function$;
