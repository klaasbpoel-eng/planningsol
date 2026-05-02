-- Simulates JavaScript's getRowMonth: raw.includes("T") ? raw.substring(0,10) : raw → parseInt(iso.substring(5,7))
CREATE OR REPLACE FUNCTION public.debug_productie_monthly_js()
RETURNS TABLE (maand_js int, locatie text, records bigint, cilinders numeric)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    -- Exact same logic as JS getRowMonth
    CASE
      WHEN ("Datum" #>> '{}') LIKE '%T%'
        THEN CAST(SUBSTRING(("Datum" #>> '{}') FROM 6 FOR 2) AS int)
      ELSE
        CAST(SUBSTRING(("Datum" #>> '{}') FROM 6 FOR 2) AS int)
    END AS maand_js,
    "Locatie"::text AS locatie,
    COUNT(*) AS records,
    SUM("Aantal"::numeric) AS cilinders
  FROM "Productie"
  WHERE "Jaar" = 2026
    AND ("Datum" #>> '{}') IS NOT NULL
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.debug_productie_monthly_js() TO authenticated, anon;
