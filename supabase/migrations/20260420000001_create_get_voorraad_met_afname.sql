CREATE OR REPLACE FUNCTION public.get_voorraad_met_afname()
RETURNS TABLE (
  sub_code text,
  omschrijving text,
  locatie text,
  voorraad numeric,
  voorraad_leeg numeric,
  afname numeric,
  verschil numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH voorraad_agg AS (
    SELECT
      COALESCE(v."ContentType", v."Product") AS sub_code,
      v."Product" AS omschrijving,
      CASE WHEN lower(COALESCE(v."Locatie", '')) LIKE '%emmen%' THEN 'emmen' ELSE 'tilburg' END AS locatie,
      SUM(CASE WHEN lower(COALESCE(v."Product", '')) NOT LIKE '%leeg%' THEN COALESCE(v."Aantal"::numeric, 0) ELSE 0 END) AS voorraad,
      SUM(CASE WHEN lower(COALESCE(v."Product", '')) LIKE '%leeg%' THEN COALESCE(v."Aantal"::numeric, 0) ELSE 0 END) AS voorraad_leeg
    FROM "Voorraad" v
    WHERE v."Product" IS NOT NULL AND v."Product" != ''
    GROUP BY
      COALESCE(v."ContentType", v."Product"),
      v."Product",
      CASE WHEN lower(COALESCE(v."Locatie", '')) LIKE '%emmen%' THEN 'emmen' ELSE 'tilburg' END
  ),
  afname_agg AS (
    SELECT
      a."Product" AS description,
      CASE WHEN lower(COALESCE(a."Locatie", '')) LIKE '%emmen%' THEN 'emmen' ELSE 'tilburg' END AS locatie,
      SUM(COALESCE(a."Aantal"::numeric, 0)) AS afname_total
    FROM "Afname" a
    WHERE a."Product" IS NOT NULL
      AND lower(COALESCE(a."Product", '')) NOT LIKE '%leeg%'
    GROUP BY
      a."Product",
      CASE WHEN lower(COALESCE(a."Locatie", '')) LIKE '%emmen%' THEN 'emmen' ELSE 'tilburg' END
  )
  SELECT
    v.sub_code,
    v.omschrijving,
    v.locatie,
    v.voorraad,
    v.voorraad_leeg,
    COALESCE(a.afname_total, 0) AS afname,
    v.voorraad - COALESCE(a.afname_total, 0) AS verschil
  FROM voorraad_agg v
  LEFT JOIN afname_agg a
    ON v.omschrijving = a.description AND v.locatie = a.locatie
  ORDER BY v.sub_code, v.locatie;
$$;

GRANT EXECUTE ON FUNCTION public.get_voorraad_met_afname() TO authenticated, anon;
