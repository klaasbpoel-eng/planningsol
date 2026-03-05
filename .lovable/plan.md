

## Dynamische voorbeelddata en verbeterde UI voor Excel Import previews

### Huidige situatie
De voorbeeldtabellen tonen hardcoded data (bijv. "Zuurstof", "Ziekenhuis Emmen"). Dit is niet representatief voor de werkelijke data in het systeem.

### Aanpassingen

**1. Dynamische voorbeelddata uit de database**
- **Gascilinders**: Bij openen van het dialoog de laatste 3 orders ophalen via `api.gasCylinderOrders.getAll()` en die als voorbeeldrijen tonen (datum, gassoort, maat, aantal, druk, M/T, klant, locatie)
- **Droogijs**: Laatste 3 droogijs-orders ophalen via `api.dryIceOrders.getAll()` en tonen (datum, diameter, inhoud, aantal, totaal)
- **Voorraad**: Laatste 3 stock items ophalen (als beschikbaar) of fallback naar hardcoded voorbeelden

Elke dialoog krijgt een `useEffect` die bij `open === true` een kleine query doet (max 3 rijen, lichtgewicht). Als er geen data is, worden de huidige hardcoded voorbeelden als fallback gebruikt.

**2. UI/UX verbeteringen ExcelFormatPreview**
- Duidelijkere titel: "Zo moet je bestand eruitzien:" i.p.v. "Voorbeeld bestandsindeling"
- Standaard open in plaats van ingeklapt (gebruikers missen het anders)
- Groene checkmarks bij herkende kolomnamen
- "Download template" knop prominenter maken met outline variant
- Betere spacing en visuele scheiding tussen tabel en notitie

**Bestanden:**
- `src/components/production/ExcelFormatPreview.tsx` — UI verbetering, standaard open
- `src/components/production/ExcelImportDialog.tsx` — Ophalen recente gas-orders als voorbeelddata
- `src/components/production/DryIceExcelImportDialog.tsx` — Ophalen recente droogijs-orders
- `src/components/production/StockExcelImportDialog.tsx` — Fallback behouden (stock data structuur verschilt)

