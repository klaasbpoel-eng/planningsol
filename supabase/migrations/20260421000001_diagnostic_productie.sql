CREATE OR REPLACE FUNCTION public.debug_productie_recent()
RETURNS TABLE (datum_raw text, jaar_raw text, locatie text, aantal numeric)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    "Datum"::text AS datum_raw,
    "Jaar"::text AS jaar_raw,
    "Locatie"::text AS locatie,
    "Aantal"::numeric AS aantal
  FROM "Productie"
  ORDER BY "id" DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.debug_productie_recent() TO authenticated, anon;
