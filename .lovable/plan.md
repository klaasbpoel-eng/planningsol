

## Uitbreiding Maandrapport met schakelbare secties

### Overzicht
Het maandrapport wordt uitgebreid met 4 nieuwe KPI-secties, elk individueel aan/uit te zetten via toggle-switches boven het rapport. Alle secties zijn standaard ingeschakeld.

### Nieuwe secties (naast bestaande Cilinders, Droogijs, Top 5 klanten)

1. **Efficiëntie (Voltooiingsgraad)** -- al beschikbaar in data (`efficiencyRate`), alleen UI toevoegen
   - Progress bar met percentage per locatie
   - Berekening: `completedCylinders / totalCylinders * 100`

2. **Gemiddeld cilinders per order** -- berekend uit bestaande data
   - Enkel getal: `totalCylinders / cylinderOrders`
   - Met trend t.o.v. vorige maand

3. **Gassoort-verdeling (Top 3)** -- nieuwe query via `api.reports.getGasTypeDistribution()`
   - Horizontale bars per gassoort met kleur en percentage
   - Per locatie opgehaald

4. **Cilindergrootte-verdeling** -- nieuwe query direct op `gas_cylinder_orders` gegroepeerd op `cylinder_size`
   - Compacte badges per grootte met aantallen

### Toggle-mechanisme
- Een rij met `Switch` toggles boven de locatie-kolommen
- Secties: Cilinders | Efficiëntie | Gem. per order | Gassoorten | Grootteverdeling | Droogijs | Top 5 klanten
- State opgeslagen in component (niet persistent, reset bij pagina-herlaad)
- Elke sectie in `LocationColumn` wrapped met `{showX && (...)}`

### Data-uitbreiding
- `LocationKPI` interface uitbreiden met:
  - `avgCylindersPerOrder: number`
  - `gasTypeDistribution: { name: string; color: string; count: number }[]`
  - `sizeDistribution: { size: string; count: number }[]`
- `fetchLocationData` uitbreiden met 2 extra parallelle calls:
  - `api.reports.getGasTypeDistribution(from, to, location, hideDigital)` (bestaat al)
  - Direct Supabase query op `gas_cylinder_orders` gegroepeerd op `cylinder_size`

### Export
- `buildExportRows` uitbreiden met de nieuwe velden, maar alleen kolommen opnemen die ingeschakeld zijn

### Bestand
- Alleen `src/components/production/MonthlyReport.tsx` wijzigen

