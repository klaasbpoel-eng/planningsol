
# Plan: Operator Toegang tot Productiestatistieken Repareren

## Probleem

Wanneer een operator inlogt en naar de productiepagina gaat, worden alle statistieken als "0" weergegeven. Dit komt doordat de database RPC functies (`get_production_efficiency_by_period`, `get_dry_ice_efficiency_by_period`) een autorisatiecontrole hebben die **alleen admins en supervisors** toestaat:

```sql
IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) THEN
  RAISE EXCEPTION 'Unauthorized';
END IF;
```

De netwerkverzoeken retourneren `"Unauthorized"` (HTTP 400).

## Oplossing

De RPC functies moeten worden bijgewerkt om **ook operators toe te staan**, met de volgende beperkingen:
- Operators kunnen alleen statistieken zien voor hun toegewezen locatie
- Als een operator geen locatie heeft toegewezen, hebben ze geen toegang
- De locatieparameter wordt afgedwongen voor operators (ze kunnen geen `NULL` of andere locatie opgeven)

## Technische Aanpak

### Database Migratie

Er zijn twee RPC functies die moeten worden aangepast:

1. `get_production_efficiency_by_period` - voor gascilinder statistieken
2. `get_dry_ice_efficiency_by_period` - voor droogijs statistieken

De nieuwe autorisatielogica wordt:

```text
Toegangscontrole:
├── Admin/Supervisor: Volledige toegang, alle locaties
└── Operator:
    ├── Moet een toegewezen locatie hebben
    ├── Locatieparameter wordt geforceerd naar eigen locatie
    └── Kan geen andere locaties opvragen
```

### Wijzigingen per Functie

**get_production_efficiency_by_period:**
```sql
-- Oude check:
IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) THEN
  RAISE EXCEPTION 'Unauthorized';
END IF;

-- Nieuwe check:
DECLARE
  v_user_location text;
  v_effective_location text;
BEGIN
  -- Admins en supervisors hebben volledige toegang
  IF public.is_admin() OR public.has_role(auth.uid(), 'supervisor') THEN
    v_effective_location := p_location;
  -- Operators zijn beperkt tot hun eigen locatie  
  ELSIF public.has_role(auth.uid(), 'operator') THEN
    v_user_location := public.get_user_production_location(auth.uid())::text;
    IF v_user_location IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: No location assigned';
    END IF;
    -- Forceer de locatie naar de operator's eigen locatie
    v_effective_location := v_user_location;
  ELSE
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Gebruik v_effective_location in plaats van p_location in de query
```

**get_dry_ice_efficiency_by_period:**
Dezelfde logica, aangepast voor droogijs orders.

## Bestand dat Gewijzigd Wordt

| Bestand | Wijziging |
|---------|-----------|
| Nieuwe SQL migratie | Update beide RPC functies met operator-toegang |

## Visuele Flowchart

```text
Operator logt in
       │
       ▼
ProductionPlanning laadt
       │
       ▼
Roept RPC functies aan met p_location = operator's locatie
       │
       ▼
RPC functie controleert:
├── Is admin? → Ja → Gebruik p_location (of NULL voor alle)
├── Is supervisor? → Ja → Gebruik p_location (of NULL voor alle)  
├── Is operator? → Ja → 
│   ├── Heeft locatie? → Ja → Forceer eigen locatie
│   └── Geen locatie? → UNAUTHORIZED
└── Anders → UNAUTHORIZED
       │
       ▼
Resultaat met statistieken voor operator's locatie
```

## Verwacht Resultaat na Fix

- Operators zien de statistieken voor hun toegewezen locatie
- De 3 basis statistiek-kaarten tonen actuele data:
  - Droogijs gepland (kg)
  - Cilinders gepland
  - Totaal orders
- De vulwachtrij toont orders voor hun locatie

## Geen Frontend Wijzigingen Nodig

De frontend stuurt al de juiste locatieparameter mee (gebaseerd op `userProductionLocation`). Het probleem zit puur in de database functie-autorisatie.
