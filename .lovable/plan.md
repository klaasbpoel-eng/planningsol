

# Schema Aanmaken op Extern Supabase Project

## Overzicht
Een nieuwe knop "Schema aanmaken" toevoegen aan de Supabase Sync UI die automatisch alle benodigde enums en tabellen aanmaakt op het externe Supabase project. Dit zorgt ervoor dat de tabelstructuur klaarstaat voordat je data kunt synchroniseren.

## Wat wordt er gebouwd

### 1. Nieuwe Edge Function: `sync-schema`
Een backend functie die SQL uitvoert op het externe project via de `postgresjs` library (dezelfde aanpak als `reset-dry-ice-orders`). De functie:
- Maakt eerst de benodigde enum types aan (indien ze nog niet bestaan): `dry_ice_product_type`, `production_order_status`, `production_location`, `gas_type`, `gas_grade`
- Maakt daarna alle 11 sync-tabellen aan in de juiste volgorde (parent-tabellen eerst)
- Gebruikt `CREATE TYPE IF NOT EXISTS` en `CREATE TABLE IF NOT EXISTS` zodat bestaande structuren niet overschreven worden
- Vereist dat de gebruiker de **Database URL** (postgres connection string) van het externe project opgeeft, omdat schema-bewerkingen niet via de Supabase REST API kunnen

### 2. UI Aanpassingen in SupabaseSyncSettings
- Een extra invoerveld voor de **externe Database URL** (postgres connection string)
- Een "Schema aanmaken" knop met een bevestigingsdialoog
- Resultaatweergave met succes/foutmeldingen

## Workflow voor de gebruiker

```text
1. Vul externe Supabase URL + Service Role Key in (bestaand)
2. Vul externe Database URL in (nieuw veld)  
3. Klik "Schema aanmaken" --> maakt tabellen aan op extern project
4. Klik "Push naar extern" --> synchroniseert de data
```

## Technische Details

### Edge Function `sync-schema/index.ts`
- Authenticatie + admin-check (zelfde patroon als bestaande functies)
- Ontvangt: `externalDbUrl` en optioneel `tables` (welke tabellen)
- Gebruikt `postgresjs` (deno.land/x/postgresjs) om SQL uit te voeren op het externe project
- SQL bevat `IF NOT EXISTS` clausules zodat het veilig meerdere keren uitgevoerd kan worden
- Retourneert een lijst van aangemaakte/overgeslagen tabellen

### SQL die wordt uitgevoerd
De volgende objecten worden aangemaakt (in volgorde):

**Enums:**
- `dry_ice_product_type` (blocks, pellets, sticks)
- `production_order_status` (pending, in_progress, completed, cancelled)
- `production_location` (sol_emmen, sol_tilburg)
- `gas_type` (co2, nitrogen, argon, acetylene, oxygen, helium, other)
- `gas_grade` (medical, technical)

**Tabellen (in dependency-volgorde):**
1. `app_settings`
2. `gas_type_categories`
3. `cylinder_sizes`
4. `dry_ice_packaging`
5. `dry_ice_product_types`
6. `task_types`
7. `time_off_types`
8. `gas_types` (FK naar gas_type_categories)
9. `customers`
10. `gas_cylinder_orders` (FKs naar customers, gas_types)
11. `dry_ice_orders` (FKs naar customers, dry_ice_product_types, dry_ice_packaging)

Tabellen worden aangemaakt **zonder RLS** en **zonder FK constraints naar `profiles`** (die bestaan alleen in het lokale project). De FK-kolommen (`created_by`, `assigned_to`, etc.) worden wel als `uuid` kolommen aangemaakt maar zonder foreign key constraint.

### UI Component wijzigingen
- Nieuw veld "Externe Database URL" met placeholder `postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres`
- Opslaan in localStorage (alleen URL, niet het wachtwoord)
- Knop "Schema aanmaken" naast de bestaande push/pull knoppen
- Bevestigingsdialoog met uitleg
- Laadstatus en resultaatweergave

### Bestanden die worden aangemaakt/gewijzigd
1. **Nieuw**: `supabase/functions/sync-schema/index.ts` - Edge function
2. **Wijzigen**: `supabase/config.toml` - JWT verify instelling toevoegen
3. **Wijzigen**: `src/components/admin/SupabaseSyncSettings.tsx` - UI uitbreiden

