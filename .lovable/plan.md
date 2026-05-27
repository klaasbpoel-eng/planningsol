## Doel

Op de **Insights**-tab van `/productie` meer inzicht geven in **jaar-op-jaar (YoY) verschillen**, op drie analyseniveaus:
1. **Klantniveau** — wie groeit / krimpt het sterkst t.o.v. vorig jaar
2. **Gassoort-niveau** — welke gassen lopen omhoog/omlaag
3. **Capaciteit-niveau** — verschuiving tussen cilindergroottes (10L, 50L, bundels)

Vandaag toont `CustomerSegmentation` alleen een vergelijking met de **direct voorafgaande periode** (zelfde lengte). Dat is een korte-termijn-trend, geen YoY. Er is geen breakdown per gassoort of capaciteit.

## Wat ik ga bouwen

### 1. Nieuwe sectie: "YoY Vergelijking" boven Klant Segmentatie

Een uitklapbare kaart met drie sub-tabs (Klanten / Gassoorten / Capaciteit). Elke sub-tab toont dezelfde lay-out:

```text
┌─ Totaal: 129.782 cil. (2026) vs 312.456 (2025) ─ -58,5%  ┐
│                                                            │
│  Top stijgers              Top dalers                      │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │ Klant A +145%    │      │ Klant X  -78%    │            │
│  │ 1.200 → 2.940    │      │ 5.400 → 1.180    │            │
│  └──────────────────┘      └──────────────────┘            │
│  ...top 5/10...            ...top 5/10...                  │
│                                                            │
│  [Volledige tabel uitklappen] — sorteerbaar op Δ%, Δabs   │
└────────────────────────────────────────────────────────────┘
```

- Periode-keuze: huidige selectie (datumrange) vs **zelfde periode vorig jaar** (1-jaar-shift).
- Toggle voor **Δ%** vs **Δ absoluut** sorteren — anders verschijnen kleine klanten altijd bovenaan met +∞%.
- Filter: minimum-volume drempel (default 50 cil.) om ruis te onderdrukken.

### 2. Per analyseniveau

**Klanten** — groepeer `Productie` op `Klant`, som `Aantal`. Toon naam, vorig jaar, dit jaar, Δ abs, Δ%, mini-bar.

**Gassoorten** — groepeer op `Product` (gemapt naar gas-type via bestaande logica zoals `buildDigitalProductNames`/gas_types). Toon gas, vorig jaar, dit jaar, Δ, met gas-kleur uit `src/constants/gasColors.ts`.

**Capaciteit** — groepeer op cilindergrootte (afgeleid van product/inhoud). Voor bundels wordt al expansie gedaan in `useGasFlowPredictor`; ik herbruik dezelfde `gas_packages`-mapping zodat 800L als 16×50L meetelt. Toon 10L / 20L / 50L / bundels.

### 3. Respect bestaande filters

- Datum-range, locatie (Emmen/Tilburg/all), `hideDigital`, `hideExternal` — alle bestaande props worden doorgegeven.
- Als gebruiker een meerjarige range kiest (bv. 2024-2026), wordt YoY berekend t.o.v. dezelfde lengte 1 jaar eerder.

## Technische uitvoering

- Nieuwe component **`src/components/production/YoYInsights.tsx`** met interne sub-tabs.
- Hergebruik van het `Productie`-paginated fetch-patroon uit `CustomerSegmentation.tsx` (gepagineerd per `Jaar`, met datum/locatie-filter).
- Bundle-expansie via `gas_packages` (zelfde mapping als `useGasFlowPredictor.expandPackage`) zodat klantvolumes consistent zijn met de Gas-Flow pagina.
- Inhaken in `ProductionReports.tsx` op `<TabsContent value="insights">` — eerst `YoYInsights`, dan bestaande `CustomerSegmentation` (blijft als detail-view).
- Geen DB-migratie nodig.

## Wat ik **niet** verander

- De huidige Klant Segmentatie-kaart blijft staan (kort-termijn trend en tier-indeling).
- Geen wijzigingen aan andere tabs (Overview, Productie, Cilinders, Locaties, Vergelijking).
- Geen wijzigingen in business logic of backend.

## Open vraag (optioneel)

Wil je dat de YoY-vergelijking ook **kwartaal-op-kwartaal** kan, of is alleen jaar-op-jaar (zelfde periode -1 jaar) voldoende voor nu?
