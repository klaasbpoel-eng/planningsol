
# Dagelijks overzicht opsplitsen in kolommen

## Wat verandert er

Het huidige dagelijks overzicht toont alle categorieeen (Taken, Vrij, Droogijs, Gascilinders, Ambulance) onder elkaar in een verticale lijst. Dit wordt omgebouwd naar een kolom-layout zodat elke categorie zijn eigen kolom krijgt, naast elkaar.

## Layout

Per dag worden de secties naast elkaar weergegeven in een responsive grid:

```text
+------------------+------------------+------------------+------------------+------------------+
|   Ambulance      |   Gascilinders   |    Droogijs      |     Taken        |      Vrij        |
|   (rood)         |   (oranje)       |    (cyaan)       |     (blauw)      |     (groen)      |
|                  |                  |                  |                  |                  |
|  cilinder info   |  klant + gas     |  klant + kg      |  taak details    |  medewerker      |
|  klanten         |  aantal cil.     |  status          |  tijdstip        |  type verlof     |
+------------------+------------------+------------------+------------------+------------------+
```

- Op desktop: tot 5 kolommen naast elkaar (alleen kolommen die data hebben worden getoond)
- Op tablet: 2-3 kolommen
- Op mobiel: 1 kolom (huidige gedrag behouden)

## Technische aanpak

### Bestand: `src/components/dashboard/DailyOverview.tsx`

1. **Grid container** -- De huidige `<div>` per dag die secties verticaal stapelt wordt vervangen door een responsive CSS grid:
   - `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4`
   - Alleen kolommen met data worden gerenderd

2. **Section component aanpassen** -- De bestaande `Section` component krijgt een card-achtige styling zodat elke kolom visueel gescheiden is:
   - Lichte achtergrondkleur per categorie (bijv. `bg-red-50 dark:bg-red-950/20` voor ambulance)
   - Afgeronde hoeken en padding
   - De section header (icoon + label + count) bovenaan de kolom

3. **Geen data-wijzigingen** -- Alle queries en data-structuren blijven ongewijzigd
