

## Database Backup & Restore voor Admins

Een nieuwe functionaliteit waarmee admin-gebruikers een volledige backup van de database kunnen downloaden als JSON-bestand, en deze later kunnen herstellen.

### Wat wordt er ge-backupt?

De volgende tabellen worden opgenomen in de backup:

- `gas_cylinder_orders` -- alle gascilinder orders
- `dry_ice_orders` -- alle droogijs orders
- `customers` -- klantgegevens
- `gas_types` -- gastype definities
- `gas_type_categories` -- gastype categorien
- `cylinder_sizes` -- cilindergroottes
- `dry_ice_packaging` -- droogijs verpakkingen
- `dry_ice_product_types` -- droogijs producttypen
- `app_settings` -- applicatie-instellingen
- `task_types` -- taaktype definities
- `time_off_types` -- verloftype definities

Tabellen zoals `profiles`, `user_roles`, `notifications`, en `employee_leave_balances` worden NIET meegenomen om beveiligings- en privacy-redenen.

### Nieuwe bestanden

**1. Edge function: `supabase/functions/backup-database/index.ts`**

- Admin-only (controleert `user_roles` op admin-rol)
- Gebruikt service role client om alle data op te halen (batched per 999 rijen)
- Retourneert een JSON-bestand met alle tabeldata + metadata (datum, versie)
- Structuur van het JSON-bestand:

```text
{
  "version": "1.0",
  "created_at": "2026-02-08T...",
  "tables": {
    "gas_cylinder_orders": [...],
    "dry_ice_orders": [...],
    "customers": [...],
    ...
  }
}
```

**2. Edge function: `supabase/functions/restore-database/index.ts`**

- Admin-only
- Accepteert het JSON backup-bestand via POST body
- Valideert de structuur (controleert `version` en `tables` velden)
- Per tabel: verwijdert bestaande data en voegt backup-data toe in batches
- Volgorde van restore respecteert foreign key relaties (eerst referentietabellen, dan ordertabellen)
- Gebruikt een transactie via direct SQL (postgresjs) zodat een fout alles terugdraait

**3. Frontend component: `src/components/admin/DatabaseBackupRestore.tsx`**

- Card-component met twee secties:
  - **Backup**: knop om backup te downloaden als `.json` bestand
  - **Restore**: file upload (accepteert `.json`) met bevestigingsdialoog
- Beide acties tonen loading-status en success/error toasts
- Restore toont een waarschuwingsdialoog ("Dit overschrijft alle huidige data")

### Bestaand bestand wijzigen

**`src/components/admin/AdminSettings.tsx`**

- Importeer `DatabaseBackupRestore` component
- Voeg het toe aan de "Algemeen" tab, onder `DefaultCustomerSetting`

### Technische details

**Backup edge function flow:**
1. Verifieer admin-rol via auth header
2. Maak service role client aan
3. Haal per tabel alle rijen op in batches van 999
4. Combineer tot een JSON-object met metadata
5. Retourneer als `application/json` download

**Restore edge function flow:**
1. Verifieer admin-rol
2. Parse en valideer het JSON-bestand
3. Open een database-transactie via `postgresjs`
4. Verwijder data in omgekeerde volgorde (orders eerst, dan referentietabellen)
5. Insert data in correcte volgorde (referentietabellen eerst)
6. Bij succes: commit. Bij fout: rollback + foutmelding

**Restore-volgorde (respecteert foreign keys):**
1. Eerst: `gas_type_categories`, `gas_types`, `cylinder_sizes`, `dry_ice_packaging`, `dry_ice_product_types`, `task_types`, `time_off_types`, `app_settings`, `customers`
2. Daarna: `gas_cylinder_orders`, `dry_ice_orders`

**Delete-volgorde (omgekeerd):**
1. Eerst: `gas_cylinder_orders`, `dry_ice_orders`
2. Daarna: de rest

