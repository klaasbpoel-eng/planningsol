

## Luchtfoto plattegrond James Cookstraat 3, Emmen

### Wat wordt er gebouwd
Een nieuw kaartcomponent dat een satelliet-/luchtfoto toont van uitsluitend het perceel James Cookstraat 3, 7825 VR Emmen. De kaart wordt ingezoomd op het terrein en gebruikt satellietbeelden in plaats van de huidige stratenkaart.

### Aanpak

**Nieuw component: `src/components/production/AerialSiteMap.tsx`**

- Leaflet-kaart met **Esri World Imagery** satelliet-tiles (gratis, geen API key nodig)
- Gecentreerd op het perceel (ca. 52.7616, 6.9397) met zoomniveau ~18 zodat alleen het terrein zichtbaar is
- Optioneel: een polygoon overlay die de perceelgrens markeert
- Scroll-zoom en pan uitgeschakeld of beperkt zodat gebruikers niet per ongeluk wegnavigeren
- `maxBounds` ingesteld op het perceelgebied zodat de kaart niet buiten het terrein kan scrollen

**Integratie**

- Het component wordt beschikbaar gemaakt op de productie/site-map pagina, naast of als alternatief voor de bestaande SiteMap
- Kan via een tab of toggle geschakeld worden tussen "Stratenkaart" en "Luchtfoto"

### Technisch detail

**Bestand: `src/components/production/AerialSiteMap.tsx`**

```tsx
// Esri World Imagery tile layer (gratis, geen key vereist)
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  }
);

// Kaart gecentreerd en begrensd op het perceel
const map = L.map(container, {
  center: [52.7616, 6.9397],
  zoom: 18,
  minZoom: 17,
  maxZoom: 19,
  maxBounds: [[52.760, 6.937], [52.763, 6.942]],
  maxBoundsViscosity: 1.0,
});
```

**Bestand: `src/components/production/SiteMap.tsx`**

- Import en render van het nieuwe `AerialSiteMap` component, met een toggle-knop om te wisselen tussen de bestaande layout-weergave en de luchtfoto.

### Bestanden

| Bestand | Actie |
|---------|-------|
| `src/components/production/AerialSiteMap.tsx` | Nieuw |
| `src/components/production/SiteMap.tsx` | Kleine aanpassing (toggle toevoegen) |

