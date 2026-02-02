
# Plan: Cilindergrootte toevoegen aan Rapportages

## Overzicht
Het doel is om cilindergrootte (cylinder_size) als extra dimensie toe te voegen aan de productie-rapportages, zodat je kunt zien hoeveel cilinders er per grootte worden gevuld.

---

## Aanpak: Stapsgewijze Implementatie

### Stap 1: Database Functie Aanmaken
Een nieuwe database functie `get_monthly_cylinder_totals_by_size` die maandelijkse totalen per cilindergrootte teruggeeft:

```sql
CREATE OR REPLACE FUNCTION get_monthly_cylinder_totals_by_size(
  p_year integer,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  month integer,
  cylinder_size text,
  total_cylinders bigint
)
```

Dit volgt hetzelfde patroon als de bestaande `get_monthly_cylinder_totals_by_gas_type` functie.

### Stap 2: Rapportage Component Uitbreiden
Nieuwe sectie toevoegen aan `YearComparisonReport.tsx`:
- **Cilindergrootte vergelijking kaart**: Tabel met alle cilindergroottes en hun huidige vs vorig jaar volume
- **Filter mogelijkheid**: Multi-select voor cilindergroottes (vergelijkbaar met gastype filter)
- **Grafiek**: Optionele bar chart of lijn grafiek per cilindergrootte

### Stap 3: Cumulatief Overzicht per Cilindergrootte (Optioneel)
Nieuwe component `CumulativeCylinderSizeChart.tsx`:
- Vergelijkbaar met `CumulativeGasTypeChart.tsx`
- Toont cumulatieve vullingen per cilindergrootte over meerdere jaren

---

## Technische Details

### Database Migratie
```sql
-- Nieuwe functie voor maandelijkse totalen per cilindergrootte
CREATE OR REPLACE FUNCTION public.get_monthly_cylinder_totals_by_size(
  p_year integer, 
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  month integer, 
  cylinder_size text, 
  total_cylinders bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM gco.scheduled_date)::integer as month,
    gco.cylinder_size,
    COALESCE(SUM(gco.cylinder_count), 0)::bigint as total_cylinders
  FROM gas_cylinder_orders gco
  WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
    AND gco.scheduled_date <= make_date(p_year, 12, 31)
    AND (p_location IS NULL OR gco.location::text = p_location)
  GROUP BY EXTRACT(MONTH FROM gco.scheduled_date), gco.cylinder_size
  ORDER BY month, cylinder_size;
END;
$function$
```

### Frontend Wijzigingen

**YearComparisonReport.tsx:**
1. Nieuwe state variabelen:
   - `cylinderSizeComparison` - vergelijkingsdata per cilindergrootte
   - `selectedCylinderSizes` - filter voor geselecteerde groottes
   - `monthlyCylinderSizeData` - maandelijkse data voor grafieken

2. Nieuwe fetch calls in `fetchYearComparisonData`:
   - Aanroep naar `get_monthly_cylinder_totals_by_size` voor huidig en vorig jaar

3. Nieuwe UI sectie:
   - Kaart met cilindergrootte vergelijkingstabel
   - Multi-select filter component (`CylinderSizeMultiSelect`)
   - Optionele grafiek visualisatie

### Nieuwe Component (optioneel)
**CylinderSizeMultiSelect.tsx:**
- Vergelijkbaar met `GasTypeMultiSelect.tsx`
- Haalt cilindergroottes op uit `cylinder_sizes` tabel
- Groepeert op capaciteit (klein/medium/groot/bundels)

---

## UI Design
De cilindergrootte sectie wordt toegevoegd als een nieuwe tab of collapsible sectie binnen de jaarvergelijking:

1. **Tabel weergave**: Per cilindergrootte met kolommen:
   - Cilindergrootte naam
   - Huidig jaar aantal
   - Vorig jaar aantal
   - Verschil (absoluut + percentage)
   - Trend indicator

2. **Filter**: Checkbox of multi-select om specifieke groottes te selecteren

3. **Grafiek** (optioneel): Staafdiagram met top 10 cilindergroottes

---

## Aanbevolen Volgorde
1. Database functie aanmaken (migratie)
2. YearComparisonReport.tsx uitbreiden met basis tabel
3. CylinderSizeMultiSelect component maken
4. Filtering implementeren
5. Optioneel: Grafiek visualisatie toevoegen
