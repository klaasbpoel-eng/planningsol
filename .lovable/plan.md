## Doel

De toezichthouder eist registratie van gevaarlijke stoffen **per afzonderlijke opslagplaats** in plaats van het huidige totaal per locatie (Emmen/Tilburg). Dit moet voldoen aan **PGS 15:2021 v1.0** en ook tijdelijke/incidentele opslag (afdak E1, naast gebouw, hekwerk rechts) én het crossdock omvatten. Daarnaast moet er een module komen voor het aanvragen van uitbreiding van vergunde hoeveelheden.

## Wat er nu is

- `pgs_substances`: 1 rij per stof per locatie (sol_emmen / sol_tilburg) met `max_allowed_kg`, `current_stock_kg` en een vrij tekstveld `storage_location`.
- `bulk_storage_tanks`: bulktanks per locatie.
- Tab "PGS Register" in `src/components/production/PGSRegistry.tsx` toont één lijst per locatie + bulkkaarten, met PDF/Excel-export op locatieniveau.

Het vrije tekstveld `storage_location` is te zwak voor toezicht: geen structuur, geen type (vast/tijdelijk/crossdock), geen verblijftijd, geen aparte capaciteit per plek.

## Plan

### 1. Database — nieuwe tabel `storage_places`

Velden:
- `id`, `location` (sol_emmen / sol_tilburg)
- `name` (bv. "Cilinderbunker 1", "Afdak E1", "Crossdock")
- `code` (kort, optioneel)
- `place_type`: enum `permanent` | `temporary` | `crossdock`
- `max_residence_hours` (numeric, alleen relevant voor `crossdock` en optioneel `temporary`)
- `pgs_guideline` (default 'PGS 15')
- `description`, `notes`
- `is_active`, audit-velden

RLS: zelfde patroon als `pgs_substances` (admin alles, supervisor/operator lezen op eigen locatie). GRANT op authenticated + service_role.

### 2. Database — koppeling stoffen aan opslagplaats

- `pgs_substances.storage_place_id uuid REFERENCES storage_places(id) ON DELETE SET NULL`
- Eén stof mag in meerdere opslagplaatsen liggen → bestaande rij blijft "1 stof per plek". Voor stoffen die nu in meerdere plekken liggen splitsen we ze later via UI (zie stap 5).
- Bestaand `storage_location` (text) blijft staan als legacy / fallback weergave.
- `bulk_storage_tanks` krijgt ook `storage_place_id` (optioneel) zodat tanks aan een plek hangen.

### 3. UI — Opslagplaatsen beheren

Nieuwe sectie in Admin (en knop "Opslagplaatsen" bovenin PGS Register):
- Tabel per locatie met naam, type (badge), max. verblijftijd (alleen crossdock), # gekoppelde stoffen.
- CRUD-dialog. Bij type = `crossdock` verschijnt veld "Max. verblijftijd (uren)".
- Standaard zaaien we de bestaande locaties met plekken: "Cilinderbunker", "Bulkopslag", "Afdak E1", "Naast gebouw", "Hekwerk rechts", "Crossdock" (gebruiker past aan).

### 4. UI — PGS Register herstructureren

In `PGSRegistry.tsx`:
- Standaard groepering wordt **per opslagplaats** (collapsible sectie per plek met locatie-badge en type-badge), in plaats van platte lijst per locatie.
- Per stof-rij: dropdown "Opslagplaats" (filtert op locatie van de stof).
- Crossdock-secties tonen een extra kolom "Max. verblijftijd" en een infobalk: "Wat kán hier staan (capaciteit), niet wat er nu staat".
- Bulktanks-kaarten worden onder de bijbehorende opslagplaats getoond.
- Toggle "Groeperen op: opslagplaats / stof / locatie" voor flexibiliteit.

### 5. Rapportage — PDF + Excel per opslagplaats

In `src/utils/` een nieuwe exporter (of uitbreiding op de bestaande PGS-export):
- **PDF (PGS 15:2021 lay-out):** voorblad met bedrijfsgegevens en datum; per opslagplaats één tabel met kolommen: Stof, UN-nr, ADR-klasse, GEVI, GHS-symbolen, PGS-richtlijn, Max. hoeveelheid (kg), Huidige voorraad (kg), Verblijftijd (alleen crossdock), Opmerking. Voettekst met versienr en paginanummers.
- **Excel:** één werkblad "Overzicht" + één werkblad per opslagplaats. Bulktanks krijgen eigen werkblad.
- Knoppen in PGS Register: "PDF (per opslagplaats)" en "Excel (per opslagplaats)" naast de bestaande export.

### 6. Nieuwe tab "Uitbreidingsaanvraag"

Nieuwe sectie in PGS Register (eigen tab of knop naast "Nieuwe stof"):
- Tabel `pgs_expansion_requests` met velden: `gas_type_id`, `location`, `target_storage_place_id`, `current_permitted_kg`, `requested_permitted_kg`, `motivation`, `status` (`draft` | `submitted` | `approved` | `rejected`), `requested_by`, `requested_at`.
- UI: lijst van aanvragen + "Nieuwe aanvraag"-dialog met stofkeuze (toont huidige vergunde hoeveelheid als pre-fill), gewenste nieuwe hoeveelheid, doel-opslagplaats, motivatie.
- Eigen PDF-export "Aanvraag uitbreiding vergunde hoeveelheden" als bijlage voor de aanvraag bij het bevoegd gezag.

### 7. Memory bijwerken

Update `mem://features/pgs-register-standards` en `mem://features/pgs-register-reporting` met de nieuwe per-opslagplaats-structuur en de expansion-module.

## Technische details

- Migraties: één migratie voor `storage_places` + enum, één voor kolom-uitbreiding op `pgs_substances` / `bulk_storage_tanks`, één voor `pgs_expansion_requests`. Allemaal met GRANT + RLS.
- PDF: hergebruik bestaande jsPDF/autoTable-setup uit `generateOrderPDF.ts`-patroon.
- Excel: hergebruik bestaande ExcelJS-export uit het PGS Register.
- Geen wijzigingen aan productieplanning, calendar of rapportage.

## Open punten (tijdens bouw te bevestigen)

- Exacte standaardnamen en types van de zaai-opslagplaatsen per locatie (kan ook leeg starten en gebruiker vult zelf).
- Standaard PGS-richtlijn voor crossdock (PGS 15) en welke ADR-klassen er mogen liggen — dit kan per opslagplaats configureerbaar (optionele lijst).
