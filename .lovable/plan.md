

## Datumselectie alleen voor admin in het vulorder-dialoog

### Huidige situatie
In het "Nieuwe vulorder" dialoog (`CreateGasCylinderOrderDialog`) wordt de datum automatisch op vandaag gezet, maar er is momenteel **geen zichtbare datumselectie** in het formulier. De datum wordt intern op `new Date()` gezet.

### Wat er gaat veranderen
- Een datumselectie (met de bestaande `DateQuickPick` snelkeuze-knoppen en een kalender-popover) wordt toegevoegd aan het "Nieuwe vulorder" dialoog
- Deze datumselectie is **alleen zichtbaar voor admin-gebruikers**
- Niet-admin gebruikers maken altijd orders aan voor vandaag (standaardgedrag blijft ongewijzigd)

### Technische aanpak

**Bestand: `src/components/production/CreateGasCylinderOrderDialog.tsx`**

1. De component haalt al de gebruikersrol op (regel 79-81: `isAdmin`). Dit wordt hergebruikt via een state-variabele `isAdmin`.
2. Onder de "Druk & Kwaliteit" sectie (of boven "Meer opties") wordt een **datum-sectie** toegevoegd, gewrapt in een `{isAdmin && (...)}` conditie:
   - `DateQuickPick` component (Vandaag / Morgen / Ma knoppen)
   - Een kalender-popover knop om een specifieke datum te kiezen
   - Toont de geselecteerde datum als deze afwijkt van vandaag
3. Niet-admin gebruikers zien niets en de datum blijft `new Date()` (vandaag)

**Geschatte impact:** Alleen het bestand `CreateGasCylinderOrderDialog.tsx` wordt aangepast. Er worden geen nieuwe componenten of database-wijzigingen nodig.
