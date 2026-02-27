

# Testdata aanmaken voor Dagelijks Overzicht

## Wat wordt aangemaakt

Vier testrecords voor vandaag (2026-02-27) zodat het DailyOverview component data toont:

1. **Taak** -- "Cilinders vullen" om 09:00-11:00, toegewezen aan Klaas Berend Poel, type "Container bij de weg"
2. **Verlofdag** -- Martin Heikens heeft vandaag verlof (type "Verlof"), status approved
3. **Droogijs order** -- HWTS, 500 kg, status pending
4. **Gascilinder order** -- Adams, Argon 5.0, 12 cilinders, status pending

## Waarom een migratie

Alle tabellen hebben RLS-policies die alleen admins toestaan om data in te voegen. Een database-migratie draait als superuser en omzeilt RLS, waardoor de inserts slagen.

## Aanpassing AdminDashboard

Daarnaast wordt het DailyOverview component ook toegevoegd aan het AdminDashboard, zodat je het overzicht kunt zien ongeacht welke view je bekijkt.

---

## Technische details

### Stap 1: Database migratie met testdata

SQL migratie die 4 records invoegt:

- `tasks`: title "Cilinders vullen", due_date 2026-02-27, start_time 09:00, end_time 11:00, assigned_to = profile ID van Klaas, created_by = zelfde, type_id = "Container bij de weg"
- `time_off_requests`: profile_id = Martin Heikens, start_date/end_date = 2026-02-27, status approved, type_id = Verlof, day_part = full_day
- `dry_ice_orders`: customer_name "HWTS", customer_id, quantity_kg 500, scheduled_date 2026-02-27, status pending, created_by = Klaas, order_number auto-generated
- `gas_cylinder_orders`: customer_name "Adams", customer_id, gas_type_id = Argon 5.0, cylinder_count 12, scheduled_date 2026-02-27, status pending, created_by = Klaas, order_number auto-generated

### Stap 2: DailyOverview toevoegen aan AdminDashboard

In `src/components/admin/AdminDashboard.tsx`:
- Importeer `DailyOverview` component
- Render het bovenaan het dashboard (voor de tabs/content)

### Stap 3: RLS-fix voor taken

De huidige tasks SELECT policy checkt `auth.uid() = assigned_to`, maar `assigned_to` bevat een **profile ID** (niet een user_id). Taken met `assigned_to` die niet matcht met `auth.uid()` worden niet getoond aan gewone gebruikers. Admins zien alles via `is_admin()`. Dit is bestaand gedrag en hoeft niet gewijzigd te worden voor deze test.

