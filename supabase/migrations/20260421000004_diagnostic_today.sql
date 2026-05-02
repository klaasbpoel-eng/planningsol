CREATE OR REPLACE FUNCTION public.debug_productie_today()
RETURNS TABLE (datum_iso text, locatie text, product text, aantal numeric, count_today bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    ("Datum" #>> '{}')::text AS datum_iso,
    "Locatie"::text AS locatie,
    "Product"::text AS product,
    "Aantal"::numeric AS aantal,
    COUNT(*) OVER () AS count_today
  FROM "Productie"
  WHERE "Jaar" = 2026
    AND ("Datum" #>> '{}') >= '2026-04-20'
    AND ("Datum" #>> '{}') <= '2026-04-21T23:59:59Z'
  ORDER BY ("Datum" #>> '{}') DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.debug_productie_today() TO authenticated, anon;
