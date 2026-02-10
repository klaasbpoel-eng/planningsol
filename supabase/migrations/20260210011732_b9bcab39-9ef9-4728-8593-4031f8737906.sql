
CREATE OR REPLACE FUNCTION public.get_customer_totals_by_period(p_from_date date, p_to_date date, p_location text DEFAULT NULL::text)
 RETURNS TABLE(customer_id uuid, customer_name text, total_cylinders bigint, total_dry_ice_kg numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH cylinder_totals AS (
    SELECT 
      MAX(gco.customer_id) as cid,
      gco.customer_name as cname,
      COALESCE(SUM(gco.cylinder_count), 0)::bigint as cylinders
    FROM public.gas_cylinder_orders gco
    WHERE gco.scheduled_date >= p_from_date
      AND gco.scheduled_date <= p_to_date
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.customer_name
  ),
  dry_ice_totals AS (
    SELECT 
      MAX(dio.customer_id) as cid,
      dio.customer_name as cname,
      COALESCE(SUM(dio.quantity_kg), 0)::numeric as dry_ice
    FROM public.dry_ice_orders dio
    WHERE dio.scheduled_date >= p_from_date
      AND dio.scheduled_date <= p_to_date
      AND dio.status != 'cancelled'
      AND (p_location IS NULL OR dio.location::text = p_location)
    GROUP BY dio.customer_name
  )
  SELECT 
    COALESCE(c.cid, d.cid) as customer_id,
    COALESCE(c.cname, d.cname) as customer_name,
    COALESCE(c.cylinders, 0)::bigint as total_cylinders,
    COALESCE(d.dry_ice, 0)::numeric as total_dry_ice_kg
  FROM cylinder_totals c
  FULL OUTER JOIN dry_ice_totals d ON c.cname = d.cname
  ORDER BY COALESCE(c.cylinders, 0) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_yearly_totals_by_customer(p_year integer, p_location text DEFAULT NULL::text)
 RETURNS TABLE(customer_id uuid, customer_name text, total_cylinders bigint, total_dry_ice_kg numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_admin() OR has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and supervisors can access customer totals';
  END IF;

  RETURN QUERY
  WITH cylinder_totals AS (
    SELECT 
      MAX(gco.customer_id) as cid,
      gco.customer_name as cname,
      SUM(gco.cylinder_count)::bigint as cylinders
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
      AND gco.scheduled_date <= make_date(p_year, 12, 31)
      AND (p_location IS NULL OR gco.location::text = p_location)
    GROUP BY gco.customer_name
  ),
  dry_ice_totals AS (
    SELECT 
      MAX(dio.customer_id) as cid,
      dio.customer_name as cname,
      SUM(dio.quantity_kg)::numeric as dry_ice
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, 1, 1)
      AND dio.scheduled_date <= make_date(p_year, 12, 31)
      AND (p_location IS NULL OR dio.location::text = p_location)
    GROUP BY dio.customer_name
  ),
  combined AS (
    SELECT cid, cname, cylinders, 0::numeric as dry_ice FROM cylinder_totals
    UNION ALL
    SELECT cid, cname, 0::bigint as cylinders, dry_ice FROM dry_ice_totals
  )
  SELECT 
    MAX(c.cid),
    c.cname,
    SUM(c.cylinders)::bigint,
    SUM(c.dry_ice)::numeric
  FROM combined c
  GROUP BY c.cname
  ORDER BY (SUM(c.cylinders) + SUM(c.dry_ice)) DESC;
END;
$function$;
