
# Plan: Oplossen van delete timeout en database functie fouten

## Probleemanalyse

Na onderzoek heb ik twee problemen gevonden:

### 1. Delete Timeout voor Cilinder Orders
- De database bevat **24.495 gas cylinder orders**
- Het verwijderen van zoveel records in één keer veroorzaakt een statement timeout (de standaard limiet is 8 seconden)
- De huidige code probeert alle records tegelijk te verwijderen wat faalt bij grote datasets

### 2. Klant Vergelijking Functie Fout (bijkomend probleem)
- De `get_yearly_totals_by_customer` database functie geeft een fout: "FULL JOIN is only supported with merge-joinable or hash-joinable join conditions"
- Dit komt door een `FULL OUTER JOIN` met een `OR` conditie die niet wordt ondersteund door PostgreSQL

## Oplossing

### Stap 1: Batch Delete Implementatie
De `handleConfirmDeleteAll` functie in `GasCylinderPlanning.tsx` aanpassen om orders in batches van ~5000 te verwijderen:

```text
+-------------------+      +-------------------+      +-------------------+
| Ophalen order IDs | ---> | Verwijder batch 1 | ---> | Verwijder batch 2 | ---> ...
| (eerste X)        |      | (5000 orders)     |      | (5000 orders)     |
+-------------------+      +-------------------+      +-------------------+
```

**Wijzigingen:**
- Orders ophalen met paginering
- Verwijderen in meerdere kleine batches
- Voortgang tonen aan de gebruiker

### Stap 2: Database Functie Repareren
De `get_yearly_totals_by_customer` functie herschrijven met een `UNION ALL` benadering in plaats van `FULL OUTER JOIN` met `OR`:

**Nieuwe aanpak:**
1. Verzamel alle unieke klant-combinaties uit beide tabellen
2. Join de totalen per tabel afzonderlijk
3. Combineer de resultaten

---

## Technische Details

### Bestand 1: `src/components/production/GasCylinderPlanning.tsx`

De `handleConfirmDeleteAll` functie wijzigen naar een batch-delete aanpak:

```typescript
const handleConfirmDeleteAll = async () => {
  setDeletingAll(true);
  
  try {
    const BATCH_SIZE = 1000;
    let totalDeleted = 0;
    let hasMore = true;
    
    while (hasMore) {
      // Haal een batch IDs op
      const { data: batch, error: fetchError } = await supabase
        .from("gas_cylinder_orders")
        .select("id")
        .limit(BATCH_SIZE);
      
      if (fetchError) throw fetchError;
      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }
      
      const ids = batch.map(order => order.id);
      
      // Verwijder deze batch
      const { error: deleteError } = await supabase
        .from("gas_cylinder_orders")
        .delete()
        .in("id", ids);
      
      if (deleteError) throw deleteError;
      
      totalDeleted += batch.length;
      hasMore = batch.length === BATCH_SIZE;
    }
    
    toast.success(`Alle ${totalDeleted} vulorders zijn verwijderd`);
    fetchOrders();
  } catch (err) {
    toast.error("Fout bij verwijderen van orders");
    console.error("Error:", err);
  } finally {
    setDeletingAll(false);
    setDeleteAllDialogOpen(false);
  }
};
```

### Database Migratie: Fix `get_yearly_totals_by_customer`

Vervang de FULL OUTER JOIN met OR door een UNION-gebaseerde aanpak:

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
    -- Alle unieke klanten uit beide tabellen
    SELECT DISTINCT 
      COALESCE(gco.customer_id, dio.customer_id) as cid,
      COALESCE(gco.customer_name, dio.customer_name) as cname
    FROM (
      SELECT customer_id, customer_name 
      FROM gas_cylinder_orders 
      WHERE scheduled_date >= make_date(p_year, 1, 1)
        AND scheduled_date <= make_date(p_year, 12, 31)
    ) gco
    FULL OUTER JOIN (
      SELECT customer_id, customer_name 
      FROM dry_ice_orders 
      WHERE scheduled_date >= make_date(p_year, 1, 1)
        AND scheduled_date <= make_date(p_year, 12, 31)
    ) dio ON gco.customer_id = dio.customer_id
  ),
  cylinder_totals AS (
    SELECT customer_id as cid, customer_name as cname,
      COALESCE(SUM(cylinder_count), 0)::bigint as cylinders
    FROM gas_cylinder_orders
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY customer_id, customer_name
  ),
  dry_ice_totals AS (
    SELECT customer_id as cid, customer_name as cname,
      COALESCE(SUM(quantity_kg), 0)::numeric as dry_ice
    FROM dry_ice_orders
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31)
    GROUP BY customer_id, customer_name
  )
  SELECT 
    ac.cid as customer_id,
    ac.cname as customer_name,
    COALESCE(ct.cylinders, 0) as total_cylinders,
    COALESCE(dt.dry_ice, 0) as total_dry_ice_kg
  FROM all_customers ac
  LEFT JOIN cylinder_totals ct ON ac.cid = ct.cid
  LEFT JOIN dry_ice_totals dt ON ac.cid = dt.cid
  ORDER BY (COALESCE(ct.cylinders, 0) + COALESCE(dt.dry_ice, 0)) DESC;
END;
$$;
```

---

## Samenvatting Wijzigingen

| Component | Actie |
|-----------|-------|
| `GasCylinderPlanning.tsx` | Batch delete implementeren (1000 per keer) |
| `DryIcePlanning.tsx` | Zelfde batch delete logica toevoegen |
| Database functie | `get_yearly_totals_by_customer` herschrijven zonder OR in FULL JOIN |

## Verwacht Resultaat
- Verwijderen van alle orders werkt betrouwbaar, ongeacht het aantal
- Klant vergelijking in rapportages werkt correct
- Voortgang wordt getoond tijdens het verwijderen
