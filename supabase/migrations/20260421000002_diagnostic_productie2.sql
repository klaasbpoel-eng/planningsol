CREATE OR REPLACE FUNCTION public.debug_productie_stats()
RETURNS TABLE (jaar text, count bigint, max_datum text, min_datum text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    "Jaar"::text AS jaar,
    COUNT(*) AS count,
    MAX(("Datum" #>> '{}'))::text AS max_datum,
    MIN(("Datum" #>> '{}'))::text AS min_datum
  FROM "Productie"
  GROUP BY "Jaar"
  ORDER BY "Jaar" DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.debug_productie_stats() TO authenticated, anon;
