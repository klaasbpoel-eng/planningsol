# Plan: Cilindergrootte toevoegen aan Rapportages

## Status: ✅ VOLTOOID

## Wat is geïmplementeerd

### Stap 1: Database Functie ✅
- Nieuwe RPC functie `get_monthly_cylinder_totals_by_size` aangemaakt
- Retourneert maandelijkse totalen per cilindergrootte met locatie filter ondersteuning

### Stap 2: Frontend Componenten ✅
- `CylinderSizeMultiSelect.tsx` component gemaakt met:
  - Groepering op capaciteit (Klein/Medium/Groot/Bundels)
  - Select all/none functionaliteit
  - Zoekfunctie

### Stap 3: YearComparisonReport Uitgebreid ✅
- Nieuwe state: `cylinderSizes`, `selectedCylinderSizes`, `cylinderSizeComparison`
- Data fetching aangepast met nieuwe RPC call
- `processCylinderSizeComparison` functie toegevoegd
- Nieuw filter toegevoegd naast gastype en klant filters
- Nieuwe vergelijking kaart met:
  - Horizontale staafgrafiek per cilindergrootte
  - Overzichtstabel met huidige/vorig jaar + trend indicator

### Stap 4: CumulativeCylinderSizeChart ✅
- Nieuwe component `CumulativeCylinderSizeChart.tsx` gemaakt
- Cumulatieve lijn grafiek voor cilindergroottes over meerdere jaren
- Vergelijkbaar met `CumulativeGasTypeChart.tsx`
- Features:
  - Twee jaar selectie voor vergelijking
  - Badge selectie per cilindergrootte met capaciteit info
  - Top 5 / Alles / Wissen knoppen
  - Trophy iconen voor top 5 volumes
  - Groei/krimp percentages per cilindergrootte
  - Doorgetrokken lijn (jaar 1) vs gestreepte lijn (jaar 2)

## Technische Details
- Database functie: `get_monthly_cylinder_totals_by_size(p_year, p_location)`
- Filter grid uitgebreid naar 3 kolommen
- Cilindergrootte kaart geplaatst na gastype kaart
- Cumulatieve grafiek toegevoegd aan "Jaarvergelijking" tab in ProductionReports
