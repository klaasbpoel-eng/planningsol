

# Plan: Fix Cilinder Orders Count en Klant Filter

## Probleemanalyse

Er zijn twee problemen geïdentificeerd:

### Probleem 1: 1000 vs 1445 cilinder orders
De "Cilinder orders" statistiek in het Rapportage overzicht toont 1000 in plaats van 1445. Dit komt doordat:
- `ProductionReports.tsx` haalt data per maand op met `fetchCylinderMonthData`
- Supabase heeft een default limiet van 1000 rijen
- Januari 2026 bevat 1445 orders, wat de limiet overschrijdt
- De `.limit(5000)` wordt overschreven door de Supabase server-side limiet

### Probleem 2: Klant filter niet toegepast op cilinder data
Het klant filter in de Jaarvergelijking wordt alleen toegepast op:
- Droogijs totalen
- De "Vergelijking per klant" sectie

Het filter wordt **niet** toegepast op:
- Cilinders per maand chart
- Maandelijkse breakdown per gastype
- Groeitrend charts voor cilinders

Dit komt doordat er geen maandelijkse cilinder data per klant beschikbaar is vanuit de database.

---

## Oplossing

### Stap 1: Weekly Chunking voor ProductionReports

Implementeer hetzelfde weekly chunking patroon als in `GasCylinderPlanning.tsx`:

```text
// Nieuwe helper functie
const getWeeksInMonth = (year: number, month: number) => {
  const weeks: { startDate: string; endDate: string }[] = [];
  const monthStr = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  let currentDay = 1;
  
  while (currentDay <= lastDay) {
    const endDay = Math.min(currentDay + 6, lastDay);
    weeks.push({
      startDate: `${year}-${monthStr}-${String(currentDay).padStart(2, '0')}`,
      endDate: `${year}-${monthStr}-${String(endDay).padStart(2, '0')}`
    });
    currentDay = endDay + 1;
  }
  return weeks;
};

// Nieuwe functie voor wekelijkse data ophalen
const fetchCylinderWeekData = async (startDate: string, endDate: string) => {
  let query = supabase
    .from("gas_cylinder_orders")
    .select(`*, gas_type_ref:gas_types(id, name, color)`)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .order("scheduled_date", { ascending: true });
  
  if (location !== "all") {
    query = query.eq("location", location);
  }
  
  return query;
};

// Update fetchCylinderMonthData om weeks te gebruiken
const fetchCylinderMonthData = async (year: number, month: number, fromDate: string, toDate: string) => {
  const weeks = getWeeksInMonth(year, month);
  
  // Clamp weeks to actual date range
  const relevantWeeks = weeks.filter(week => 
    week.endDate >= fromDate && week.startDate <= toDate
  ).map(week => ({
    startDate: week.startDate < fromDate ? fromDate : week.startDate,
    endDate: week.endDate > toDate ? toDate : week.endDate
  }));
  
  const weekPromises = relevantWeeks.map(week => 
    fetchCylinderWeekData(week.startDate, week.endDate)
  );
  
  const results = await Promise.all(weekPromises);
  const allOrders = results.flatMap(res => res.data || []);
  
  // Deduplicate by ID
  return Array.from(new Map(allOrders.map(o => [o.id, o])).values());
};
```

### Stap 2: Database Functie voor Maandelijkse Klant Data

Maak een nieuwe database functie die maandelijkse cilinder totalen per klant ophaalt:

```sql
CREATE OR REPLACE FUNCTION get_monthly_cylinder_totals_by_customer(
  p_year integer,
  p_location text DEFAULT NULL
)
RETURNS TABLE(
  month integer,
  customer_id uuid,
  customer_name text,
  total_cylinders bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM gco.scheduled_date)::integer as month,
    gco.customer_id,
    gco.customer_name,
    SUM(gco.cylinder_count)::bigint as total_cylinders
  FROM gas_cylinder_orders gco
  WHERE gco.scheduled_date >= make_date(p_year, 1, 1)
    AND gco.scheduled_date <= make_date(p_year, 12, 31)
    AND (p_location IS NULL OR gco.location::text = p_location)
  GROUP BY month, gco.customer_id, gco.customer_name
  ORDER BY month, total_cylinders DESC;
END;
$$;
```

### Stap 3: Update YearComparisonReport voor Klant Filtering

Pas de component aan om de nieuwe database functie te gebruiken en cilinder data te filteren op klant:

1. **Nieuwe state voor maandelijkse klant data**:
```text
const [monthlyCustomerCylinderData, setMonthlyCustomerCylinderData] = useState<...>({});
```

2. **Fetch nieuwe data in fetchYearComparisonData**:
```text
// Voeg toe aan Promise.all:
supabase.rpc("get_monthly_cylinder_totals_by_customer", { p_year: currentYear, p_location: locationFilter }),
supabase.rpc("get_monthly_cylinder_totals_by_customer", { p_year: previousYear, p_location: locationFilter })
```

3. **Nieuwe useMemo voor gefilterde cylinder maanddata op basis van klant**:
```text
const filteredCylinderDataByCustomer = useMemo(() => {
  if (selectedCustomers.length === 0) return filteredCylinderData;
  
  // Herbereken maandtotalen uit klant-specifieke data
  return cylinderData.map((month, idx) => {
    const currentMonthCustomerData = monthlyCustomerCylinderData.current[month.month] || [];
    const previousMonthCustomerData = monthlyCustomerCylinderData.previous[month.month] || [];
    
    const currentTotal = currentMonthCustomerData
      .filter(c => selectedCustomers.includes(c.customer_id || c.customer_name))
      .reduce((sum, c) => sum + c.total_cylinders, 0);
    
    const previousTotal = previousMonthCustomerData
      .filter(c => selectedCustomers.includes(c.customer_id || c.customer_name))
      .reduce((sum, c) => sum + c.total_cylinders, 0);
    
    const change = currentTotal - previousTotal;
    const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);
    
    return {
      ...month,
      currentYear: currentTotal,
      previousYear: previousTotal,
      change,
      changePercent
    };
  });
}, [filteredCylinderData, monthlyCustomerCylinderData, selectedCustomers, cylinderData]);
```

4. **Update UI componenten om gefilterde data te gebruiken**:
   - Vervang `filteredCylinderData` met `filteredCylinderDataByCustomer` in relevante charts
   - Voeg klant filter badge toe aan cilinder charts

---

## Wijzigingen Overzicht

| Bestand | Type Wijziging |
|---------|----------------|
| `ProductionReports.tsx` | Weekly chunking implementeren om 1000-row limiet te omzeilen |
| Database | Nieuwe `get_monthly_cylinder_totals_by_customer` functie |
| `YearComparisonReport.tsx` | Klant filter toepassen op cilinder maanddata |

---

## Verwacht Resultaat

Na implementatie:
- "Cilinder orders" toont correct **1.445** in plaats van 1.000
- Klant filter in Jaarvergelijking werkt voor zowel cilinders als droogijs
- Alle charts en grafieken updaten dynamisch wanneer klanten worden geselecteerd
- Consistente filtering over het gehele dashboard

