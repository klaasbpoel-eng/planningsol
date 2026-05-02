CREATE OR REPLACE FUNCTION public.debug_productie_locaties()
RETURNS TABLE (locatie text, jaar numeric, count bigint, sum_aantal numeric)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    "Locatie"::text AS locatie,
    "Jaar"::numeric AS jaar,
    COUNT(*) AS count,
    SUM("Aantal"::numeric) AS sum_aantal
  FROM "Productie"
  WHERE "Jaar" = 2026
  GROUP BY "Locatie", "Jaar"
  ORDER BY sum_aantal DESC;
$$;

GRANT EXECUTE ON FUNCTION public.debug_productie_locaties() TO authenticated, anon;
