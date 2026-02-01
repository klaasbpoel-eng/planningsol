
# Plan: Fix Jaarvergelijking Filters

## Probleemanalyse

Na onderzoek van de code is het probleem duidelijk: de filters voor gastype en klant **werken niet** omdat:

1. **De data wordt client-side niet gefilterd**: De totalen (`cylinderTotals`, `dryIceTotals`) en maandelijkse overzichten worden berekend op basis van alle data, ongeacht de geselecteerde filters.

2. **Alleen specifieke secties filteren**: 
   - Gastype filter: Alleen toegepast op "Cilinders per gastype" charts
   - Klant filter: Alleen toegepast op "Vergelijking per klant" sectie

3. **Niet-gefilterde secties**:
   - Cilinders Jaartotaal card
   - Droogijs Jaartotaal card
   - Groei Highlights
   - Cilinders per maand chart
   - Droogijs per maand chart
   - Groeipercentage per maand chart
   - Maandelijkse overzichtstabel

## Oplossing

Implementeer reactieve filtering met `useMemo` zodat alle overzichten dynamisch updaten wanneer filters wijzigen.

---

## Technische Wijzigingen

### Stap 1: Voeg gefilterde data berekeningen toe

Voeg `useMemo` hooks toe die de data herberekenen op basis van:
- `selectedGasTypes` (voor gastype-gerelateerde overzichten)
- `selectedCustomers` (voor klant-gerelateerde overzichten)

```text
// Nieuwe useMemo hooks toevoegen na de bestaande state declaraties:

// Gefilterde gastype vergelijking data
const filteredGasTypeData = useMemo(() => {
  if (selectedGasTypes.length === 0) return gasTypeComparison;
  return gasTypeComparison.filter(gt => selectedGasTypes.includes(gt.gas_type_id));
}, [gasTypeComparison, selectedGasTypes]);

// Herberekende cylinder totalen op basis van gastype filter
const filteredCylinderTotals = useMemo(() => {
  if (selectedGasTypes.length === 0) return cylinderTotals;
  // Bereken totalen alleen voor geselecteerde gastypes
  const currentTotal = filteredGasTypeData.reduce((sum, gt) => sum + gt.currentYear, 0);
  const previousTotal = filteredGasTypeData.reduce((sum, gt) => sum + gt.previousYear, 0);
  const change = currentTotal - previousTotal;
  const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);
  return { currentYear: currentTotal, previousYear: previousTotal, change, changePercent };
}, [cylinderTotals, filteredGasTypeData, selectedGasTypes]);

// Gefilterde maandelijkse data voor cilinders
const filteredMonthlyGasTypeData = useMemo(() => {
  if (selectedGasTypes.length === 0) return monthlyGasTypeData;
  
  const filterMonthData = (data: MonthlyGasTypeChartData[]) => {
    return data.map(month => {
      const filtered: MonthlyGasTypeChartData = { month: month.month, monthName: month.monthName };
      selectedGasTypes.forEach(gtId => {
        if (month[gtId] !== undefined) filtered[gtId] = month[gtId];
      });
      return filtered;
    });
  };
  
  return {
    current: filterMonthData(monthlyGasTypeData.current),
    previous: filterMonthData(monthlyGasTypeData.previous)
  };
}, [monthlyGasTypeData, selectedGasTypes]);

// Herberekende cylinder maanddata op basis van gastype filter
const filteredCylinderData = useMemo(() => {
  if (selectedGasTypes.length === 0) return cylinderData;
  
  // Bereken nieuwe maandtotalen uit gefilterde gastype data
  return cylinderData.map((month, idx) => {
    const currentMonthData = filteredMonthlyGasTypeData.current[idx];
    const previousMonthData = filteredMonthlyGasTypeData.previous[idx];
    
    const currentTotal = selectedGasTypes.reduce((sum, gtId) => 
      sum + (Number(currentMonthData?.[gtId]) || 0), 0);
    const previousTotal = selectedGasTypes.reduce((sum, gtId) => 
      sum + (Number(previousMonthData?.[gtId]) || 0), 0);
    
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
}, [cylinderData, filteredMonthlyGasTypeData, selectedGasTypes]);
```

### Stap 2: Update de UI componenten

Vervang hardcoded data referenties met gefilterde versies:

| Origineel | Vervang door | Sectie |
|-----------|--------------|--------|
| `cylinderTotals` | `filteredCylinderTotals` | Cilinders Jaartotaal card |
| `cylinderData` | `filteredCylinderData` | Cilinders per maand chart |
| `cylinderData` | `filteredCylinderData` | Groei Highlights |
| `cylinderData` | `filteredCylinderData` | Groeipercentage chart |
| `cylinderData` | `filteredCylinderData` | Maandelijkse overzichtstabel |
| `gasTypeComparison` | `filteredGasTypeData` | Gastype charts (al deels gedaan) |

### Stap 3: Voeg filter indicator toe aan totalen

Toon een badge wanneer filters actief zijn zodat gebruikers weten dat de weergegeven data gefilterd is:

```text
<CardTitle className="text-lg flex items-center gap-2">
  <Cylinder className="h-5 w-5 text-orange-500" />
  Cilinders Jaartotaal
  {selectedGasTypes.length > 0 && (
    <Badge variant="secondary" className="ml-2">
      {selectedGasTypes.length} gastype(s) gefilterd
    </Badge>
  )}
</CardTitle>
```

---

## Wijzigingen Overzicht

| Bestand | Type Wijziging |
|---------|----------------|
| `YearComparisonReport.tsx` | Toevoegen van gefilterde data berekeningen via `useMemo` |
| `YearComparisonReport.tsx` | Update alle relevante charts en tabellen om gefilterde data te gebruiken |
| `YearComparisonReport.tsx` | Toevoegen van filter-actief indicatoren |

---

## Verwacht Resultaat

Na implementatie:
- Alle grafieken en totalen updaten dynamisch wanneer gastype of klant filters worden geselecteerd
- Gebruikers zien een duidelijke indicatie wanneer data gefilterd wordt
- Performance blijft optimaal door gebruik van `useMemo` voor herberekeningen
- Consistente gebruikerservaring: filteren werkt overal in de jaarvergelijking
