

## Database Export Vereenvoudigen

De huidige "Migratie" tab bevat nog veel oude functionaliteit (externe database connecties, Supabase credentials, migratiescript generatie) die niet meer nodig is. Dit plan vervangt dat door alleen de schone MySQL export download.

### Wat er verandert

**1. MigrationSettings.tsx vervangen**
- De 489 regels aan oude migratie-logica (connecties, scripts, etc.) worden vervangen door een simpele wrapper die:
  - De tabelselectie toont (checkboxes voor alle beschikbare tabellen)
  - De `DatabaseExportSettings` component rendert met de geselecteerde tabellen

**2. Tab hernoemen in AdminSettings.tsx**
- "Migratie" tab hernoemen naar "Database Export"
- Icon aanpassen van `ArrowRightLeft` naar `Download`

**3. Opruimen**
- Alle ongebruikte imports en code verwijderen uit MigrationSettings
- De externe database connectie-logica (localStorage keys, ConnectionConfig types) verwijderen

### Resultaat
- De admin ziet een "Database Export" tab met tabelselectie en een download knop
- Geen verwarrende connectie-instellingen of script-generatie meer
- De bestaande `DatabaseExportSettings` component en `export-mysql-dump` edge function blijven ongewijzigd

### Technische details

**MigrationSettings.tsx** wordt ~60 regels:
- State: `selectedTables` array
- UI: Checkboxes voor tabelselectie + `DatabaseExportSettings` component
- Tabellen lijst komt uit de `TABLE_SQLS` keys in de edge function (hardcoded lijst: `app_settings`, `gas_type_categories`, `cylinder_sizes`, `dry_ice_packaging`, `dry_ice_product_types`, `task_types`, `time_off_types`, `gas_types`, `customers`, `gas_cylinder_orders`, `dry_ice_orders`)

**AdminSettings.tsx** wijzigingen:
- Import `Download` icon in plaats van `ArrowRightLeft`
- Tab label: "Database Export" in plaats van "Migratie"

