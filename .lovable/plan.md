

## Plan: Trendvergelijking optie toevoegen (vorige maand vs. zelfde maand vorig jaar)

### Wat verandert

Een toggle/select naast de maandselectie waarmee de gebruiker kiest tussen:
- **Vorige maand** (huidige gedrag)
- **Zelfde maand vorig jaar** (nieuw)

### Implementatie in `MonthlyReport.tsx`

1. **Nieuwe state**: `trendMode: "prev_month" | "prev_year"` (default: `"prev_month"`)

2. **Vergelijkingsperiode berekening aanpassen** (regels 112-114):
   - Bij `prev_month`: `subMonths(monthDate, 1)` (huidig gedrag)
   - Bij `prev_year`: `subMonths(monthDate, 12)` — zelfde maand, jaar eerder

3. **UI**: Een `Select` dropdown of segmented control naast de maandselectie met opties "t.o.v. vorige maand" en "t.o.v. vorig jaar"

4. **Subtitel aanpassen** (regel 630): dynamisch tonen welke vergelijking actief is

5. **Export**: trendkolom-header aanpassen op basis van de gekozen modus

### Bestanden
- Alleen `src/components/production/MonthlyReport.tsx`

