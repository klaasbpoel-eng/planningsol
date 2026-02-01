
# Plan: Locatie-onderscheid toevoegen aan gascilinder import

## Probleem
Bij het importeren van gascilinder orders via Excel wordt geen onderscheid gemaakt tussen de twee productielocaties (SOL Emmen en SOL Tilburg). Alle orders krijgen automatisch de standaardwaarde `sol_emmen`.

## Oorzaak
De Excel import functionaliteit (`ExcelImportDialog.tsx`) detecteert, parst en bewaart de `location` kolom niet uit het Excel bestand.

## Oplossing
Uitbreiding van de import- en orderbeheer-functionaliteit om de productielocatie correct te verwerken.

---

## Technisch Plan

### Stap 1: ParsedCylinderOrder interface uitbreiden
Voeg een `location` veld toe aan het interface zodat de locatie kan worden opgeslagen per geparseerde order.

```text
interface ParsedCylinderOrder {
  date: Date;
  gasType: string;
  cylinderSize: string;
  count: number;
  grade: "medical" | "technical";
  customer: string;
  notes: string;
  pressure: number;
  location: "sol_emmen" | "sol_tilburg";  // Nieuw veld
}
```

### Stap 2: Kolom detectie voor locatie toevoegen
Uitbreiding van de header mapping om de locatie-kolom te detecteren met flexibele matching:
- Detectie van kolomnamen zoals "locatie", "location", "productielocatie", "site", "vestiging"
- Genormaliseerde matching (lowercase, geen accenten, geen extra spaties)

### Stap 3: Locatie waarde parsen
Functie toevoegen die Excel waarden vertaalt naar database enum waarden:
- "emmen", "sol emmen", "sol_emmen" → `sol_emmen`
- "tilburg", "sol tilburg", "sol_tilburg" → `sol_tilburg`
- Fallback naar `sol_emmen` als geen match gevonden wordt

### Stap 4: Locatie meenemen bij database insert
Het `location` veld toevoegen aan de insert data object zodat de juiste locatie wordt opgeslagen.

### Stap 5: Locatie tonen in preview tabel
De locatie-kolom toevoegen aan de preview tabel zodat gebruikers kunnen controleren of de locaties correct zijn gedetecteerd.

### Stap 6 (Optioneel): Fallback locatiekeuze toevoegen
Als er geen locatie-kolom in het Excel bestand staat, een dropdown tonen waar de gebruiker een standaard locatie kan kiezen voor alle orders in de import.

---

## Betrokken bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/production/ExcelImportDialog.tsx` | Interface uitbreiden, locatie-kolom detectie, parsing, insert data, preview tabel |
| `src/components/production/CreateGasCylinderOrderDialog.tsx` | Locatie-selectie dropdown toevoegen |
| `src/components/production/GasCylinderPlanning.tsx` | (Optioneel) Locatie-filter en kolom in tabel |

---

## Verwacht resultaat
Na implementatie kunnen gascilinder orders worden geïmporteerd met de juiste productielocatie (SOL Emmen of SOL Tilburg) en blijft het onderscheid behouden in de database en rapportages.
