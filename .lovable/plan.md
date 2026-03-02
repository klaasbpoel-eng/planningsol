

## Nieuwe items markeren in Dagelijks Overzicht

### Wat verandert er

Wanneer er een nieuw item verschijnt in het dagelijks overzicht (via realtime updates of bij het openen van de pagina), wordt dit visueel gemarkeerd met:

1. **Een subtiele glow/highlight** rondom het nieuwe item (lichte gekleurde achtergrond-puls)
2. **Een "Nieuw" badge** naast het item
3. **Klikken op het item of de badge** markeert het als "gezien" en verwijdert de markering

### Aanpak

De "gezien"-status wordt bijgehouden in **localStorage** per gebruiker. Bij elke data-fetch worden de huidige item-IDs vergeleken met de opgeslagen set. Items die nog niet in de set zitten, worden als "nieuw" gemarkeerd.

### Technische details

**Bestand: `src/components/dashboard/DailyOverview.tsx`**

- Nieuwe state: `seenItemIds` (Set van strings) geladen uit localStorage bij mount
- Helper `getStorageKey()` die een localStorage-key genereert (bijv. `daily-overview-seen-ids`)
- Na elke `fetchData`: vergelijk alle item-IDs (taken, droogijs, gas, ambulance) met `seenItemIds` om een `newItemIds` Set te berekenen
- Functie `markAsSeen(id: string)` die het ID toevoegt aan de Set en localStorage bijwerkt
- Functie `markAllAsSeen()` voor een optionele "Alles gezien" knop in de header
- Bij het klikken op een item (bestaande click handlers) wordt `markAsSeen` automatisch mee aangeroepen
- Oude IDs (ouder dan 7 dagen) worden periodiek opgeschoond uit localStorage om groei te beperken

**Visuele markering per item:**
- Items in `newItemIds` krijgen een extra CSS-class met een zachte achtergrondkleur-animatie (pulse)
- Een kleine "Nieuw" Badge (variant "warning", oranje) wordt getoond naast de StatusBadge
- Bij klik verdwijnt de badge en de highlight

**Optionele "Alles gelezen" knop:**
- Een kleine knop in de CardHeader (naast de print-knop) die alle huidige items als gezien markeert
- Alleen zichtbaar wanneer er nieuwe items zijn

**Bestand: `src/index.css`**
- Toevoegen van een `@keyframes new-item-pulse` animatie voor de highlight

### Bestanden die worden aangepast
- `src/components/dashboard/DailyOverview.tsx` - nieuwe items tracking + visuele markering
- `src/index.css` - pulse animatie voor nieuwe items

