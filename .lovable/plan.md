

# RPC Functies voor Droogijs Statistieken

## Analyse

De huidige code haalt dry ice statistieken op door individuele rijen te fetchen en client-side te aggregeren. Dit kan dezelfde 1.000-rijlimiet problematiek veroorzaken die we net voor gascilinders hebben opgelost.

### Huidige situatie droogijs data:
- 2026: **158 orders** / **47.880 kg**
- 2027: **4 orders** / **1.080 kg**
- 2025: Geen data

Hoewel de huidige volumes nog binnen de limiet vallen, is het verstandig om dit proactief op te lossen voor toekomstige schaalbaarheid.

### Componenten die droogijs statistieken ophalen:
1. **ProductionPlanning.tsx** - `fetchStats()` haalt `quantity_kg` op per order
2. **ProductionReports.tsx** - Haalt volledige droogijs orders op voor rapportage
3. **TopCustomersWidget.tsx** - Gebruikt al de nieuwe `get_customer_totals_by_period` RPC

## Oplossing

Maak twee nieuwe database functies:

### 1. `get_dry_ice_efficiency_by_period`
Vergelijkbaar met `get_production_efficiency_by_period` maar voor droogijs orders:

```sql
CREATE OR REPLACE FUNCTION public.get_dry_ice_efficiency_by_period(
  p_from_date date,
  p_to_date date,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  total_orders bigint,
  completed_orders bigint,
  pending_orders bigint,
  cancelled_orders bigint,
  efficiency_rate numeric,
  total_kg numeric,
  completed_kg numeric
)
```

### 2. Update ProductionPlanning.tsx

Vervang de client-side aggregatie door een RPC call:

```typescript
// Huidige code (problematisch bij >1000 orders):
const { data: dryIceData } = await supabase
  .from("dry_ice_orders")
  .select("quantity_kg")
  .gte("scheduled_date", fromDate)
  .lte("scheduled_date", toDate);

if (dryIceData) {
  setDryIceToday(dryIceData.reduce((sum, o) => sum + Number(o.quantity_kg), 0));
}

// Nieuwe code (server-side aggregatie):
const { data } = await supabase.rpc("get_dry_ice_efficiency_by_period", {
  p_from_date: fromDate,
  p_to_date: toDate,
  p_location: null // droogijs alleen in Emmen
});

if (data?.[0]) {
  setDryIceToday(data[0].total_kg);
}
```

## Bestanden te wijzigen

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | Nieuwe RPC functie `get_dry_ice_efficiency_by_period` |
| `src/components/production/ProductionPlanning.tsx` | Vervang fetch-all door RPC calls in `fetchStats()` |

## Technische Details

### Database Functie Specificatie

```sql
CREATE OR REPLACE FUNCTION public.get_dry_ice_efficiency_by_period(
  p_from_date date,
  p_to_date date,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  total_orders bigint,
  completed_orders bigint,
  pending_orders bigint,
  cancelled_orders bigint,
  efficiency_rate numeric,
  total_kg numeric,
  completed_kg numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_orders,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_orders,
    COUNT(*) FILTER (WHERE status = 'cancelled')::bigint as cancelled_orders,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status != 'cancelled') = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::numeric * 100 / 
        NULLIF(COUNT(*) FILTER (WHERE status != 'cancelled'), 0), 1
      )
    END as efficiency_rate,
    COALESCE(SUM(quantity_kg) FILTER (WHERE status != 'cancelled'), 0)::numeric as total_kg,
    COALESCE(SUM(quantity_kg) FILTER (WHERE status = 'completed'), 0)::numeric as completed_kg
  FROM public.dry_ice_orders
  WHERE scheduled_date >= p_from_date
    AND scheduled_date <= p_to_date
    AND (p_location IS NULL OR location::text = p_location);
END;
$$;
```

### Frontend Wijzigingen (ProductionPlanning.tsx)

De `fetchStats()` functie wordt geoptimaliseerd:

1. **Droogijs data**: Vervang individuele row fetch door `get_dry_ice_efficiency_by_period` RPC
2. **Cilinder data**: Behoudt de bestaande `get_production_efficiency_by_period` RPC (al geïmplementeerd)
3. **Order counts**: Gebruik de totalen uit de RPC responses in plaats van aparte count queries

## Verwacht Resultaat

- Alle droogijs statistieken worden server-side berekend
- Geen 1.000-rij limiet problemen bij grote datasets
- Consistente aanpak voor zowel cilinder- als droogijsproductie
- Betere performance door minder database roundtrips

