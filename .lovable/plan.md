## YTD-modus toevoegen aan YoY Vergelijking

Drie periode-modi in de YoY-kaart:

1. **Selectie** — huidig gedrag, gebruikt de paginabrede datumrange. Vergelijkt met dezelfde periode 1 jaar eerder.
2. **YTD** (nieuw, default) — 1 jan t/m vandaag dit jaar, vs 1 jan t/m dezelfde dag vorig jaar.
3. **Volledig jaar** (nieuw) — 1 jan t/m 31 dec huidig vs vorig jaar.

### UI

Segmented control naast de bestaande sortering (Δ abs / Δ %). Header-badge en voettekst tonen automatisch de actuele periode-labels zodat altijd zichtbaar is wat tegen wat wordt gezet.

### Logica

`currentFrom/currentTo` en `prevFrom/prevTo` worden afgeleid uit de gekozen modus i.p.v. enkel uit `dateRange`. Bestaande fetch + aggregatie blijft ongewijzigd; alleen de afgeleide datums veranderen. Wanneer de gebruiker een eigen datumrange in de paginafilter zet, springt de modus automatisch naar "Selectie".

### Scope

Alleen `src/components/production/YoYInsights.tsx`. Geen DB-, RPC- of andere componentwijzigingen.
