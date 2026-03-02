

## Weekplanning printen vanuit Dagelijks Overzicht

### Wat verandert er

De bestaande Print-knop wordt uitgebreid met een keuzemogelijkheid: je kunt kiezen om alleen de huidige dag of de gehele weekplanning te printen. Als je op "Print" klikt verschijnt een klein dropdown-menu met twee opties:

- **Dag printen** -- print alleen de geselecteerde dag (huidige gedrag)
- **Weekplanning printen** -- schakelt tijdelijk naar weekweergave, print alle 7 dagen, en schakelt daarna terug

### Hoe het werkt

1. De Print-knop wordt een **dropdown-knop** (split button) met twee opties
2. Bij "Weekplanning printen":
   - De component schakelt intern naar weekmodus
   - Wacht tot de data geladen is
   - Roept `window.print()` aan
   - Schakelt terug naar de oorspronkelijke weergave
3. De print-header toont automatisch "Weekplanning" met het weeknummer en de periode

### Technische details

**Bestand: `src/components/dashboard/DailyOverview.tsx`**

- Vervang de enkele Print-knop door een `DropdownMenu` met twee opties: "Dag printen" en "Weekplanning printen"
- Voeg een `printWeek` functie toe die:
  - De `viewMode` tijdelijk op "week" zet
  - De `queryRange` en data laat herladen
  - Na het laden `window.print()` aanroept via `useEffect` met een `printRequested` state
  - Na het printen de originele `viewMode` herstelt
- Pas de print-header aan zodat deze dynamisch "Dagelijks Overzicht" of "Weekplanning" toont afhankelijk van de printmodus

**Bestand: `src/index.css`**

- Voeg print-stijlen toe voor de weekweergave: elke dag als blok onder elkaar (niet naast elkaar) zodat de inhoud leesbaar blijft op papier
- Voeg `page-break-before` toe per dagblok zodat lange weken netjes over meerdere pagina's verdeeld worden

### Bestanden die worden aangepast
- `src/components/dashboard/DailyOverview.tsx`
- `src/index.css`
