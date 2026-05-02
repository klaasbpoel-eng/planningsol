CREATE OR REPLACE FUNCTION public.debug_productie_monthly_2026()
RETURNS TABLE (maand int, locatie text, records bigint, cilinders numeric)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    EXTRACT(MONTH FROM ("Datum" #>> '{}')::timestamptz)::int AS maand,
    "Locatie"::text AS locatie,
    COUNT(*) AS records,
    SUM("Aantal"::numeric) AS cilinders
  FROM "Productie"
  WHERE "Jaar" = 2026
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.debug_productie_monthly_2026() TO authenticated, anon;
