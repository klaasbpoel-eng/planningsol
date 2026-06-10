## Doel
Onderaan de gastype-tabel in `LocationComparisonReport.tsx` (locatievergelijkingsrapport) een totaalrij toevoegen die de kolommen Emmen, Tilburg, huidig jaar en (indien zichtbaar) vorig jaar + Δ% optelt — analoog aan de bestaande totalenrij in de maandtabel daarboven.

## Wijziging
Bestand: `src/components/production/LocationComparisonReport.tsx` (tabel rond regel 887-944).

1. Vóór het `<tbody>` (of binnen het render-blok) totalen berekenen uit `filteredGasTypeData`:
   - `totalEmmen = sum(emmen)`
   - `totalTilburg = sum(tilburg)`
   - `totalCurrent = sum(total)`
   - `totalPrev = sum(total_prev || 0)`
   - `totalDelta = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : null`

2. Direct na de `.map(...)` een extra `<tr>` toevoegen met:
   - Eerste cel: "Totaal" (bold).
   - Emmen / Tilburg / huidig jaar cellen met de getotaliseerde waarden (`tabular-nums`, bold voor huidige jaar-kolom).
   - Indien `showComparison`: vorig-jaar-totaal + Δ%-cel (groen/rood net als in de rijen).
   - Indien `!showComparison`: een lege cel onder de "Verdeling"-kolom (zodat het aantal kolommen klopt).
   - Styling: `border-t font-semibold bg-muted/20` voor visuele scheiding, in lijn met de bestaande "Totaal {selectedYear}"-rij in de maandtabel boven.

## Niet aanpassen
- Geen wijzigingen aan de chart, dataset of overige tabellen.
- Geen wijzigingen aan styling van bestaande rijen.
