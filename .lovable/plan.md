
# Plan: Snellere Bulk Delete via Server-Side RPC

## Huidige Situatie

De applicatie verwijdert orders in batches van 50 records per API call via de Supabase client. Met 127.817+ records betekent dit:
- ~2.556 individuele API calls
- Elke call heeft netwerk latency + authenticatie overhead
- Geschatte tijd: 20-30 minuten

## Oplossing

Maak een **server-side PostgreSQL functie** die alle orders in één database-operatie verwijdert. Dit is vele malen sneller omdat:
1. Geen netwerk overhead per record
2. Geen client-side loops
3. De database kan dit in één transactie afhandelen

## Technische Wijzigingen

### 1. Database: Nieuwe RPC functie aanmaken

```sql
CREATE OR REPLACE FUNCTION public.bulk_delete_orders_by_year(
  p_year integer,
  p_order_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Controleer of gebruiker admin is
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Alleen admins kunnen bulk operaties uitvoeren';
  END IF;

  IF p_order_type = 'cylinder' THEN
    DELETE FROM gas_cylinder_orders 
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
  ELSIF p_order_type = 'dry_ice' THEN
    DELETE FROM dry_ice_orders 
    WHERE scheduled_date >= make_date(p_year, 1, 1)
      AND scheduled_date <= make_date(p_year, 12, 31);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Ongeldig order type: %', p_order_type;
  END IF;

  RETURN deleted_count;
END;
$$;
```

### 2. Frontend: GasCylinderPlanning.tsx aanpassen

Vervang de huidige `handleConfirmDeleteAll` functie:

```typescript
const handleConfirmDeleteAll = async () => {
  setDeletingAll(true);
  
  try {
    // Roep server-side RPC functie aan voor snelle bulk delete
    const { data, error } = await supabase
      .rpc('bulk_delete_orders_by_year', {
        p_year: deleteYear,
        p_order_type: 'cylinder'
      });
    
    if (error) throw error;
    
    toast.success(`Alle ${data} vulorders van ${deleteYear} zijn verwijderd`);
    fetchOrders();
    onDataChanged?.();
  } catch (err) {
    toast.error("Fout bij verwijderen van orders");
    console.error("Error:", err);
  } finally {
    setDeletingAll(false);
    setDeleteAllDialogOpen(false);
  }
};
```

### 3. Frontend: DryIcePlanning.tsx aanpassen

Zelfde aanpassing maar met `p_order_type: 'dry_ice'`:

```typescript
const handleConfirmDeleteAll = async () => {
  setDeletingAll(true);
  
  try {
    const { data, error } = await supabase
      .rpc('bulk_delete_orders_by_year', {
        p_year: deleteYear,
        p_order_type: 'dry_ice'
      });
    
    if (error) throw error;
    
    toast.success(`Alle ${data} droogijs orders van ${deleteYear} zijn verwijderd`);
    fetchOrders();
    onDataChanged?.();
  } catch (err) {
    toast.error("Fout bij verwijderen van orders");
    console.error("Error:", err);
  } finally {
    setDeletingAll(false);
    setDeleteAllDialogOpen(false);
  }
};
```

## Prestatieverbetering

| Methode | API Calls | Geschatte Tijd |
|---------|-----------|----------------|
| Huidige (batch 50) | ~2.556 | 20-30 minuten |
| Nieuwe (RPC) | 1 | 2-5 seconden |

## Samenvatting Wijzigingen

| Onderdeel | Wijziging |
|-----------|-----------|
| Database | Nieuwe `bulk_delete_orders_by_year` RPC functie |
| `GasCylinderPlanning.tsx` | Vervang batch-loop door RPC call |
| `DryIcePlanning.tsx` | Vervang batch-loop door RPC call |

## Beveiliging

- De RPC functie controleert of de gebruiker admin is via `is_admin()`
- `SECURITY DEFINER` zorgt ervoor dat de functie met de juiste rechten draait
- `search_path` is expliciet gezet om SQL injection te voorkomen
