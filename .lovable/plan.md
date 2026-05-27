## Klantnaam-varianten samenvoegen in YoY

### Diagnose

De getallen kloppen op rij-niveau, maar dezelfde klant verschijnt onder verschillende schrijfwijzen in `Productie.Klant` (vrije-tekstveld). Voorbeeld uit de screenshot:

- `Gashandel H de Vries en Zn.` — 596 → 955 (stijger)
- `Gashandel H. de Vries & Zn` — 1.017 → 493 (daler)

Samengevoegd: 1.613 → 1.448 = -10% (daler). Door de losse spelling lijkt de klant tegelijk in beide top-lijsten te staan.

### Oplossing

Normalisatie van de groeperingssleutel in `YoYInsights.tsx` (alleen voor het Klanten-tabblad). Visueel wordt de meest voorkomende originele schrijfwijze als label getoond.

**Normalisatieregels** (alleen voor matching, niet voor weergave):

- Lowercase
- Diakritieken strippen (NFD)
- `&` → `en`, `+` → `en`
- Punten, komma's, apostroffen verwijderen
- `b.v.` / `bv` / `b v` / `bvba` → leeg
- Achtervoegsels strippen: ` bv`, ` nv`, ` gmbh`, ` ltd`, ` sa`, ` sl`, ` srl`
- Meerdere spaties → één spatie, trim

Resultaat: `"Gashandel H de Vries en Zn."` en `"Gashandel H. de Vries & Zn"` worden beide `"gashandel h de vries en zn"` → één groep.

### Implementatie

In `src/components/production/YoYInsights.tsx`:

1. Helper `normalizeKlant(name: string): string` toevoegen met bovenstaande regels.
2. In de `agg`-`useMemo`, voor het `klanten`-blok:
   - Vervang `groupBy(rows, r => r.Klant)` door een variant die op `normalizeKlant(r.Klant)` groepeert.
   - Houd parallel een `displayLabel`-map bij: per genormaliseerde sleutel de originele schrijfwijze met het hoogste totaalvolume (huidig + vorig).
3. `buildDelta` blijft hetzelfde; alleen `label` wordt vervangen door `displayLabel.get(key) ?? key` voor klanten.
4. Geen effect op gassoort/capaciteit-tabs en geen DB-wijzigingen.

### Scope

Alleen `src/components/production/YoYInsights.tsx`. Geen wijziging aan andere componenten, RPC of database. Als je later structureel wilt opschonen, kan de bestaande Merge Customers-flow gebruikt worden in de bronadministratie.
