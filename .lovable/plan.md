

# Plan: RLS Policies voor Gascilinder Orders voor Operators Toevoegen

## Probleem

De vulwachtrij voor SOL Emmen toont geen data voor operators. Dit komt doordat de `gas_cylinder_orders` tabel **geen RLS policies** heeft voor operators om orders te bekijken op basis van hun productielocatie.

**Bewijs uit database:**
- Er zijn 20+ gascilinder orders voor SOL Emmen in februari 2026
- Er zijn 14 droogijs orders voor SOL Emmen in februari 2026
- De operator `kbpoel@home.nl` heeft `production_location: sol_emmen`
- Maar de RLS policies blokkeren toegang

**Huidige RLS policies op `gas_cylinder_orders`:**
| Policy | Regel |
|--------|-------|
| "Admins can view all" | `is_admin()` |
| "Users can view assigned or created" | Alleen eigen orders |

**RLS policies op `dry_ice_orders` (correct):**
| Policy | Regel |
|--------|-------|
| "Admins can view all" | `is_admin()` |
| "Operators can view at their location" | Locatie-gebaseerd |
| "Supervisors can view at their location" | Locatie-gebaseerd |

## Oplossing

Voeg dezelfde locatie-gebaseerde RLS policies toe aan `gas_cylinder_orders` die al bestaan op `dry_ice_orders`.

## Database Migratie

Twee nieuwe RLS policies toevoegen aan `gas_cylinder_orders`:

```text
1. "Operators can view gas cylinder orders at their location"
   - Operator role check
   - Locatie moet overeenkomen met operator's productielocatie
   - Fallback: toegang tot alle locaties als geen locatie toegewezen

2. "Supervisors can view gas cylinder orders at their location"  
   - Supervisor role check
   - Zelfde locatie-logica als operators
```

De SQL syntax volgt exact het patroon van de bestaande `dry_ice_orders` policies:

```text
Policy voor Operators:
  has_role(auth.uid(), 'operator') 
  AND (
    (get_user_production_location(auth.uid()) IS NOT NULL 
     AND location = get_user_production_location(auth.uid()))
    OR get_user_production_location(auth.uid()) IS NULL
  )

Policy voor Supervisors:
  has_role(auth.uid(), 'supervisor')
  AND (dezelfde locatie-logica)
```

## Verwacht Resultaat

Na de migratie:
- Operators zien alle gascilinder orders voor hun locatie (SOL Emmen of SOL Tilburg)
- Supervisors zien alle orders voor hun locatie
- Admins blijven alle orders zien
- De vulwachtrij toont de correcte data

## Bestand dat Gewijzigd Wordt

| Bestand | Wijziging |
|---------|-----------|
| Nieuwe SQL migratie | RLS policies toevoegen aan `gas_cylinder_orders` |

## Geen Frontend Wijzigingen Nodig

De frontend queries zijn correct. Het probleem zit puur in de database beveiliging.

