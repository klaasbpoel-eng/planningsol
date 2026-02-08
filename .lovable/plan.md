

# Fix: Alle gastypes tonen in het selectiemenu

## Probleem

Het gastype-selectiemenu in het "Nieuwe gascilinder order" dialoog toont niet alle gastypes. Dit komt doordat de app alle orders (48.000+) opvraagt om te bepalen welke gastypes bij een locatie horen, maar er maximaal 1.000 rijen per keer worden opgehaald. Hierdoor worden veel gastypes gemist.

## Oplossing

Vervang de huidige query (die alle orders ophaalt) door een database-functie die efficient alleen de unieke gastype-IDs per locatie opvraagt.

## Wijzigingen

| Stap | Bestand | Wijziging |
|------|---------|-----------|
| 1 | Database | Nieuwe RPC-functie `get_distinct_gas_type_ids_by_location` aanmaken |
| 2 | `CreateGasCylinderOrderDialog.tsx` | De inefficiente query vervangen door een aanroep naar de nieuwe functie |

## Technische Details

### 1. Database functie (SQL migratie)

Een nieuwe functie die `SELECT DISTINCT gas_type_id` uitvoert, gefilterd op locatie. Dit retourneert direct de unieke IDs (maximaal ~100 rijen) in plaats van alle 48.000+ orders.

```sql
CREATE OR REPLACE FUNCTION get_distinct_gas_type_ids_by_location(p_location TEXT)
RETURNS TABLE(gas_type_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT gco.gas_type_id
  FROM public.gas_cylinder_orders gco
  WHERE gco.location = p_location
    AND gco.gas_type_id IS NOT NULL;
$$;
```

### 2. Component aanpassing

In `CreateGasCylinderOrderDialog.tsx` (rond regel 176-199) wordt de huidige query:

```typescript
// OUD - haalt tot 1000 orders op
const { data: locationOrders } = await supabase
  .from("gas_cylinder_orders")
  .select("gas_type_id")
  .eq("location", location)
  .not("gas_type_id", "is", null);
```

Vervangen door:

```typescript
// NIEUW - haalt alleen unieke gas_type_ids op
const { data: locationGasTypes } = await supabase
  .rpc("get_distinct_gas_type_ids_by_location", { p_location: location });
```

Dit is sneller en retourneert altijd alle gastypes, ongeacht het aantal orders.

