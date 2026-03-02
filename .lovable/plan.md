

## Reeks-items markeren als gezien bij klik

### Wat verandert er

Wanneer je op een item klikt dat onderdeel is van een herhalende reeks, worden **alle items uit dezelfde reeks** als "gezien" gemarkeerd. De "Nieuw" badge en pulse-animatie verdwijnen dan voor de hele reeks in een keer.

### Aanpak

Elk itemtype heeft een reeks-veld:
- **Taken**: `series_id`
- **Gascilinders**: `series_id`
- **Ambulanceritten**: `series_id`
- **Droogijs**: `parent_order_id`

Bij het klikken op een item wordt gekeken of het een reeks-ID heeft. Zo ja, dan worden alle zichtbare items met hetzelfde reeks-ID als gezien gemarkeerd.

### Technische details

**Bestand: `src/components/dashboard/DailyOverview.tsx`**

1. **Interfaces uitbreiden**: `series_id` toevoegen aan `GasCylinderOrder` en `AmbulanceTrip`, `parent_order_id` toevoegen aan `DryIceOrder`

2. **Queries aanpassen**: `series_id` / `parent_order_id` meenemen in de select-queries voor gas_cylinder_orders, ambulance_trips en dry_ice_orders

3. **Nieuwe functie `markSeriesAsSeen`**: Zoekt alle items (taken, droogijs, gas, ambulance) met hetzelfde reeks-ID en markeert ze allemaal als gezien in een keer

4. **Click handlers aanpassen**: De vier click handlers (`handleTaskClick`, `handleDryIceClick`, `handleGasClick`, `handleAmbulanceClick`) roepen `markSeriesAsSeen` aan in plaats van alleen `markAsSeen` voor het individuele item

### Bestanden die worden aangepast
- `src/components/dashboard/DailyOverview.tsx`
