

## Plan: SOL Voorraad Excel Import Functie

### Analyse van het Excel-bestand

Het geuploadde bestand `Voorraad_SOL.xlsx` bevat **individuele cilinderregistraties** (7600+ rijen) met per rij een barcode, geen geaggregeerde tellingen. De relevante kolommen zijn:

| Kolom | Voorbeeld | Doel |
|---|---|---|
| `ContentCode` | `X00054-09` | Product/gastype identificatie |
| `ContentDescription` | `Zuurstof Medicinaal Gasv. SOL in Cylinders integrated` | Gasnaam + verpakking |
| `MasterCodeDescription` | `Cylinders aluminium Zuurstof medisch(Leeg)` | Alternatieve beschrijving |
| `Capacity` | `5`, `10`, `50` | Liter inhoud cilinder |
| `ContainerTypeDescr` | `Cylinders integrated 200 Bar`, `Bundles` | Type container |
| `DS_CENTER_DESCRIPTION` | `vol SOL Nederland-Tilburg`, `warehouse distribution gas NLE NTG-Depot NTG Emmen` | Locatie + status (vol/leeg) |
| `LocationId` | `109`=leeg Tilburg, `110`=vol Tilburg, `139`=leeg Emmen, `140`=vol Emmen | Locatie-ID |

### Wat er gebouwd wordt

Een nieuwe importdialoog `SOLInventoryImportDialog` die:

1. **Excel parsed** en individuele cilinderrijen herkent aan de kolomstructuur (ContentCode, Capacity, DS_CENTER_DESCRIPTION)
2. **Groepeert** per `ContentCode` + `Capacity` en **telt** het aantal cilinders → dit wordt de `numberOnStock`
3. **Locatie bepaalt** op basis van `DS_CENTER_DESCRIPTION`:
   - Bevat "Tilburg" → SOL Tilburg
   - Bevat "Emmen" of "NTG" → SOL Emmen
4. **Vol/leeg splitst** op basis van "vol"/"leeg"/"warehouse distribution" in de beschrijving
5. **Gewichten berekent** per gastype via een mapping op basis van `ContentDescription` en `Capacity` (bijv. O₂ 50L cilinder = ~10kg gas), conform de bestaande logica in het systeem
6. **Preview toont** met geaggregeerde tellingen per gastype, capaciteit, locatie en gewicht
7. **Importeert** naar de bestaande `StockItem[]` structuur die de `StockSummaryWidget` al gebruikt

### Technische aanpak

**Nieuw bestand:** `src/components/production/SOLInventoryImportDialog.tsx`
- Hergebruikt de bestaande `StockExcelImportDialog` patronen (upload → preview → import stappen)
- Aggregatielogica: `Map<string, { count, description, capacity, location }>` gegroepeerd op `ContentCode`
- Gewichtmapping: lookup-tabel voor standaard cilindergewichten per gastype en capaciteit
- Output: `StockItem[]` compatibel met bestaande `handleImported`

**Aanpassing:** `src/components/production/StockSummaryWidget.tsx`
- Extra importknop "SOL Inventaris Importeren" naast de bestaande Excel import
- Roept dezelfde `handleImported` aan

**Gewichtmapping** (ingebouwd in de component):
```text
ContentCode → gastype herkenning uit ContentDescription:
  "Zuurstof"     → O₂ gewicht per liter capaciteit
  "Stikstof"     → N₂ gewicht per liter capaciteit  
  "Argon"        → Ar gewicht per liter capaciteit
  "Acetyleen"    → C₂H₂ gewicht per liter capaciteit
  "Kooldioxide"  → CO₂ gewicht per liter capaciteit
  "Helium"       → He gewicht per liter capaciteit
  etc.
```

### Geen database-wijzigingen nodig
De bestaande `stock_products` tabel en `StockItem` interface worden hergebruikt.

