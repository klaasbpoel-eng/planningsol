

# Plan: Luchtfoto als Site Map Achtergrond

## Wat gaan we doen

De geüploade satellietfoto van het SOL Emmen terrein wordt ingesteld als achtergrondafbeelding voor de Site Map component. Dit vervangt (of vult aan naast) de huidige `site-map-background.png`.

## Wijzigingen

| Stap | Actie |
|------|-------|
| 1 | Kopieer de geüploade afbeelding naar `public/site-map-emmen.png` |
| 2 | Pas `SiteMap.tsx` aan om de nieuwe afbeelding als achtergrond te gebruiken |

## Technische Details

- De afbeelding wordt opgeslagen in de `public/` map zodat deze direct als CSS background-image gebruikt kan worden
- In het SiteMap component wordt de achtergrondafbeelding ingesteld op de nieuwe luchtfoto, met `background-size: cover` en `background-position: center`
- De bestaande functionaliteit (tanks, opslagzones, drag-and-drop, zoom, rotatie) blijft volledig intact
- Indien het component per locatie (`sol_emmen` / `sol_tilburg`) kan schakelen, wordt de luchtfoto gekoppeld aan de Emmen-locatie
