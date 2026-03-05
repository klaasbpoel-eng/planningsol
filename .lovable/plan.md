

## Voorbeeldweergave toevoegen aan Excel Import dialogen

Toevoegen van een visuele voorbeeldtabel in de upload-stap van alle drie Excel import dialogen, zodat gebruikers direct zien hoe hun bestand eruit moet zien.

### Aanpassingen per dialoog

**1. Gascilinders Import (`ExcelImportDialog.tsx`)**
- Voorbeeldtabel met kolommen: Datum | Gassoort | Type vulling | Aantal | M/T | Klant | Locatie | Opmerkingen
- 2-3 voorbeeldrijen met realistische data

**2. Droogijs Import (`DryIceExcelImportDialog.tsx`)**
- Voorbeeldtabel met kolommen: Datum | Diameter | Inhoud (kg) | Aantal | Totaal kg
- 2-3 voorbeeldrijen

**3. Voorraad Import (`StockExcelImportDialog.tsx`)**
- Voorbeeldtabel met kolommen: Artikelcode | Omschrijving | Gem. Verbruik | Voorraad | Verschil
- 2-3 voorbeeldrijen

### Implementatie
- Onder de "Sleep een Excel bestand hierheen" tekst een inklapbaar `Collapsible` blok toevoegen met titel "Voorbeeld bestandsindeling"
- Bevat een compacte tabel met voorbeelddata en een korte toelichting over ondersteunde formaten
- Styling: `text-xs`, `bg-muted/30` achtergrond, subtiele border

