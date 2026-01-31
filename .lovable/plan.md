
# Plan: Fix Top 5 Klanten Widget

## Probleem Geidentificeerd

De "Top 5 Klanten" widget toont "Geen klantdata beschikbaar" omdat de database functie `get_yearly_totals_by_customer` een fout geeft.

**Foutmelding**: `column reference "customer_id" is ambiguous - It could refer to either a PL/pgSQL variable or a table column`

**Oorzaak**: In PostgreSQL PL/pgSQL functies, wanneer je `RETURNS TABLE(customer_id uuid, customer_name text, ...)` definieert, worden deze kolomnamen ook als variabelen aangemaakt binnen de functie. Wanneer je dan `SELECT customer_id` schrijft in een query binnen de functie, weet PostgreSQL niet of je de tabelkolom of de functievariabele bedoelt.

## Oplossing

De database functie moet worden aangepast zodat alle verwijzingen naar tabelkolommen expliciet de tabelnaam of alias gebruiken.

### Database Migratie

Een nieuwe migratie zal de functie vervangen met een versie waarin alle kolomreferenties ondubbelzinnig zijn gemaakt door:

1. **Tabel-aliassen toevoegen**: Elke tabel krijgt een korte alias (bijv. `gco` voor gas_cylinder_orders, `dio` voor dry_ice_orders)
2. **Expliciet prefix gebruiken**: Alle kolommen worden voorafgegaan door hun tabelalias (bijv. `gco.customer_id` in plaats van alleen `customer_id`)
3. **GROUP BY met alias**: Ook de GROUP BY clausules gebruiken de tabel-aliassen

### Aangepaste Functie

```sql
CREATE OR REPLACE FUNCTION public.get_yearly_totals_by_customer(p_year integer)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  total_cylinders bigint,
  total_dry_ice_kg numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH all_customers AS (
    SELECT DISTINCT gco.customer_id as cid, gco.customer_name as cname
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
      AND gco.scheduled_date <= make_date(p_year, 12, 31)
    UNION
    SELECT DISTINCT dio.customer_id as cid, dio.customer_name as cname
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, 1, 1)
      AND dio.scheduled_date <= make_date(p_year, 12, 31)
  ),
  cylinder_totals AS (
    SELECT gco.customer_id as cid, gco.customer_name as cname,
      COALESCE(SUM(gco.cylinder_count), 0)::bigint as cylinders
    FROM gas_cylinder_orders gco
    WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
      AND gco.scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY gco.customer_id, gco.customer_name
  ),
  dry_ice_totals AS (
    SELECT dio.customer_id as cid, dio.customer_name as cname,
      COALESCE(SUM(dio.quantity_kg), 0)::numeric as dry_ice
    FROM dry_ice_orders dio
    WHERE dio.scheduled_date >= make_date(p_year, 1, 1)
      AND dio.scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY dio.customer_id, dio.customer_name
  )
  SELECT 
    ac.cid,
    ac.cname,
    COALESCE(ct.cylinders, 0)::bigint,
    COALESCE(dt.dry_ice, 0)::numeric
  FROM all_customers ac
  LEFT JOIN cylinder_totals ct ON ac.cid = ct.cid AND ac.cname = ct.cname
  LEFT JOIN dry_ice_totals dt ON ac.cid = dt.cid AND ac.cname = dt.cname
  ORDER BY (COALESCE(ct.cylinders, 0) + COALESCE(dt.dry_ice, 0)) DESC;
END;
$$;
```

## Stappen

| Stap | Actie |
|------|-------|
| 1 | Database migratie uitvoeren met gecorrigeerde functie |
| 2 | Functie testen om te verifiëren dat de data correct wordt opgehaald |

## Geen Frontend Wijzigingen Nodig

De `TopCustomersWidget.tsx` component is correct geïmplementeerd - het probleem zit volledig in de database functie. Na de fix zal de widget automatisch de klantdata correct weergeven.
