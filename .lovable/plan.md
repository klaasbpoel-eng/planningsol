

## Printbaar voorraadoverzicht met onderscheid Emmen-vulling

### Wat wordt er gebouwd
Een printfunctie voor de voorraadstatus die een overzichtelijk rapport genereert, opgesplitst in twee secties: producten die in Emmen gevuld worden en producten die niet in Emmen gevuld worden.

### Aanpassingen

**1. StockItem uitbreiden met `filledInEmmen` veld**
- In `StockExcelImportDialog.tsx`: een `filledInEmmen` boolean toevoegen aan de `StockItem` interface
- De default mock data in `StockSummaryWidget.tsx` voorzien van dit veld
- Bij Excel-import: een extra kolom herkennen (bijv. "vullocatie", "filled", "emmen") of een handmatige toggle per product bieden

**2. Printbaar overzicht component maken**
- Nieuw bestand: `src/components/production/StockPrintView.tsx`
- Landscape A4 layout met twee duidelijke secties:
  - **Gevuld in Emmen**: tabel met Code, Omschrijving, Gem. Verbruik, Voorraad, Verschil, Status
  - **Niet gevuld in Emmen**: zelfde tabelstructuur
- Binnen elke sectie gesorteerd op status (kritiek eerst, dan laag, dan goed, dan overschot)
- Kleurcodering behouden in print (rood/oranje/groen/cyan voor statusbadges)
- Header met titel, datum, en locatie-info

**3. Print-knop toevoegen aan StockSummaryWidget**
- Printericoon naast de bestaande upload-knop in de widget header
- Bij klikken: opent een verborgen printbare div (of dialog) en roept `window.print()` aan
- Alleen zichtbaar als er voorraaddata beschikbaar is

**4. Print CSS**
- In `src/index.css`: print-specifieke styling voor het voorraadoverzicht
- Landscape oriëntatie, compacte tabellen, page-break tussen de twee secties indien nodig

### Technische details

- Het `filledInEmmen` veld wordt standaard `true` voor de bestaande mock data (aangezien die Emmen-producten voorstellen)
- Bij import wordt gezocht naar kolommen als "vullocatie" of "locatie vulling"; als niet gevonden, wordt een fallback gebruikt (standaard `true` als locatie Emmen is)
- De printview wordt als een hidden div in de DOM geplaatst, met `@media print` regels die alleen deze div tonen
- Bestaande export-utils (`exportToPDF`) worden hergebruikt voor een eventuele PDF-download optie

