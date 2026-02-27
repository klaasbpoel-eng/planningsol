

# Ambulance Ritten Inplannen via de Kalender

## Wat wordt gebouwd

Een nieuwe "Ambulance rit" optie in het kalender-aanmaakmenu waarmee dagelijkse ambulance ritten ingepland kunnen worden. Per rit wordt vastgelegd:

- **Datum** (ingepland op een specifieke dag)
- **Aantal 2L 300 O2 cilinders** die geladen moeten worden
- **Aantal 5L O2 Geintegreerd** cilinders die geladen moeten worden
- **Klantenlijst** -- een lijst met klantnummers en namen die digitaal in een ander scansysteem ingevoerd moeten worden
- **Status** (gepland / voltooid / geannuleerd)
- **Notities** (optioneel)

De ritten worden in de kalender weergegeven met een rode/roze kleurcodering (ambulance-thema) en een Ambulance-icoon.

## Visueel in de kalender

- Nieuwe filteroptie "Ambulance" naast de bestaande filters (Verlof, Taken, Droogijs, Gascilinders)
- Rode badge in dagcellen met samenvatting (bijv. "Ambulance - 4x 2L, 6x 5L - 3 klanten")
- Klikbaar om details te bekijken/bewerken/verwijderen
- Nieuw icoon in het "Nieuw item aanmaken" menu

---

## Technische details

### Stap 1: Database migratie -- nieuwe tabel `ambulance_trips`

```sql
CREATE TABLE ambulance_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date DATE NOT NULL,
  cylinders_2l_300_o2 INTEGER NOT NULL DEFAULT 0,
  cylinders_5l_o2_integrated INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE TABLE ambulance_trip_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES ambulance_trips(id) ON DELETE CASCADE,
  customer_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS-policies: Admins volledige CRUD, operators/supervisors SELECT op hun locatie (of open).

### Stap 2: API-laag uitbreiden (`src/lib/api.ts`)

Nieuwe `ambulanceTrips` sectie met:
- `getAll(fromDate)` -- haalt ritten op met hun klanten via een join
- `create(trip, customers[])` -- maakt rit + klanten aan
- `update(id, trip)` -- update rit
- `delete(id)` -- verwijdert rit (cascade verwijdert klanten)

### Stap 3: Nieuw component `CreateAmbulanceTripDialog.tsx`

Formulier met:
- Datumkiezer (vooraf ingevuld op geselecteerde dag)
- Numerieke invoervelden voor 2L 300 O2 en 5L O2 Geintegreerd
- Dynamische klantenlijst: per rij een klantnummer + klantnaam, met "+" knop om rijen toe te voegen en "x" om te verwijderen
- Herhaalopties (wekelijks/2-wekelijks, vergelijkbaar met bestaande dialogen)
- Opslaan-knop

### Stap 4: Nieuw component `AmbulanceTripDialog.tsx`

Detail/bewerk/verwijder dialog voor bestaande ritten. Toont:
- Datum, cilinder-aantallen
- Klantenlijst (tabel met nummer + naam)
- Status wijzigen
- Verwijder-knop (admin only)

### Stap 5: Kalender integratie (`CalendarOverview.tsx`)

- Nieuwe state: `ambulanceTrips`, `showAmbulance`, `createAmbulanceTripDialogOpen`, `ambulanceTripDialogOpen`, `selectedAmbulanceTrip`
- Uitbreiden `CalendarItem` type met `| { type: "ambulance"; data: AmbulanceTripWithCustomers }`
- `fetchData`: ambulance_trips ophalen via API
- `getItemsForDay`: ambulance items toevoegen
- Filterpaneel: "Ambulance" checkbox toevoegen
- Aanmaakmenu: "Ambulance" knop toevoegen (4e kolom in grid, of 2x2 grid)
- Rendering: rode badge met ambulance-icoon en cilinder-samenvatting

### Stap 6: DailyOverview uitbreiden

Ambulance ritten ook tonen in het "Mijn Dag" dashboard-overzicht met rode kleurcodering.

