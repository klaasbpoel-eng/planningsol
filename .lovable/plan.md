

# Plan: Fix Cilinder Orders Count en Klant Filter ✅ VOLTOOID

## Status: Volledig Geïmplementeerd

Alle drie de stappen zijn succesvol geïmplementeerd:

### ✅ Stap 1: Weekly Chunking voor ProductionReports
**Bestand:** `ProductionReports.tsx`

Geïmplementeerd:
- `getWeeksInMonth()` helper functie voor het opsplitsen van maanden in weken
- `fetchCylinderWeekData()` voor het ophalen van data per week
- Aangepaste `fetchCylinderMonthData()` die wekelijkse chunks gebruikt om de 1000-row limiet te omzeilen
- Deduplicatie van orders op basis van ID

### ✅ Stap 2: Database Functie
**Status:** Al bestaand in de database

De `get_monthly_cylinder_totals_by_customer` functie was al aanwezig in de database en wordt gebruikt voor klant-specifieke cilinder data.

### ✅ Stap 3: Klant Filtering in YearComparisonReport
**Bestand:** `YearComparisonReport.tsx`

Geïmplementeerd:
- `monthlyCustomerCylinderData` state voor maandelijkse klant-specifieke data
- Data fetch via `get_monthly_cylinder_totals_by_customer` RPC voor beide jaren
- `filteredCylinderDataByCustomer` useMemo voor gefilterde maanddata
- `filteredCylinderTotalsByCustomer` useMemo voor gefilterde jaartotalen
- Alle relevante charts en tabellen gebruiken de gefilterde data:
  - Cilinders Jaartotaal card
  - Groei Highlights sectie
  - Cilinders per maand chart
  - Groeitrend area chart
  - Cilinders groeitrend line chart
  - Maandelijks overzicht tabel

---

## Verwacht Resultaat ✓

- ✅ "Cilinder orders" toont correct alle orders (niet beperkt tot 1000)
- ✅ Klant filter werkt voor zowel cilinders als droogijs in Jaarvergelijking
- ✅ Alle charts en grafieken updaten dynamisch bij klantselectie
- ✅ Consistente filtering over het gehele dashboard
