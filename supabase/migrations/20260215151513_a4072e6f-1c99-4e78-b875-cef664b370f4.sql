
-- 1. get_monthly_order_totals
CREATE OR REPLACE FUNCTION public.get_monthly_order_totals(p_year integer, p_order_type text, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
 RETURNS TABLE(month integer, total_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_admin() OR has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and supervisors can access order totals';
  END IF;

  IF p_order_type = 'cylinder' THEN
    RETURN QUERY
    SELECT 
      EXTRACT(MONTH FROM scheduled_date)::integer as month,
      COALESCE(SUM(cylinder_count), 0)::numeric as total_value
    FROM gas_cylinder_orders gco
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
      AND (p_location IS NULL OR location::text = p_location)
      AND (NOT p_exclude_digital OR NOT EXISTS (
        SELECT 1 FROM gas_types gt WHERE gt.id = gco.gas_type_id AND gt.is_digital = true
      ))
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
      AND (p_location IS NULL OR location::text = p_location)
    GROUP BY EXTRACT(MONTH FROM scheduled_date)
    ORDER BY month;
  END IF;
END;
$function$;

-- 2. get_gas_category_distribution_by_period
CREATE OR REPLACE FUNCTION public.get_gas_category_distribution_by_period(p_from_date date, p_to_date date, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
 RETURNS TABLE(category_id uuid, category_name text, total_cylinders bigint)
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
    gtc.id as category_id,
    COALESCE(gtc.name, 'Geen categorie') as category_name,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM public.gas_cylinder_orders gco
  LEFT JOIN public.gas_types gt ON gco.gas_type_id = gt.id
  LEFT JOIN public.gas_type_categories gtc ON gt.category_id = gtc.id
  WHERE gco.scheduled_date >= p_from_date
    AND gco.scheduled_date <= p_to_date
    AND gco.status != 'cancelled'
    AND (p_location IS NULL OR gco.location::text = p_location)
    AND (NOT p_exclude_digital OR gt.is_digital IS NOT TRUE)
  GROUP BY gtc.id, gtc.name
  ORDER BY total_cylinders DESC;
END;
$function$;

-- 3. get_monthly_cylinder_totals_by_gas_type
CREATE OR REPLACE FUNCTION public.get_monthly_cylinder_totals_by_gas_type(p_year integer, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
 RETURNS TABLE(month integer, gas_type_id uuid, gas_type_name text, gas_type_color text, total_cylinders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_admin() OR has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and supervisors can access gas type totals';
  END IF;

  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM gco.scheduled_date)::integer as month,
    gt.id as gas_type_id,
    gt.name as gas_type_name,
    gt.color as gas_type_color,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM gas_cylinder_orders gco
  LEFT JOIN gas_types gt ON gco.gas_type_id = gt.id
  WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
    AND gco.scheduled_date <= make_date(p_year, 12, 31)
    AND (p_location IS NULL OR gco.location::text = p_location)
    AND (NOT p_exclude_digital OR gt.is_digital IS NOT TRUE)
  GROUP BY EXTRACT(MONTH FROM gco.scheduled_date), gt.id, gt.name, gt.color
  ORDER BY month, gas_type_name;
END;
$function$;

-- 4. get_monthly_cylinder_totals_by_size
CREATE OR REPLACE FUNCTION public.get_monthly_cylinder_totals_by_size(p_year integer, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
 RETURNS TABLE(month integer, cylinder_size text, total_cylinders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_admin() OR has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and supervisors can access cylinder size totals';
  END IF;

  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM gco.scheduled_date)::integer as month,
    gco.cylinder_size,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM gas_cylinder_orders gco
  WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
    AND gco.scheduled_date <= make_date(p_year, 12, 31)
    AND (p_location IS NULL OR gco.location::text = p_location)
    AND (NOT p_exclude_digital OR NOT EXISTS (
      SELECT 1 FROM gas_types gt WHERE gt.id = gco.gas_type_id AND gt.is_digital = true
    ))
  GROUP BY EXTRACT(MONTH FROM gco.scheduled_date), gco.cylinder_size
  ORDER BY month, cylinder_size;
END;
$function$;

-- 5. get_monthly_cylinder_totals_by_customer
CREATE OR REPLACE FUNCTION public.get_monthly_cylinder_totals_by_customer(p_year integer, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
 RETURNS TABLE(month integer, customer_id uuid, customer_name text, total_cylinders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_admin() OR has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and supervisors can access customer cylinder totals';
  END IF;

  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM gco.scheduled_date)::integer as month,
    gco.customer_id,
    gco.customer_name,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM gas_cylinder_orders gco
  WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
    AND gco.scheduled_date <= make_date(p_year, 12, 31)
    AND (p_location IS NULL OR gco.location::text = p_location)
    AND (NOT p_exclude_digital OR NOT EXISTS (
      SELECT 1 FROM gas_types gt WHERE gt.id = gco.gas_type_id AND gt.is_digital = true
    ))
  GROUP BY EXTRACT(MONTH FROM gco.scheduled_date), gco.customer_id, gco.customer_name
  ORDER BY month, total_cylinders DESC;
END;
$function$;

-- 6. get_daily_production_totals
CREATE OR REPLACE FUNCTION public.get_daily_production_totals(p_year integer, p_month integer DEFAULT NULL::integer, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
 RETURNS TABLE(production_date date, cylinder_count bigint, dry_ice_kg numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_admin() OR has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and supervisors can access daily production totals';
  END IF;

  RETURN QUERY
  WITH cylinder_data AS (
    SELECT 
      gco.scheduled_date as pdate,
      COALESCE(SUM(gco.cylinder_count), 0)::bigint as cylinders
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, COALESCE(p_month, 1), 1)
      AND gco.scheduled_date <= CASE 
        WHEN p_month IS NOT NULL THEN (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
        ELSE make_date(p_year, 12, 31)
      END
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
      AND (NOT p_exclude_digital OR NOT EXISTS (
        SELECT 1 FROM gas_types gt WHERE gt.id = gco.gas_type_id AND gt.is_digital = true
      ))
    GROUP BY gco.scheduled_date
  ),
  dry_ice_data AS (
    SELECT 
      dio.scheduled_date as pdate,
      COALESCE(SUM(dio.quantity_kg), 0)::numeric as dry_ice
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, COALESCE(p_month, 1), 1)
      AND dio.scheduled_date <= CASE 
        WHEN p_month IS NOT NULL THEN (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
        ELSE make_date(p_year, 12, 31)
      END
      AND dio.status != 'cancelled'
      AND (p_location IS NULL OR dio.location::text = p_location)
    GROUP BY dio.scheduled_date
  )
  SELECT 
    COALESCE(c.pdate, d.pdate) as production_date,
    COALESCE(c.cylinders, 0)::bigint as cylinder_count,
    COALESCE(d.dry_ice, 0)::numeric as dry_ice_kg
  FROM cylinder_data c
  FULL OUTER JOIN dry_ice_data d ON c.pdate = d.pdate
  ORDER BY production_date;
END;
$function$;

-- 7. get_yearly_totals_by_customer
CREATE OR REPLACE FUNCTION public.get_yearly_totals_by_customer(p_year integer, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
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
      AND (NOT p_exclude_digital OR NOT EXISTS (
        SELECT 1 FROM gas_types gt WHERE gt.id = gco.gas_type_id AND gt.is_digital = true
      ))
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

-- 8. get_customer_totals_by_period
CREATE OR REPLACE FUNCTION public.get_customer_totals_by_period(p_from_date date, p_to_date date, p_location text DEFAULT NULL::text, p_exclude_digital boolean DEFAULT false)
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
      (array_agg(gco.customer_id))[1] as cid,
      gco.customer_name as cname,
      COALESCE(SUM(gco.cylinder_count), 0)::bigint as cylinders
    FROM public.gas_cylinder_orders gco
    WHERE gco.scheduled_date >= p_from_date
      AND gco.scheduled_date <= p_to_date
      AND gco.status != 'cancelled'
      AND (p_location IS NULL OR gco.location::text = p_location)
      AND (NOT p_exclude_digital OR NOT EXISTS (
        SELECT 1 FROM public.gas_types gt WHERE gt.id = gco.gas_type_id AND gt.is_digital = true
      ))
    GROUP BY gco.customer_name
  ),
  dry_ice_totals AS (
    SELECT 
      (array_agg(dio.customer_id))[1] as cid,
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
