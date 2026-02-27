

# Dagelijks/Wekelijks Overzicht voor Medewerkers

## Concept

Een nieuw "Mijn Dag" overzichtspaneel dat direct op de startpagina (UserLaunchpad) wordt getoond als een prominente kaart bovenaan. Het toont in een oogopslag alles wat relevant is voor vandaag (en optioneel de komende week), gegroepeerd per categorie met kleurcodering.

## Weergave

Het overzicht toont per dag een compacte tijdlijn/lijst met:

- **Taken** (blauw) -- titel, toegewezen aan, tijdstip
- **Vrije dagen** (groen) -- wie is er vrij, type verlof
- **Droogijs orders** (cyaan) -- klant, hoeveelheid kg, status
- **Gascilinder orders** (oranje) -- klant, gastype, aantal cilinders, status

Bovenaan een dag/week toggle en navigatiepijlen. Elke categorie heeft een icoon en badge met het aantal items. Lege categorieen worden verborgen.

## Locatie in de app

- Wordt als eerste element getoond op de UserLaunchpad (startpagina, `/`)
- Boven de bestaande feature-kaarten grid
- Beschikbaar voor alle ingelogde medewerkers

## Dataflow

Hergebruikt dezelfde database-queries als CalendarOverview:
- `time_off_requests` met profiel-join
- `tasks` met profiel-join
- `dry_ice_orders`
- `gas_cylinder_orders`

Gefilterd op de geselecteerde dag of week.

---

## Technische details

### Nieuw bestand: `src/components/dashboard/DailyOverview.tsx`

1. Component accepteert geen props (haalt zelf data op via Supabase client)
2. State: `viewMode` ("day" | "week"), `currentDate`
3. Fetcht parallel:
   - `time_off_requests` waar `start_date <= datum <= end_date`, status "approved"
   - `tasks` waar `due_date` binnen bereik
   - `dry_ice_orders` waar `scheduled_date` binnen bereik
   - `gas_cylinder_orders` waar `scheduled_date` binnen bereik
4. Joins met `profiles` (voor namen), `task_types`, `gas_types`
5. Groepering per dag (bij weekweergave) met datum-headers
6. Per categorie een sectie met icoon, kleur-badge en items als compacte rijen
7. Skeleton loading state tijdens het ophalen

### Aanpassing: `src/components/dashboard/UserLaunchpad.tsx`

- Importeer en render `<DailyOverview />` boven de feature-kaarten grid

### Aanpassing: `src/pages/Index.tsx`

- Geen wijzigingen nodig (UserLaunchpad wordt al gerenderd)

### UI-structuur per dag

```text
+-----------------------------------------------+
| << Vandaag, 27 februari 2026        Dag | Week |
+-----------------------------------------------+
| [ClipboardList] Taken (2)                      |
|   09:00-10:00  Cilinders vullen - Guido        |
|   14:00-15:00  Kwaliteitscontrole - Algemeen   |
|                                                |
| [Palmtree] Vrij (1)                            |
|   Jan de Vries - Vakantie (hele dag)           |
|                                                |
| [Snowflake] Droogijs (3)                       |
|   UMCG - 500 kg - In behandeling               |
|   Philips - 200 kg - Gepland                   |
|   DSM - 150 kg - Gepland                       |
|                                                |
| [Cylinder] Gascilinders (1)                    |
|   Shell - CO2 - 12 cilinders - Gepland         |
+-----------------------------------------------+
```

### Bestaande patronen die worden hergebruikt

- Card/CardHeader/CardContent uit shadcn
- Badge voor status-indicatie
- Skeleton loading (bestaand patroon)
- FadeIn animatie
- Kleurcodering uit CalendarOverview (cyaan=droogijs, oranje=gas, groen=verlof, blauw=taken)
